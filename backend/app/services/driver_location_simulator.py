"""
Driver location simulator.

Option A implementation:
- Starts a per-driver 30s timer when driver gets assigned.
- Moves driver coordinates incrementally toward the customer location.
- Stops simulation when order is delivered/cancelled or when explicitly stopped.
"""

import math
import threading
from datetime import datetime, timezone

TICK_SECONDS = 30
EARTH_RADIUS_KM = 6371.0

_active_timers = {}
_timers_lock = threading.Lock()


def _haversine_km(lat1, lon1, lat2, lon2):
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(d_lon / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _step_towards(current_lat, current_lng, target_lat, target_lng, max_distance_km):
    total_distance_km = _haversine_km(current_lat, current_lng, target_lat, target_lng)
    if total_distance_km <= 0:
        return target_lat, target_lng, True

    if total_distance_km <= max_distance_km:
        return target_lat, target_lng, True

    ratio = max_distance_km / total_distance_km
    next_lat = current_lat + (target_lat - current_lat) * ratio
    next_lng = current_lng + (target_lng - current_lng) * ratio
    return next_lat, next_lng, False


def stop_driver_location_simulation(driver_id, reason='manual_stop'):
    """Stop simulation timer for a driver if one is active."""
    with _timers_lock:
        timer = _active_timers.pop(driver_id, None)
    if timer:
        timer.cancel()
        print(f'[SIM] Stopped driver {driver_id} simulation ({reason})')


def start_driver_location_simulation(app, driver_id, order_id):
    """Start or restart movement simulation for the assigned driver/order pair."""
    from app import db
    from app.models.driver import Driver
    from app.models.order import Order
    from app.models.restaurant import Restaurant

    # Ensure only one active timer per driver.
    stop_driver_location_simulation(driver_id, reason='restart')

    with app.app_context():
        driver = Driver.query.get(driver_id)
        order = Order.query.get(order_id)
        restaurant = Restaurant.query.first()

        if not driver or not order:
            return

        if order.latitude is None or order.longitude is None:
            return

        if driver.current_order_id != order.id:
            driver.current_order_id = order.id

        # Use depot as start point when no prior coordinate exists.
        if (driver.current_latitude is None or driver.current_longitude is None) and restaurant:
            if restaurant.latitude is not None and restaurant.longitude is not None:
                driver.current_latitude = restaurant.latitude
                driver.current_longitude = restaurant.longitude

        db.session.commit()

    def _tick():
        from app import db

        should_reschedule = False
        try:
            with app.app_context():
                driver = Driver.query.get(driver_id)
                order = Order.query.get(order_id)
                restaurant = Restaurant.query.first()

                if not driver or not order:
                    stop_driver_location_simulation(driver_id, reason='missing_entities')
                    return

                if driver.current_order_id != order.id:
                    stop_driver_location_simulation(driver_id, reason='order_changed')
                    return

                if order.status in ('delivered', 'cancelled'):
                    driver.current_order_id = None
                    db.session.commit()
                    stop_driver_location_simulation(driver_id, reason=f'order_{order.status}')
                    return

                if order.latitude is None or order.longitude is None:
                    stop_driver_location_simulation(driver_id, reason='missing_order_coordinates')
                    return

                if driver.current_latitude is None or driver.current_longitude is None:
                    if restaurant and restaurant.latitude is not None and restaurant.longitude is not None:
                        driver.current_latitude = restaurant.latitude
                        driver.current_longitude = restaurant.longitude
                    else:
                        stop_driver_location_simulation(driver_id, reason='missing_start_coordinates')
                        return

                avg_speed_kmh = 30.0
                if restaurant and restaurant.avg_speed_kmh:
                    avg_speed_kmh = float(restaurant.avg_speed_kmh)
                max_step_distance_km = max(0.05, (avg_speed_kmh / 3600.0) * TICK_SECONDS)

                next_lat, next_lng, arrived = _step_towards(
                    driver.current_latitude,
                    driver.current_longitude,
                    order.latitude,
                    order.longitude,
                    max_step_distance_km,
                )

                driver.current_latitude = next_lat
                driver.current_longitude = next_lng
                driver.updated_at = datetime.now(timezone.utc)
                db.session.commit()

                if arrived:
                    print(f'[SIM] Driver {driver_id} reached customer for order {order_id}')

                # Continue updates until order transition stops it.
                should_reschedule = True
        except Exception as error:
            print(f'[SIM] Driver movement tick failed for {driver_id}: {error}')
            should_reschedule = True

        if should_reschedule:
            timer = threading.Timer(TICK_SECONDS, _tick)
            timer.daemon = True
            with _timers_lock:
                _active_timers[driver_id] = timer
            timer.start()

    timer = threading.Timer(TICK_SECONDS, _tick)
    timer.daemon = True
    with _timers_lock:
        _active_timers[driver_id] = timer
    timer.start()
    print(f'[SIM] Started driver {driver_id} simulation for order {order_id}')
