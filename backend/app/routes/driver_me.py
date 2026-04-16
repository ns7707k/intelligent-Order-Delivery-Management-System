"""Driver self-service API endpoints."""

import threading
from datetime import datetime, timezone, timedelta

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required

from app import db
from app.models.driver import Driver
from app.models.order import Order
from app.models.restaurant import Restaurant
from app.models.settings import Settings
from app.services.driver_location_simulator import stop_driver_location_simulation
from app.utils.auth import get_current_driver_id, require_role
from app.utils.haversine import haversine


driver_me_bp = Blueprint('driver_me', __name__)


def _release_driver_to_available(app, driver_id):
    with app.app_context():
        driver = Driver.query.get(driver_id)
        if not driver:
            return
        if driver.status == 'returning':
            driver.status = 'available'
            driver.driver_available_at = None
            driver.current_order_id = None
            driver.updated_at = datetime.now(timezone.utc)
            db.session.commit()


def _current_driver_or_404():
    driver_id = get_current_driver_id()
    if not driver_id:
        return None, (jsonify({'error': 'Driver context missing'}), 400)
    driver = Driver.query.get(driver_id)
    if not driver:
        return None, (jsonify({'error': 'Driver not found'}), 404)
    return driver, None


def _serialize_driver_order(order, driver):
    """Serialize order enriched with pickup metadata for driver map views."""
    payload = order.to_dict()

    restaurant = None
    if payload.get('restaurant_id'):
        restaurant = Restaurant.query.get(payload.get('restaurant_id'))
    if not restaurant and driver.restaurant_id:
        restaurant = Restaurant.query.get(driver.restaurant_id)

    payload['pickup_latitude'] = restaurant.latitude if restaurant else None
    payload['pickup_longitude'] = restaurant.longitude if restaurant else None
    payload['pickup_address'] = restaurant.address if restaurant else None
    payload['pickup_name'] = restaurant.name if restaurant else None

    return payload


@driver_me_bp.route('/me', methods=['GET'])
@jwt_required()
@require_role('driver')
def get_me():
    driver, err = _current_driver_or_404()
    if err:
        return err

    active_order = None
    if driver.current_order_id:
        order = Order.query.get(driver.current_order_id)
        if order and order.driver_id == driver.id and order.status in ('assigned', 'out_for_delivery'):
            active_order = _serialize_driver_order(order, driver)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    delivered_today = Order.query.filter(
        Order.driver_id == driver.id,
        Order.status == 'delivered',
        Order.updated_at >= today_start,
    ).all()
    earnings_today = round(sum(
        float((order.driver_fee if (order.driver_fee or 0) > 0 else order.delivery_fee) or 0)
        for order in delivered_today
    ), 2)

    driver_payload = driver.to_dict()
    driver_payload['earnings_today'] = earnings_today

    return jsonify({
        'driver': driver_payload,
        'active_order': active_order,
    })


@driver_me_bp.route('/me/orders', methods=['GET'])
@jwt_required()
@require_role('driver')
def get_my_orders():
    driver, err = _current_driver_or_404()
    if err:
        return err

    orders = Order.query.filter(Order.driver_id == driver.id).order_by(Order.created_at.desc()).all()
    return jsonify([_serialize_driver_order(o, driver) for o in orders])


@driver_me_bp.route('/me/status', methods=['PATCH'])
@jwt_required()
@require_role('driver')
def update_my_status():
    driver, err = _current_driver_or_404()
    if err:
        return err

    data = request.get_json() or {}
    status = data.get('status')
    if status not in ('available', 'offline'):
        return jsonify({'error': 'Status must be available or offline'}), 400

    if status == 'offline' and driver.current_order_id:
        return jsonify({'error': 'Cannot go offline during active delivery'}), 400

    if status == 'available':
        if driver.current_latitude is None or driver.current_longitude is None:
            return jsonify({'error': 'You must share your location before going online.'}), 400

    driver.status = status
    if status == 'offline':
        driver.current_latitude = None
        driver.current_longitude = None
    driver.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(driver.to_dict())


