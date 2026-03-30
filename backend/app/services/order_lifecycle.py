"""Automatic order and driver lifecycle transitions."""

import threading
from datetime import datetime, timedelta, timezone

from app import db

_order_timers = {}
_timers_lock = threading.Lock()


def _ensure_aware(dt_value):
    if not dt_value:
        return None
    if dt_value.tzinfo is None:
        return dt_value.replace(tzinfo=timezone.utc)
    return dt_value


def _pickup_due_at(order):
    assigned_at = _ensure_aware(order.assigned_at)
    if not assigned_at or order.driver_pickup_eta is None:
        return None
    return assigned_at + timedelta(minutes=float(order.driver_pickup_eta))


def _delivery_due_at(order):
    return _ensure_aware(order.estimated_delivery)


def _actual_delivery_minutes(order, delivered_at):
    """Calculate delivery minutes while guarding against stale historical timestamps."""
    assigned_at = _ensure_aware(order.assigned_at)
    elapsed_minutes = None

    if assigned_at:
        elapsed_seconds = max(0.0, (delivered_at - assigned_at).total_seconds())
        elapsed_minutes = max(1.0, elapsed_seconds / 60.0)

    estimated_minutes = None
    if order.estimated_delivery_minutes is not None:
        estimated_minutes = max(1.0, float(order.estimated_delivery_minutes))

    if elapsed_minutes is None:
        return estimated_minutes

    if estimated_minutes is None:
        return elapsed_minutes

    # Historical/demo data can have delayed manual updates by hours or days.
    # If elapsed is far beyond expected ETA, keep metrics meaningful using ETA.
    staleness_threshold = max((estimated_minutes * 3.0), (estimated_minutes + 30.0))
    if elapsed_minutes > staleness_threshold:
        return estimated_minutes

    return elapsed_minutes


def _driver_available_due_at(order, driver):
    if order and order.driver_available_at:
        return _ensure_aware(order.driver_available_at)
    if driver and driver.driver_available_at:
        return _ensure_aware(driver.driver_available_at)
    return None


def _map_order_status_to_route_stop_status(order_status):
    if order_status in ('assigned', 'out_for_delivery'):
        return 'in_transit'
    if order_status == 'delivered':
        return 'delivered'
    return 'pending'


def sync_route_stop_status(order, now=None):
    """Keep route stop status aligned with canonical order status."""
    from app.models.route import RouteStop

    if not order:
        return False

    changed = False
    effective_now = _ensure_aware(now) or datetime.now(timezone.utc)
    target_status = _map_order_status_to_route_stop_status(order.status)

    stops = RouteStop.query.filter(RouteStop.order_id == order.id).all()
    for stop in stops:
        if stop.status != target_status:
            stop.status = target_status
            changed = True

        if target_status == 'delivered':
            if stop.actual_arrival is None:
                stop.actual_arrival = effective_now
                changed = True
        elif stop.actual_arrival is not None:
            stop.actual_arrival = None
            changed = True

    return changed


def _set_driver_available(driver, now, source):
    from app.models.order import Order

    if not driver:
        return False

    changed = False

    # Do not transition a driver to available while they still have active linked orders.
    active_orders = Order.query.filter(
        Order.driver_id == driver.id,
        Order.status.in_(['assigned', 'out_for_delivery']),
    ).order_by(Order.assigned_at.asc().nulls_last(), Order.id.asc()).all()

    if active_orders:
        primary_order = active_orders[0]
        if driver.status != 'on_delivery':
            driver.status = 'on_delivery'
            changed = True
        if driver.current_order_id != primary_order.id:
            driver.current_order_id = primary_order.id
            changed = True
        if driver.active_deliveries != len(active_orders):
            driver.active_deliveries = len(active_orders)
            changed = True
        if changed:
            driver.updated_at = now
            print(f'[LIFECYCLE] Driver {driver.id} kept on_delivery due to active orders ({source})')
        return changed

    # Cleanup stale links where an order is still marked ready but points to this driver.
    stale_ready_orders = Order.query.filter(
        Order.driver_id == driver.id,
        Order.status == 'ready',
    ).all()
    for order in stale_ready_orders:
        order.driver_id = None
        order.assigned_at = None
        order.driver_pickup_eta = None
        order.estimated_delivery = None
        order.estimated_delivery_minutes = None
        order.estimated_return_minutes = None
        order.estimated_round_trip_minutes = None
        order.driver_available_again_minutes = None
        order.driver_available_at = None
        order.updated_at = now
        changed = True
        print(f'[LIFECYCLE] Cleared stale driver link for ready order #{order.id} ({source})')

    if driver.status not in ('returning', 'on_delivery'):
        return changed

    driver.status = 'available'
    driver.active_deliveries = 0
    driver.current_order_id = None
    driver.estimated_delivery_at = None
    driver.estimated_return_at = None
    driver.driver_available_at = None
    driver.current_latitude = None
    driver.current_longitude = None
    driver.updated_at = now
    print(f'[LIFECYCLE] Driver {driver.id} auto-transitioned to available ({source})')
    return True


