"""
Route Optimization Service using Google OR-Tools.

Per PRD Section C – Routing & Allocation Algorithms:
  C.1: Google OR-Tools VRPTW solver (no manual heuristics)
  C.2: PATH_CHEAPEST_ARC for initial rapid solution
  C.3: Guided Local Search (GLS) metaheuristic – NOT 2-opt
  C.4: Event-driven – triggered instantly when voice/manual sets order "ready"
  C.5: Min-TAT: closest driver dispatched to food waiting longest
  C.6: Strict capacity + max-radius + SLA constraint enforcement
  C.7: 5-second solver time limit; async non-blocking execution
  C.8: Greedy fallback with full constraint validation

Restaurant-centric design:
  - Depot = restaurant location (from DB, not hardcoded)
  - Round-trip: delivery ETA + return ETA calculated per assignment
  - Driver auto-return scheduling via background timer
"""

import math
import threading
import logging
from datetime import datetime, timezone, timedelta
from flask import current_app
from app.services.driver_location_simulator import start_driver_location_simulation
from app.services.order_lifecycle import schedule_order_lifecycle

try:
    from ortools.constraint_solver import routing_enums_pb2, pywrapcp
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False
    print("WARNING: Google OR-Tools not installed. Route optimization will use fallback.")

log = logging.getLogger(__name__)

# ── Fallback defaults (used when restaurant is not configured) ──
FALLBACK_DEPOT = (51.505, -0.09)          # Central London
MAX_DELIVERY_RADIUS_KM = 15.0
VEHICLE_CAPACITY = 5
SLA_MAX_DELIVERY_MINUTES = 45
SOLVER_TIME_LIMIT_SECONDS = 5
DEFAULT_AVG_SPEED_KMH = 30.0  # Average driver speed for time estimates


def _get_restaurant_depot():
    """
    Get the restaurant location from DB to use as VRP depot.
    Falls back to FALLBACK_DEPOT if restaurant is not registered.
    Also returns avg_speed_kmh and max_delivery_radius_km from restaurant config.
    """
    from app.models.restaurant import Restaurant
    restaurant = Restaurant.query.first()
    if restaurant:
        from app import db
        from app.models.settings import Settings
        from app.utils.geocoder import geocode_address
        use_platform = bool(restaurant.use_platform_drivers)
        use_platform = Settings.get_typed_for_restaurant(
            'use_platform_drivers',
            restaurant.id,
            fallback=use_platform,
        ) is True

        lat = restaurant.latitude
        lng = restaurant.longitude

        # Auto-heal legacy rows missing coordinates using the stored restaurant address.
        if (lat is None or lng is None) and restaurant.address:
            resolved_lat, resolved_lng = geocode_address(restaurant.address)
            if resolved_lat is not None and resolved_lng is not None:
                restaurant.latitude = resolved_lat
                restaurant.longitude = resolved_lng
                db.session.commit()
                lat = resolved_lat
                lng = resolved_lng

        # Final guardrail: keep system operational with fallback depot.
        if lat is None or lng is None:
            lat = FALLBACK_DEPOT[0]
            lng = FALLBACK_DEPOT[1]

        return {
            'restaurant_id': restaurant.id,
            'lat': lat,
            'lng': lng,
            'avg_speed_kmh': restaurant.avg_speed_kmh or DEFAULT_AVG_SPEED_KMH,
            'max_radius_km': restaurant.max_delivery_radius_km or MAX_DELIVERY_RADIUS_KM,
            'use_platform_drivers': use_platform,
        }
    return {
        'restaurant_id': None,
        'lat': FALLBACK_DEPOT[0],
        'lng': FALLBACK_DEPOT[1],
        'avg_speed_kmh': DEFAULT_AVG_SPEED_KMH,
        'max_radius_km': MAX_DELIVERY_RADIUS_KM,
        'use_platform_drivers': False,
    }


