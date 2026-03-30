"""
Drivers API Blueprint.
Endpoints:
  GET    /api/drivers              - List all drivers
  GET    /api/drivers/available    - Get available drivers
  GET    /api/drivers/<id>         - Get driver by ID
  POST   /api/drivers              - Create a new driver
  PUT    /api/drivers/<id>         - Update driver
  PATCH  /api/drivers/<id>/status  - Update driver status
  DELETE /api/drivers/<id>         - Delete driver
"""

from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from app import db
from app.models.driver import Driver
from app.models.order import Order
from app.models.route import Route
from app.models.user import User
from app.services.driver_location_simulator import stop_driver_location_simulation
from app.utils.auth import get_current_restaurant_id, require_role
from datetime import datetime, timezone

drivers_bp = Blueprint('drivers', __name__)


def _heal_stale_driver_states():
    """Safety net: transition stale returning/on_delivery drivers back to available."""
    now = datetime.now(timezone.utc)
    stale = Driver.query.filter(
        Driver.status.in_(['returning', 'on_delivery']),
        Driver.driver_available_at.isnot(None),
        Driver.driver_available_at <= now,
    ).all()

    changed = 0
    for driver in stale:
        driver.status = 'available'
        driver.active_deliveries = 0
        driver.estimated_delivery_at = None
        driver.estimated_return_at = None
        driver.driver_available_at = None
        driver.current_latitude = None
        driver.current_longitude = None
        changed += 1

    if changed:
        db.session.commit()
        print(f'[HEAL] Transitioned {changed} stale driver(s) to available')


@drivers_bp.route('', methods=['GET'])
@require_role('restaurant_admin')
def get_drivers():
    """Get all drivers."""
    _heal_stale_driver_states()
    status = request.args.get('status')
    restaurant_id = get_current_restaurant_id()
    query = Driver.query.filter(
        or_(Driver.restaurant_id == restaurant_id, Driver.restaurant_id.is_(None))
    ).order_by(Driver.name)

    if status and status != 'all':
        query = query.filter(Driver.status == status)

    drivers = query.all()
    return jsonify([driver.to_dict() for driver in drivers])


@drivers_bp.route('/available', methods=['GET'])
@require_role('restaurant_admin')
def get_available_drivers():
    """Get all available drivers (for route assignment)."""
    _heal_stale_driver_states()
    restaurant_id = get_current_restaurant_id()
    drivers = Driver.query.filter(
        Driver.status == 'available',
        or_(Driver.restaurant_id == restaurant_id, Driver.restaurant_id.is_(None)),
    ).order_by(Driver.name).all()
    return jsonify([driver.to_dict() for driver in drivers])


@drivers_bp.route('/<string:driver_id>', methods=['GET'])
@require_role('restaurant_admin')
def get_driver(driver_id):
    """Get a single driver by ID."""
    restaurant_id = get_current_restaurant_id()
    driver = Driver.query.filter(
        Driver.id == driver_id,
        or_(Driver.restaurant_id == restaurant_id, Driver.restaurant_id.is_(None)),
    ).first_or_404(description=f'Driver {driver_id} not found')

    result = driver.to_dict()

    # Include delivery history (recent assigned orders)
    from app.models.order import Order
    recent_orders = Order.query.filter(
        Order.driver_id == driver_id
    ).order_by(Order.created_at.desc()).limit(10).all()

    result['deliveryHistory'] = [
        {
            'id': o.id,
            'customer': o.customer_name,
            'address': o.delivery_address,
            'date': o.created_at.isoformat() if o.created_at else None,
            'status': o.status,
            'amount': o.total,
        }
        for o in recent_orders
    ]

    # Performance stats
    result['performance'] = {
        'onTimeDeliveries': driver.on_time_deliveries,
        'lateDeliveries': driver.late_deliveries,
        'averageDeliveryTime': driver.average_delivery_time,
    }

    return jsonify(result)