def finalize_order_delivery(order, now=None, source='manual'):
    """Finalize an order delivery and move the driver into return state."""
    from app.models.driver import Driver
    from app.models.route import Route
    from app.services.driver_location_simulator import stop_driver_location_simulation

    now = _ensure_aware(now) or datetime.now(timezone.utc)

    if order.status == 'delivered':
        driver = Driver.query.get(order.driver_id) if order.driver_id else None
        available_due_at = _driver_available_due_at(order, driver)
        if driver and available_due_at and available_due_at <= now:
            changed = _set_driver_available(driver, now, source)
            if changed:
                db.session.commit()
        return order

    order.status = 'delivered'
    order.payment_status = 'Paid'
    order.updated_at = now
    sync_route_stop_status(order, now=now)

    driver = Driver.query.get(order.driver_id) if order.driver_id else None
    if driver:
        stop_driver_location_simulation(driver.id, reason=f'order_{order.id}_auto_delivered')
        if driver.current_order_id == order.id:
            driver.current_order_id = None

        previous_total_deliveries = driver.total_deliveries or 0
        actual_delivery_minutes = _actual_delivery_minutes(order, now)

        delivery_due_at = _delivery_due_at(order)
        is_on_time = None
        if delivery_due_at:
            is_on_time = now <= delivery_due_at
        elif actual_delivery_minutes is not None and order.estimated_delivery_minutes is not None:
            # Small tolerance avoids classifying boundary deliveries as late due to clock jitter.
            is_on_time = actual_delivery_minutes <= (float(order.estimated_delivery_minutes) + 1.0)

        if is_on_time is True:
            driver.on_time_deliveries = (driver.on_time_deliveries or 0) + 1
        elif is_on_time is False:
            driver.late_deliveries = (driver.late_deliveries or 0) + 1

        if actual_delivery_minutes is not None:
            previous_avg = float(driver.average_delivery_time or 0.0)
            driver.average_delivery_time = round(
                ((previous_avg * previous_total_deliveries) + actual_delivery_minutes)
                / (previous_total_deliveries + 1),
                2,
            )

        driver.active_deliveries = max(0, (driver.active_deliveries or 0) - 1)
        driver.total_deliveries = previous_total_deliveries + 1

        if driver.active_deliveries == 0:
            driver.status = 'returning'
            available_due_at = _driver_available_due_at(order, driver)
            if not available_due_at:
                fallback_minutes = order.estimated_return_minutes or 10
                available_due_at = now + timedelta(minutes=fallback_minutes)
                order.driver_available_at = available_due_at
            driver.estimated_return_at = available_due_at
            driver.driver_available_at = available_due_at
        driver.updated_at = now

    active_routes = Route.query.filter(
        Route.driver_id == order.driver_id,
        Route.status == 'active',
    ).all()
    for route in active_routes:
        all_delivered = all(stop.order and stop.order.status == 'delivered' for stop in route.stops)
        if all_delivered:
            route.status = 'completed'
            route.completed_at = now

    db.session.commit()
    print(f'[LIFECYCLE] Order #{order.id} auto-transitioned to delivered ({source})')

    if driver and driver.active_deliveries == 0:
        print(f'[LIFECYCLE] Driver {driver.id} auto-transitioned to returning ({source})')

    return order