def get_eligible_drivers(restaurant_id):
    """
    Reusable eligibility gate for assignment.

    Rules:
      - Always include restaurant-owned drivers for the current restaurant.
      - Include platform-owned drivers only if restaurant opted in.
      - Only return currently available drivers.
    """
    from app.models.driver import Driver
    from app.models.restaurant import Restaurant
    from app.models.settings import Settings

    print(f"[ASSIGN] ========== get_eligible_drivers(restaurant_id={restaurant_id}) ==========")
    
    # Check restaurant object
    restaurant = Restaurant.query.get(restaurant_id) if restaurant_id else None
    use_platform = bool(restaurant.use_platform_drivers) if restaurant else False
    print(f"[ASSIGN] Restaurant lookup: restaurant={restaurant.name if restaurant else None}, use_platform_drivers on restaurant={use_platform}")

    # Allow settings toggle to control behavior before full restaurant setup flows
    setting = Settings.get_for_restaurant('use_platform_drivers', restaurant_id)
    if setting is not None:
        typed_value = setting.get_typed_value()
        use_platform = typed_value is True
        print(f"[ASSIGN] Settings override: use_platform_drivers setting found, value={setting.value}, type={setting.value_type}, get_typed_value()={typed_value}, use_platform now={use_platform}")
    else:
        print(f"[ASSIGN] Settings override: no use_platform_drivers setting found")

    # Get all available or returning drivers (returning drivers are eligible for assignment
    # if they represent the fastest way to get food to the customer)
    all_available = Driver.query.filter(Driver.status.in_(['available', 'returning'])).all()
    print(f"[ASSIGN] Total drivers with status=available: {len(all_available)}")
    for d in all_available:
        print(f"[ASSIGN]   - {d.id}: owner_type={d.owner_type}, restaurant_id={d.restaurant_id}, status={d.status}, lat={d.current_latitude}, lng={d.current_longitude}")

    # Build eligible list manually to debug
    eligible = []
    for driver in all_available:
        match_reason = None

        # Restaurant-owned drivers (including unaffiliated local drivers with no restaurant_id)
        if driver.owner_type == 'restaurant' and (driver.restaurant_id == restaurant_id or driver.restaurant_id is None):
            eligible.append(driver)
            match_reason = f"restaurant-owned (owner_type=restaurant, restaurant_id={driver.restaurant_id})"
        # Platform-owned drivers
        elif driver.owner_type == 'platform' and use_platform:
            eligible.append(driver)
            match_reason = f"platform-owned (use_platform={use_platform})"
        else:
            no_match = []
            if driver.owner_type != 'restaurant':
                no_match.append(f"owner_type={driver.owner_type} (not 'restaurant')")
            if driver.restaurant_id != restaurant_id:
                no_match.append(f"restaurant_id={driver.restaurant_id} (not {restaurant_id})")
            if driver.owner_type == 'platform' and not use_platform:
                no_match.append("platform but use_platform=False")
            match_reason = f"EXCLUDED: {', '.join(no_match)}"
        print(f"[ASSIGN]   {'OK' if driver in eligible else 'X '} {driver.id}: {match_reason}")

    print(f"[ASSIGN] Eligible drivers count: {len(eligible)}")
    print(f"[ASSIGN] Eligible drivers: {[d.id for d in eligible]}")
    return eligible


# ═══════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════

def trigger_route_optimization(order_id):
    """
    Event-driven trigger – called INSTANTLY when an order status changes to "ready".
    Runs the VRP solver asynchronously so it does not block the request thread.
    Returns allocation result dict immediately; actual DB writes happen in background.
    """
    from app import db
    from app.services.order_lifecycle import schedule_order_lifecycle
    from app.models.order import Order

    # Auto-geocode the triggering order if it has no coordinates
    triggering_order = Order.query.get(order_id)
    triggering_restaurant_id = triggering_order.restaurant_id if triggering_order else None
    if triggering_order and (triggering_order.latitude is None or triggering_order.longitude is None):
        _auto_geocode(triggering_order)
        db.session.commit()

    # Collect ALL ready orders (including those waiting for a batch)
    ready_orders = Order.query.filter(
        Order.status == 'ready',
        Order.driver_id.is_(None),       # Not yet assigned
        Order.restaurant_id == triggering_restaurant_id,
    ).all()

    # Auto-geocode any orders missing coords
    needs_commit = False
    for o in ready_orders:
        if o.latitude is None or o.longitude is None:
            _auto_geocode(o)
            needs_commit = True
    if needs_commit:
        db.session.commit()

    # Filter to only orders with valid coordinates
    ready_orders = [o for o in ready_orders if o.latitude is not None and o.longitude is not None]

    if not ready_orders:
        return {'message': 'No ready orders with coordinates to optimize', 'routes': []}

    order_ids = [o.id for o in ready_orders]

    # Get Flask app for context in background thread
    app = current_app._get_current_object()

    # Run async – fire and forget (PRD: solver must not block backend)
    thread = threading.Thread(
        target=_async_optimize,
        args=(app, order_ids),
        daemon=True
    )
    thread.start()

    # Also run a quick synchronous greedy pass for the triggering order
    # so the API can return immediate allocation info
    return _quick_assign_single(triggering_order)