@drivers_bp.route('', methods=['POST'])
@require_role('restaurant_admin')
def create_driver():
    """Create a new driver."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['name', 'phone']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    # Auto-generate driver ID
    count = Driver.query.count()
    driver_id = data.get('id', f'DRV{str(count + 1).zfill(3)}')

    # Ensure unique ID
    while Driver.query.get(driver_id):
        count += 1
        driver_id = f'DRV{str(count + 1).zfill(3)}'

    # Auto-assign restaurant_id if there's a registered restaurant
    rest_id = get_current_restaurant_id()

    driver = Driver(
        id=driver_id,
        name=data['name'],
        phone=data['phone'],
        email=data.get('email', ''),
        vehicle_type=data.get('vehicle_type', 'Motorcycle'),
        vehicle_number=data.get('vehicle_number', ''),
        license_number=data.get('license_number', ''),
        address=data.get('address', ''),
        emergency_contact=data.get('emergency_contact', ''),
        owner_type=data.get('owner_type', 'restaurant'),
        restaurant_id=data.get('restaurant_id', rest_id),
        is_platform_driver=bool(data.get('is_platform_driver', False)),
        status=data.get('status', 'available'),
        current_latitude=data.get('current_latitude'),
        current_longitude=data.get('current_longitude'),
    )

    if driver.owner_type == 'platform' or driver.is_platform_driver:
        driver.owner_type = 'platform'
        driver.is_platform_driver = True
        driver.restaurant_id = None
    else:
        driver.owner_type = 'restaurant'
        driver.is_platform_driver = False

    db.session.add(driver)
    db.session.commit()
    return jsonify(driver.to_dict()), 201


@drivers_bp.route('/<string:driver_id>', methods=['PUT'])
@require_role('restaurant_admin')
def update_driver(driver_id):
    """Update a driver's details."""
    restaurant_id = get_current_restaurant_id()
    driver = Driver.query.filter(
        Driver.id == driver_id,
        or_(Driver.restaurant_id == restaurant_id, Driver.restaurant_id.is_(None)),
    ).first_or_404(description=f'Driver {driver_id} not found')
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    updatable_fields = [
        'name', 'phone', 'email', 'vehicle_type', 'vehicle_number',
        'license_number', 'address', 'emergency_contact', 'status',
        'owner_type', 'restaurant_id', 'is_platform_driver',
        'current_latitude', 'current_longitude'
    ]

    for field in updatable_fields:
        if field in data:
            setattr(driver, field, data[field])

    if driver.owner_type == 'platform' or driver.is_platform_driver:
        driver.owner_type = 'platform'
        driver.is_platform_driver = True
        driver.restaurant_id = None
    else:
        driver.owner_type = 'restaurant'
        driver.is_platform_driver = False

    driver.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(driver.to_dict())


@drivers_bp.route('/<string:driver_id>/status', methods=['PATCH'])
@require_role('restaurant_admin')
def update_driver_status(driver_id):
    """Update a driver's operational status."""
    restaurant_id = get_current_restaurant_id()
    driver = Driver.query.filter(
        Driver.id == driver_id,
        or_(Driver.restaurant_id == restaurant_id, Driver.restaurant_id.is_(None)),
    ).first_or_404(description=f'Driver {driver_id} not found')
    data = request.get_json()

    if not data or 'status' not in data:
        return jsonify({'error': 'Status field is required'}), 400

    valid_statuses = ['available', 'on_delivery', 'returning', 'offline']
    if data['status'] not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400

    driver.status = data['status']
    driver.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(driver.to_dict())


@drivers_bp.route('/<string:driver_id>', methods=['DELETE'])
@require_role('restaurant_admin')
def delete_driver(driver_id):
    """Delete a driver and clean linked auth/assignment records."""
    restaurant_id = get_current_restaurant_id()
    driver = Driver.query.filter(
        Driver.id == driver_id,
        or_(Driver.restaurant_id == restaurant_id, Driver.restaurant_id.is_(None)),
    ).first_or_404(description=f'Driver {driver_id} not found')

    # Stop any live simulation loop tied to this driver.
    try:
        stop_driver_location_simulation(driver.id, reason='driver_deleted')
    except Exception:
        pass

    # Remove login account(s) linked to this driver.
    linked_users = User.query.filter(User.driver_id == driver.id).all()
    for user in linked_users:
        db.session.delete(user)

    # Release active/assigned orders so they can be reassigned.
    linked_orders = Order.query.filter(Order.driver_id == driver.id).all()
    for order in linked_orders:
        if order.status in ('assigned', 'out_for_delivery'):
            order.status = 'ready'
        order.driver_id = None
        order.assigned_at = None
        order.updated_at = datetime.now(timezone.utc)

    # Remove routes owned by this driver (route_stops cascade on delete).
    linked_routes = Route.query.filter(Route.driver_id == driver.id).all()
    for route in linked_routes:
        db.session.delete(route)

    db.session.delete(driver)
    db.session.commit()
    return jsonify({'message': f'Driver {driver_id} deleted'})