def apply_due_lifecycle_transitions(order_id=None, source='poll'):
    """Advance due order and driver states based on stored timestamps."""
    from app.models.driver import Driver
    from app.models.order import Order

    now = datetime.now(timezone.utc)
    changed = 0

    order_query = Order.query
    if order_id is not None:
        order_query = order_query.filter(Order.id == order_id)
    else:
        order_query = order_query.filter(Order.status.in_(['assigned', 'out_for_delivery', 'delivered']))

    orders = order_query.all()

    for order in orders:
        if order.status == 'assigned':
            pickup_due_at = _pickup_due_at(order)
            if pickup_due_at and pickup_due_at <= now:
                order.status = 'out_for_delivery'
                order.updated_at = now
                sync_route_stop_status(order, now=now)
                changed += 1
                print(f'[LIFECYCLE] Order #{order.id} auto-transitioned to out_for_delivery ({source})')

        if order.status in ('assigned', 'out_for_delivery'):
            delivery_due_at = _delivery_due_at(order)
            if delivery_due_at and delivery_due_at <= now:
                finalize_order_delivery(order, now=now, source=source)
                changed += 1

        driver = Driver.query.get(order.driver_id) if order.driver_id else None
        available_due_at = _driver_available_due_at(order, driver)
        if driver and available_due_at and available_due_at <= now:
            if _set_driver_available(driver, now, source):
                changed += 1

    if changed:
        db.session.commit()
    return changed


def stop_order_lifecycle(order_id, reason='manual_stop'):
    with _timers_lock:
        timer = _order_timers.pop(order_id, None)
    if timer:
        timer.cancel()
        print(f'[LIFECYCLE] Stopped lifecycle timer for order #{order_id} ({reason})')


def _next_due_time(order):
    from app.models.driver import Driver

    candidates = []
    if order.status == 'assigned':
        pickup_due_at = _pickup_due_at(order)
        if pickup_due_at:
            candidates.append(pickup_due_at)

    if order.status in ('assigned', 'out_for_delivery'):
        delivery_due_at = _delivery_due_at(order)
        if delivery_due_at:
            candidates.append(delivery_due_at)

    driver = Driver.query.get(order.driver_id) if order.driver_id else None
    available_due_at = _driver_available_due_at(order, driver)
    if driver and driver.status in ('returning', 'on_delivery') and available_due_at:
        candidates.append(available_due_at)

    future_candidates = [candidate for candidate in candidates if candidate is not None]
    return min(future_candidates) if future_candidates else None


def schedule_order_lifecycle(app, order_id):
    """Schedule lifecycle transitions for an active order."""
    from app.models.order import Order

    stop_order_lifecycle(order_id, reason='reschedule')

    def _tick():
        with app.app_context():
            apply_due_lifecycle_transitions(order_id=order_id, source='timer')
            order = Order.query.get(order_id)
            if not order or order.status in ('cancelled',):
                stop_order_lifecycle(order_id, reason='completed')
                return

            next_due_at = _next_due_time(order)
            if not next_due_at:
                stop_order_lifecycle(order_id, reason='no_pending_deadlines')
                return

            delay_seconds = max(1.0, (next_due_at - datetime.now(timezone.utc)).total_seconds())
            timer = threading.Timer(delay_seconds, _tick)
            timer.daemon = True
            with _timers_lock:
                _order_timers[order_id] = timer
            timer.start()

    with app.app_context():
        apply_due_lifecycle_transitions(order_id=order_id, source='schedule')
        order = Order.query.get(order_id)
        if not order or order.status not in ('assigned', 'out_for_delivery', 'delivered'):
            return

        next_due_at = _next_due_time(order)
        if not next_due_at:
            return

        delay_seconds = max(1.0, (next_due_at - datetime.now(timezone.utc)).total_seconds())

    timer = threading.Timer(delay_seconds, _tick)
    timer.daemon = True
    with _timers_lock:
        _order_timers[order_id] = timer
    timer.start()
    print(f'[LIFECYCLE] Scheduled lifecycle timer for order #{order_id} in {round(delay_seconds, 1)}s')


def restore_active_lifecycles(app):
    """Rehydrate timers for active orders after startup/reload."""
    from app.models.driver import Driver
    from app.models.order import Order

    with app.app_context():
        apply_due_lifecycle_transitions(source='startup')
        active_orders = Order.query.filter(Order.status.in_(['assigned', 'out_for_delivery'])).all()
        returning_orders = Order.query.join(Driver, Driver.id == Order.driver_id).filter(
            Order.status == 'delivered',
            Driver.status.in_(['returning', 'on_delivery']),
        ).all()
        scheduled_ids = {order.id for order in active_orders + returning_orders}

    for order_id in scheduled_ids:
        schedule_order_lifecycle(app, order_id)