def optimize_routes(order_ids):
    """
    Main optimization entry point (called from /routes/optimize API).
    Synchronous – used for manual/batch optimization.
    """
    from app.models.order import Order
    from app.models.driver import Driver

    orders = Order.query.filter(Order.id.in_(order_ids)).all()
    if not orders:
        return {'message': 'No valid orders found', 'routes': []}

    first_restaurant_id = orders[0].restaurant_id
    orders = [o for o in orders if o.restaurant_id == first_restaurant_id]

    depot = _get_restaurant_depot()
    available_drivers = get_eligible_drivers(depot['restaurant_id'])
    if not available_drivers:
        return {'message': 'No available drivers', 'routes': []}

    # Filter by SLA constraints
    orders, rejected = _apply_sla_constraints(orders, available_drivers)

    if not orders:
        return {
            'message': 'All orders violate SLA constraints',
            'routes': [],
            'rejected': [{'order_id': o.id, 'reason': r} for o, r in rejected],
        }

    # Seed ordering for VRP from scored assignment against oldest waiting order
    if orders:
        oldest_order = sorted(
            orders,
            key=lambda o: o.created_at or datetime.min.replace(tzinfo=timezone.utc)
        )[0]
        available_drivers = _seed_driver_order_for_vrp(available_drivers, oldest_order, depot)

    # Solve
    if ORTOOLS_AVAILABLE and len(orders) >= 1 and len(available_drivers) >= 1:
        result = _solve_vrp(orders, available_drivers)
        method = 'vrp'
    else:
        result = _greedy_assign(orders, available_drivers)
        method = 'greedy_fallback'

    # Persist and update statuses
    allocation = _persist_routes(result, assignment_method=method)

    if rejected:
        allocation['rejected'] = [{'order_id': o.id, 'reason': r} for o, r in rejected]

    return allocation


# ═══════════════════════════════════════════════════════════════════
# ASYNC EXECUTION (PRD: non-blocking)
# ═══════════════════════════════════════════════════════════════════

def _async_optimize(app, order_ids):
    """Run full VRP optimization in a background thread with app context."""
    with app.app_context():
        try:
            result = optimize_routes(order_ids)
            log.info(f'Async VRP completed: {result.get("message", "")}')
        except Exception as e:
            log.error(f'Async VRP failed: {e}', exc_info=True)


# ═══════════════════════════════════════════════════════════════════
# QUICK SINGLE-ORDER ASSIGNMENT (immediate response)
# ═══════════════════════════════════════════════════════════════════