@driver_me_bp.route('/me/location', methods=['PATCH'])
@jwt_required()
@require_role('driver')
def update_my_location():
    driver, err = _current_driver_or_404()
    if err:
        return err

    data = request.get_json() or {}
    lat = data.get('latitude')
    lng = data.get('longitude')
    if lat is None or lng is None:
        return jsonify({'error': 'latitude and longitude are required'}), 400

    driver.current_latitude = float(lat)
    driver.current_longitude = float(lng)
    driver.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(driver.to_dict())


@driver_me_bp.route('/me/orders/<int:order_id>', methods=['GET'])
@jwt_required()
@require_role('driver')
def get_my_order(order_id):
    driver, err = _current_driver_or_404()
    if err:
        return err

    order = Order.query.filter(Order.id == order_id, Order.driver_id == driver.id).first()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify(_serialize_driver_order(order, driver))


@driver_me_bp.route('/me/orders/<int:order_id>/deliver', methods=['PATCH'])
@jwt_required()
@require_role('driver')
def mark_delivered(order_id):
    driver, err = _current_driver_or_404()
    if err:
        return err

    order = Order.query.filter(Order.id == order_id, Order.driver_id == driver.id).first()
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    allow_setting = Settings.query.filter_by(
        key='allow_driver_self_delivery',
        restaurant_id=driver.restaurant_id,
    ).first()
    allow_self = True if allow_setting is None else allow_setting.get_typed_value() is True
    if not allow_self:
        return jsonify({'error': 'Awaiting restaurant confirmation'}), 403

    now = datetime.now(timezone.utc)
    restaurant = Restaurant.query.get(driver.restaurant_id)
    if not restaurant or restaurant.latitude is None or restaurant.longitude is None:
        return jsonify({'error': 'Restaurant depot location not configured'}), 400

    customer_lat = order.latitude
    customer_lng = order.longitude
    if customer_lat is None or customer_lng is None:
        return jsonify({'error': 'Order coordinates missing'}), 400

    distance_km = haversine(customer_lat, customer_lng, restaurant.latitude, restaurant.longitude)
    avg_speed = restaurant.avg_speed_kmh or 30
    return_trip_minutes = max(1, round((distance_km / avg_speed) * 60))

    order.status = 'delivered'
    order.payment_status = 'Paid'
    order.updated_at = now

    driver.active_deliveries = max(0, (driver.active_deliveries or 0) - 1)
    driver.status = 'returning'
    driver.driver_available_at = now + timedelta(minutes=return_trip_minutes)
    driver.current_order_id = None
    # Update driver location to the delivery point so next assignment uses correct position
    driver.current_latitude = customer_lat
    driver.current_longitude = customer_lng
    driver.updated_at = now

    stop_driver_location_simulation(driver.id, reason=f'driver_self_delivered_{order.id}')
    db.session.commit()

    timer = threading.Timer(
        return_trip_minutes * 60,
        _release_driver_to_available,
        args=(current_app._get_current_object(), driver.id),
    )
    timer.daemon = True
    timer.start()

    return jsonify({
        'message': 'Order marked delivered',
        'order': order.to_dict(),
        'driver': driver.to_dict(),
        'return_trip_minutes': return_trip_minutes,
    })


@driver_me_bp.route('/me/orders/<int:order_id>/collect_cash', methods=['PATCH'])
@jwt_required()
@require_role('driver')
def collect_cash(order_id):
    driver, err = _current_driver_or_404()
    if err:
        return err

    order = Order.query.filter(Order.id == order_id, Order.driver_id == driver.id).first()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if order.payment_method != 'CASH':
        return jsonify({'error': 'Order is not Cash on Delivery'}), 400
    if order.payment_status == 'Paid':
        return jsonify({'message': 'Payment already collected'}), 200

    order.payment_status = 'Paid'
    order.updated_at = datetime.now(timezone.utc)

    from app.services.order_lifecycle import sync_route_stop_status
    sync_route_stop_status(order)
    db.session.commit()
    return jsonify({'message': 'Payment marked as collected', 'order': order.to_dict()})