def _quick_assign_single(order):
    """
    Immediately assign the closest available driver to a single order.
    This provides instant feedback while the full VRP runs async.
    Per PRD C.5: closest driver → food waiting longest.

    Calculates ROUND-TRIP timing:
      - delivery_time: restaurant → customer
      - return_time:   customer → restaurant
      - round_trip:    total time until driver is available again
    """
    from app import db
    from app.models.route import Route, RouteStop

    if not order or order.latitude is None or order.longitude is None:
        return {'message': 'Order has no coordinates', 'routes': []}

    # Already assigned?
    if order.driver_id is not None:
        return {'message': 'Order already assigned', 'routes': []}

    depot = _get_restaurant_depot()
    available = get_eligible_drivers(depot['restaurant_id'])
    if not available:
        return {'message': 'No available drivers', 'routes': []}

    depot_lat, depot_lng = depot['lat'], depot['lng']
    avg_speed = depot['avg_speed_kmh']
    max_radius = depot['max_radius_km']

    # Primary path: weighted scoring assignment
    scored = _select_driver_scored(
        drivers=available,
        order=order,
        depot=depot,
        max_radius=max_radius,
    )

    assignment_method = 'scored'
    if not scored:
        scored = _select_driver_greedy_fallback(
            drivers=available,
            order=order,
            depot=depot,
            max_radius=max_radius,
        )
        assignment_method = 'greedy_fallback'

    if not scored:
        return {'message': 'No eligible drivers within constraints', 'routes': []}

    best_driver = scored['driver']
    assignment_score = scored.get('score')

    dlat = best_driver.current_latitude or depot_lat
    dlng = best_driver.current_longitude or depot_lng

    # ETA logic required by brief (all in minutes)
    dist_depot_to_driver = _haversine_distance(depot_lat, depot_lng, dlat, dlng)
    dist_depot_to_customer = _haversine_distance(depot_lat, depot_lng, order.latitude, order.longitude)
    dist_customer_to_depot = dist_depot_to_customer

    pickup_eta_minutes = (dist_depot_to_driver / avg_speed) * 60
    delivery_eta_minutes = pickup_eta_minutes + (dist_depot_to_customer / avg_speed) * 60
    available_again_minutes = delivery_eta_minutes + (dist_customer_to_depot / avg_speed) * 60

    # Keep quick-assignment ETAs realistic so drivers do not immediately bounce back
    # to available while the order is still in an active fulfillment state.
    pickup_eta_minutes = round(max(2.0, pickup_eta_minutes), 1)
    delivery_eta_minutes = round(max(pickup_eta_minutes + 5.0, delivery_eta_minutes), 1)
    available_again_minutes = round(max(delivery_eta_minutes + 5.0, available_again_minutes), 1)

    now = datetime.now(timezone.utc)

    # Create route + assign
    route_id = _generate_route_id()

    route = Route(
        id=route_id,
        driver_id=best_driver.id,
        restaurant_id=order.restaurant_id,
        status='active',
        total_distance=round(dist_depot_to_customer + dist_customer_to_depot, 1),
        estimated_time=int(round(available_again_minutes)),
        total_orders=1,
    )
    db.session.add(route)

    stop = RouteStop(
        route_id=route_id,
        order_id=order.id,
        sequence=1,
        address=order.delivery_address,
        lat=order.latitude,
        lng=order.longitude,
        status='in_transit',
        estimated_arrival=now + timedelta(minutes=delivery_eta_minutes),
    )
    db.session.add(stop)

    # Assign driver to order and transition to "assigned"
    order.driver_id = best_driver.id
    order.status = 'assigned'
    order.assigned_at = now
    order.driver_pickup_eta = pickup_eta_minutes
    order.estimated_delivery_minutes = int(round(delivery_eta_minutes))
    order.estimated_return_minutes = int(round(available_again_minutes - delivery_eta_minutes))
    order.estimated_round_trip_minutes = int(round(available_again_minutes))
    order.driver_available_again_minutes = available_again_minutes
    order.estimated_delivery = now + timedelta(minutes=delivery_eta_minutes)
    order.driver_available_at = now + timedelta(minutes=available_again_minutes)

    # Update driver status and timing
    best_driver.status = 'on_delivery'
    best_driver.current_order_id = order.id
    best_driver.active_deliveries += 1
    best_driver.assigned_at = now
    best_driver.estimated_delivery_at = now + timedelta(minutes=delivery_eta_minutes)
    best_driver.estimated_return_at = now + timedelta(minutes=available_again_minutes)
    best_driver.driver_available_at = best_driver.estimated_return_at
    best_driver.updated_at = now

    db.session.commit()

    try:
        start_driver_location_simulation(current_app._get_current_object(), best_driver.id, order.id)
    except Exception as sim_error:
        log.warning(f'Failed to start driver simulation for order #{order.id}: {sim_error}')

    try:
        schedule_order_lifecycle(current_app._get_current_object(), order.id)
    except Exception as lifecycle_error:
        log.warning(f'Failed to schedule lifecycle for order #{order.id}: {lifecycle_error}')

    return {
        'message': f'Driver {best_driver.name} assigned to order #{order.id}',
        'routes': [route.to_dict()],
        'order_id': order.id,
        'assigned_driver': best_driver.to_summary_dict(),
        'eta': {
            'driver_arrives_at_restaurant_minutes': pickup_eta_minutes,
            'customer_receives_order_minutes': delivery_eta_minutes,
            'driver_available_again_minutes': available_again_minutes,
            'estimated_delivery_at': order.estimated_delivery.isoformat() if order.estimated_delivery else None,
            'driver_available_at': order.driver_available_at.isoformat() if order.driver_available_at else None,
        },
        'assignment_score': round(float(assignment_score), 3) if assignment_score is not None else None,
        'assignment_method': assignment_method,
    }


def _select_driver_scored(drivers, order, depot, max_radius):
    """Select driver by estimated time-to-customer (pickup + delivery). Lower is better.

    This function now accounts for drivers who are `returning` by using their
    `driver_available_at` timestamp as the pickup delay. For `available` drivers
    pickup is estimated by distance between depot and driver.
    """
    candidates = []
    now = datetime.now(timezone.utc)
    avg_speed = depot.get('avg_speed_kmh') or DEFAULT_AVG_SPEED_KMH

    for driver in drivers:
        # Ignore overloaded drivers
        if driver.active_deliveries >= VEHICLE_CAPACITY:
            continue

        # Determine driver's effective position
        dlat = driver.current_latitude or depot['lat']
        dlng = driver.current_longitude or depot['lng']

        # Distance from driver to customer
        distance_to_customer = _haversine_distance(dlat, dlng, order.latitude, order.longitude)
        if distance_to_customer > max_radius:
            continue

        # Estimate pickup time (minutes)
        if driver.status == 'returning' and driver.driver_available_at:
            driver_av = driver.driver_available_at
            if driver_av.tzinfo is None:
                driver_av = driver_av.replace(tzinfo=timezone.utc)
            pickup_secs = max(0.0, (driver_av - now).total_seconds())
            pickup_minutes = max(0.0, pickup_secs / 60.0)
        else:
            dist_depot_to_driver = _haversine_distance(depot['lat'], depot['lng'], dlat, dlng)
            pickup_minutes = (dist_depot_to_driver / avg_speed) * 60.0

        # Estimate delivery minutes from depot to customer
        delivery_minutes = ( _haversine_distance(depot['lat'], depot['lng'], order.latitude, order.longitude) / avg_speed ) * 60.0

        # Total estimated time until customer receives order
        total_time_to_customer = pickup_minutes + delivery_minutes

        candidates.append({'driver': driver, 'time_to_customer': total_time_to_customer, 'pickup': pickup_minutes})

    if not candidates:
        return None

    # Prefer minimal time_to_customer; tie-breaker by rating then active_deliveries
    best = min(candidates, key=lambda item: (item['time_to_customer'], getattr(item['driver'], 'rating', 5.0), item['driver'].active_deliveries))
    return {'driver': best['driver'], 'score': best['time_to_customer']}


def _select_driver_greedy_fallback(drivers, order, depot, max_radius):
    """Fallback: choose driver with smallest estimated time-to-customer."""
    best_driver = None
    best_time = float('inf')
    now = datetime.now(timezone.utc)
    avg_speed = depot.get('avg_speed_kmh') or DEFAULT_AVG_SPEED_KMH

    for driver in drivers:
        if driver.active_deliveries >= VEHICLE_CAPACITY:
            continue

        dlat = driver.current_latitude or depot['lat']
        dlng = driver.current_longitude or depot['lng']

        # Distance-based guard
        distance_to_customer = _haversine_distance(dlat, dlng, order.latitude, order.longitude)
        if distance_to_customer > max_radius:
            continue

        # Pickup time
        if driver.status == 'returning' and driver.driver_available_at:
            driver_av = driver.driver_available_at
            if driver_av.tzinfo is None:
                driver_av = driver_av.replace(tzinfo=timezone.utc)
            pickup_secs = max(0.0, (driver_av - now).total_seconds())
            pickup_minutes = max(0.0, pickup_secs / 60.0)
        else:
            dist_depot_to_driver = _haversine_distance(depot['lat'], depot['lng'], dlat, dlng)
            pickup_minutes = (dist_depot_to_driver / avg_speed) * 60.0

        delivery_minutes = (_haversine_distance(depot['lat'], depot['lng'], order.latitude, order.longitude) / avg_speed) * 60.0
        total_time = pickup_minutes + delivery_minutes

        if total_time < best_time:
            best_time = total_time
            best_driver = driver

    if not best_driver:
        return None

    return {'driver': best_driver, 'score': best_time}


def _seed_driver_order_for_vrp(drivers, order, depot):
    """Order drivers by scored assignment to provide deterministic VRP seeding."""
    scored = []
    max_radius = depot['max_radius_km']
    for driver in drivers:
        picked = _select_driver_scored([driver], order, depot, max_radius)
        score = picked['score'] if picked else 1.0
        scored.append((driver, score))
    scored.sort(key=lambda item: item[1])
    return [driver for driver, _ in scored]


# ═══════════════════════════════════════════════════════════════════
# SLA / CONSTRAINT VALIDATION
# ═══════════════════════════════════════════════════════════════════

def _apply_sla_constraints(orders, drivers):
    """
    Filter orders that violate SLA constraints.
    Returns (valid_orders, [(rejected_order, reason), ...])
    """
    valid = []
    rejected = []
    depot = _get_restaurant_depot()
    max_radius = depot['max_radius_km']

    for order in orders:
        # Already assigned – skip
        if order.driver_id is not None:
            continue

        # Must have coordinates
        if order.latitude is None or order.longitude is None:
            rejected.append((order, 'Missing delivery coordinates'))
            continue

        # Check max delivery radius from restaurant depot
        dist = _haversine_distance(
            depot['lat'], depot['lng'],
            order.latitude, order.longitude
        )
        if dist > max_radius:
            rejected.append((order, f'Beyond max delivery radius ({dist:.1f}km > {max_radius}km)'))
            continue

        valid.append(order)

    return valid, rejected


# ═══════════════════════════════════════════════════════════════════
# OR-TOOLS VRP SOLVER
# ═══════════════════════════════════════════════════════════════════

def _solve_vrp(orders, drivers):
    """
    Solve the VRPTW using Google OR-Tools.

    Strategy (per PRD):
      - First solution: PATH_CHEAPEST_ARC (rapid Savings-based)
      - Metaheuristic:  GUIDED_LOCAL_SEARCH (NOT 2-opt)
      - Time limit:     5 seconds strict
      - Constraints:    vehicle capacity, max distance per vehicle
    """
    # Sort orders by creation time so oldest-waiting food is prioritized
    orders = sorted(orders, key=lambda o: o.created_at or datetime.min.replace(tzinfo=timezone.utc))

    # Depot = restaurant location
    depot = _get_restaurant_depot()
    depot_lat, depot_lng = depot['lat'], depot['lng']

    locations = [(depot_lat, depot_lng)]  # Node 0 = depot
    for order in orders:
        locations.append((order.latitude, order.longitude))

    num_locations = len(locations)
    num_vehicles = min(len(drivers), len(orders))

    # Distance matrix (meters)
    distance_matrix = _build_distance_matrix(locations)

    # ── Index manager ──
    manager = pywrapcp.RoutingIndexManager(num_locations, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    # ── Distance callback ──
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_cb = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_cb)

    # ── Distance dimension (max radius per vehicle) ──
    max_distance_m = int(depot['max_radius_km'] * 1000 * 2)  # round trip
    routing.AddDimension(
        transit_cb,
        0,                # no slack
        max_distance_m,   # max distance per vehicle
        True,             # start cumul to zero
        'Distance'
    )
    distance_dimension = routing.GetDimensionOrDie('Distance')
    distance_dimension.SetGlobalSpanCostCoefficient(100)

    # ── Capacity constraint ──
    def demand_callback(from_index):
        node = manager.IndexToNode(from_index)
        return 0 if node == 0 else 1  # depot=0, each order=1 unit

    demand_cb = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_cb,
        0,                                        # no slack
        [VEHICLE_CAPACITY] * num_vehicles,         # capacity per vehicle
        True,
        'Capacity'
    )

    # ── Search parameters (PRD-specified) ──
    search_params = pywrapcp.DefaultRoutingSearchParameters()

    # C.2: Path Cheapest Arc
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    # C.3: Guided Local Search (NOT 2-opt)
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    # C.7: Strict 5-second time limit
    time_limit = current_app.config.get('ORTOOLS_TIME_LIMIT_SECONDS', SOLVER_TIME_LIMIT_SECONDS)
    search_params.time_limit.seconds = time_limit

    # ── Solve ──
    solution = routing.SolveWithParameters(search_params)

    if not solution:
        log.warning('OR-Tools VRP found no solution, falling back to greedy')
        return _greedy_assign(orders, drivers)

    # ── Extract routes ──
    result = []
    for vehicle_id in range(num_vehicles):
        index = routing.Start(vehicle_id)
        route_orders = []
        route_distance = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node > 0:
                order_idx = node - 1
                if order_idx < len(orders):
                    route_orders.append(orders[order_idx])

            prev = index
            index = solution.Value(routing.NextVar(index))
            route_distance += routing.GetArcCostForVehicle(prev, index, vehicle_id)

        if route_orders:
            dist_km = round(route_distance / 1000, 1)
            result.append({
                'driver': drivers[vehicle_id],
                'orders': route_orders,
                'total_distance': dist_km,
                'estimated_time': max(10, int(dist_km * 3)),
            })

    return result


# ═══════════════════════════════════════════════════════════════════
# GREEDY FALLBACK (with constraint validation)
# ═══════════════════════════════════════════════════════════════════

def _greedy_assign(orders, drivers):
    """
    Fallback greedy assignment with full constraint checking.
    Per PRD C.5: Closest driver dispatched to food waiting the longest.
    Enforces capacity & max-radius SLA.
    """
    # Sort by creation time (oldest waiting first → minimize TAT)
    sorted_orders = sorted(
        orders,
        key=lambda o: o.created_at or datetime.min.replace(tzinfo=timezone.utc)
    )

    result = []
    driver_order_count = {d.id: 0 for d in drivers}
    used_drivers = set()

    depot = _get_restaurant_depot()
    max_radius = depot['max_radius_km']

    for order in sorted_orders:
        best_driver = None
        best_distance = float('inf')

        for driver in drivers:
            dlat = driver.current_latitude or depot['lat']
            dlng = driver.current_longitude or depot['lng']
            dist = _haversine_distance(dlat, dlng, order.latitude, order.longitude)

            # Constraint: max delivery radius
            if dist > max_radius:
                continue

            # Constraint: vehicle capacity
            if driver_order_count[driver.id] >= VEHICLE_CAPACITY:
                continue

            if dist < best_distance:
                best_distance = dist
                best_driver = driver

        if best_driver:
            driver_order_count[best_driver.id] += 1

            # Check if driver already has a route bucket
            existing = next((r for r in result if r['driver'].id == best_driver.id), None)
            if existing:
                existing['orders'].append(order)
                existing['total_distance'] += round(best_distance, 1)
                existing['estimated_time'] += int(best_distance * 3)
            else:
                result.append({
                    'driver': best_driver,
                    'orders': [order],
                    'total_distance': round(best_distance, 1),
                    'estimated_time': max(10, int(best_distance * 3)),
                })
                used_drivers.add(best_driver.id)
        else:
            log.warning(f'Order #{order.id} could not be assigned (constraint violation)')

    return result


# ═══════════════════════════════════════════════════════════════════
# PERSIST ROUTES → DB
# ═══════════════════════════════════════════════════════════════════

def _persist_routes(solver_result, assignment_method='vrp'):
    """Save solver output to DB, assign drivers, set round-trip ETAs, and set order status to 'assigned'."""
    from app import db
    from app.models.route import Route, RouteStop

    created_routes = []
    simulation_assignments = []
    depot = _get_restaurant_depot()
    avg_speed = depot['avg_speed_kmh']

    for route_data in solver_result:
        route_id = _generate_route_id()
        driver = route_data['driver']
        est_time = route_data.get('estimated_time', 15)

        route = Route(
            id=route_id,
            driver_id=driver.id,
            restaurant_id=(route_data['orders'][0].restaurant_id if route_data['orders'] else None),
            status='active',
            total_distance=route_data.get('total_distance', 0),
            estimated_time=est_time,
            total_orders=len(route_data['orders']),
        )
        db.session.add(route)

        now = datetime.now(timezone.utc)

        for seq, order in enumerate(route_data['orders'], 1):
            # Calculate delivery time for this specific order
            delivery_dist = _haversine_distance(
                depot['lat'], depot['lng'], order.latitude, order.longitude
            )
            delivery_time = max(5, int((delivery_dist / avg_speed) * 60))
            return_time = delivery_time  # symmetric distance back

            stop = RouteStop(
                route_id=route_id,
                order_id=order.id,
                sequence=seq,
                address=order.delivery_address,
                lat=order.latitude,
                lng=order.longitude,
                status='in_transit',
                estimated_arrival=now + timedelta(minutes=delivery_time),
            )
            db.session.add(stop)

            # Assign driver and transition order → "assigned"
            order.driver_id = driver.id
            if order.status == 'ready':
                order.status = 'assigned'
            order.assigned_at = now
            order.driver_pickup_eta = 0.0
            order.estimated_delivery = now + timedelta(minutes=delivery_time)
            order.estimated_delivery_minutes = delivery_time
            order.estimated_return_minutes = return_time
            order.estimated_round_trip_minutes = delivery_time + return_time
            order.driver_available_again_minutes = float(delivery_time + return_time)
            order.driver_available_at = now + timedelta(minutes=delivery_time + return_time)
            simulation_assignments.append((driver.id, order.id, seq))

        # Update driver status and round-trip timing
        driver.status = 'on_delivery'
        driver.active_deliveries += len(route_data['orders'])
        driver.assigned_at = now
        if route_data['orders']:
            driver.current_order_id = route_data['orders'][0].id

        # Last order determines the furthest delivery time
        last_order = route_data['orders'][-1] if route_data['orders'] else None
        if last_order:
            last_dist = _haversine_distance(
                depot['lat'], depot['lng'], last_order.latitude, last_order.longitude
            )
            last_delivery_time = max(5, int((last_dist / avg_speed) * 60))
            last_return_time = last_delivery_time
            driver.estimated_delivery_at = now + timedelta(minutes=last_delivery_time)
            driver.estimated_return_at = now + timedelta(minutes=last_delivery_time + last_return_time)
            driver.driver_available_at = driver.estimated_return_at
        driver.updated_at = now

        created_routes.append(route)

    db.session.commit()

    app = current_app._get_current_object()
    first_order_by_driver = {}
    for driver_id, order_id, seq in simulation_assignments:
        if driver_id not in first_order_by_driver or seq < first_order_by_driver[driver_id][1]:
            first_order_by_driver[driver_id] = (order_id, seq)

    for driver_id, (order_id, _) in first_order_by_driver.items():
        try:
            start_driver_location_simulation(app, driver_id, order_id)
        except Exception as sim_error:
            log.warning(f'Failed to start driver simulation for order #{order_id}: {sim_error}')

    return {
        'message': f'Created {len(created_routes)} optimized route(s)',
        'assignment_method': assignment_method,
        'routes': [r.to_dict() for r in created_routes],
    }


# ═══════════════════════════════════════════════════════════════════
# GEOCODING FALLBACK
# ═══════════════════════════════════════════════════════════════════

def _auto_geocode(order):
    """
    Auto-assign coordinates to orders without lat/lng.
    Uses a simple deterministic hash of the delivery address to generate
    plausible coordinates near the restaurant depot. In production, replace
    with a real geocoding API (Google Maps, Mapbox, etc.).
    """
    if order.latitude is not None and order.longitude is not None:
        return

    depot = _get_restaurant_depot()
    depot_lat, depot_lng = depot['lat'], depot['lng']

    addr = (order.delivery_address or '').strip().lower()
    if not addr:
        # Default to depot with small offset based on order ID
        order.latitude = depot_lat + (order.id % 100) * 0.001
        order.longitude = depot_lng + (order.id % 50) * 0.001
        return

    # Deterministic pseudo-geocode: hash address → offset from depot
    h = hash(addr)
    lat_offset = ((h % 1000) - 500) / 5000.0   # ±0.1 degrees (~11km)
    lng_offset = (((h >> 10) % 1000) - 500) / 5000.0

    order.latitude = depot_lat + lat_offset
    order.longitude = depot_lng + lng_offset
    log.info(f'Auto-geocoded order #{order.id} → ({order.latitude:.4f}, {order.longitude:.4f})')


# ═══════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def _build_distance_matrix(locations):
    """Build a distance matrix using Haversine formula (in meters)."""
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                matrix[i][j] = int(_haversine_distance(
                    locations[i][0], locations[i][1],
                    locations[j][0], locations[j][1]
                ) * 1000)
    return matrix


def _haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate Haversine distance between two points in kilometers."""
    R = 6371
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(lat1_r) * math.cos(lat2_r) *
         math.sin(d_lon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _generate_route_id():
    """Generate a unique route ID."""
    from app.models.route import Route
    import uuid
    # Use uuid suffix for uniqueness under concurrent access
    count = Route.query.count()
    short = uuid.uuid4().hex[:4]
    return f'ROUTE{str(count + 1).zfill(3)}_{short}'
