"""
Orders API Blueprint.
Endpoints:
  GET    /api/orders          - List all orders (with optional status filter)
  GET    /api/orders/<id>     - Get order by ID
  POST   /api/orders          - Create a new order
  GET    /api/orders/geocode  - Geocode an address to lat/lng (Nominatim)
  PATCH  /api/orders/<id>     - Update order status (triggers route optimization on 'ready')
  DELETE /api/orders/<id>     - Cancel/delete an order
"""

import threading
from flask import Blueprint, request, jsonify
from app import db
from app.models.order import Order, OrderItem
from app.models.driver import Driver
from app.models.restaurant import Restaurant
from app.services.order_lifecycle import apply_due_lifecycle_transitions, finalize_order_delivery, schedule_order_lifecycle, sync_route_stop_status
from app.services.route_optimizer import trigger_route_optimization
from app.services.driver_location_simulator import stop_driver_location_simulation
from app.utils.auth import get_current_restaurant_id, require_role
from app.utils.geocoder import get_geocoding_details
from datetime import datetime, timezone, timedelta

orders_bp = Blueprint('orders', __name__)


def _clear_stale_ready_assignments(restaurant_id):
    """Detach stale driver links from ready orders when the driver is already available."""
    now = datetime.now(timezone.utc)
    stale_orders = Order.query.join(Driver, Driver.id == Order.driver_id).filter(
        Order.restaurant_id == restaurant_id,
        Order.status == 'ready',
        Driver.status == 'available',
    ).all()

    if not stale_orders:
        return

    for order in stale_orders:
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

    db.session.commit()


@orders_bp.route('', methods=['GET'])
@require_role('restaurant_admin')
def get_orders():
    """Get all orders, optionally filtered by status."""
    restaurant_id = get_current_restaurant_id()
    _clear_stale_ready_assignments(restaurant_id)
    apply_due_lifecycle_transitions(source='orders_get')
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    query = Order.query.filter(Order.restaurant_id == restaurant_id).order_by(Order.created_at.desc())

    if status and status != 'all':
        query = query.filter(Order.status == status)

    orders = query.limit(per_page).offset((page - 1) * per_page).all()
    return jsonify([order.to_dict() for order in orders])


@orders_bp.route('/<int:order_id>', methods=['GET'])
@require_role('restaurant_admin')
def get_order(order_id):
    """Get a single order by ID."""
    restaurant_id = get_current_restaurant_id()
    _clear_stale_ready_assignments(restaurant_id)
    apply_due_lifecycle_transitions(order_id=order_id, source='order_get')
    order = Order.query.filter(
        Order.id == order_id,
        Order.restaurant_id == restaurant_id,
    ).first_or_404(description=f'Order {order_id} not found')
    return jsonify(order.to_dict())




@orders_bp.route('/geocode', methods=['GET'])
@require_role('restaurant_admin')
def geocode_address():
    """
    Geocode a text address to lat/lng using Nominatim (free, no API key).
    
    Query Parameters:
      address: The address to geocode (e.g., "10 Downing Street, London")
    
    Returns:
      {
        "lat": 51.5034,
        "lng": -0.1276,
        "display_address": "10 Downing Street, London, England",
        "distance_km": 2.8,
        "delivery_fee": 3.39,
        "eta_minutes": 6
      }
    
    If address not found, returns:
      { "error": "Address not found — please check and try again." }
    """
    address = request.args.get('address', '').strip()
    
    if not address:
        return jsonify({'error': 'Address parameter is required'}), 400
    
    # Get geocoding details with restaurant context for distance/fee/ETA
    restaurant_id = get_current_restaurant_id()
    restaurant = Restaurant.query.get(restaurant_id)
    result = get_geocoding_details(address, restaurant)
    
    if not result or 'lat' not in result:
        return jsonify({'error': 'Address not found — please check and try again.'}), 404
    
    return jsonify(result), 200


@orders_bp.route('', methods=['POST'])
@require_role('restaurant_admin')
def create_order():
    """Create a new order with items."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Validate required fields
    required = ['customer_name', 'customer_phone', 'delivery_address']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    # Create order
    payment_method = data.get('payment_method', 'Card').upper()
    if payment_method in ['CARD', 'DEBIT', 'DIGITAL']:
        payment_status = 'Paid'
    else:
        payment_status = 'Pending'

    # Resolve geocoding and compute distance-based fees if possible
    restaurant = Restaurant.query.get(get_current_restaurant_id())
    geo = None
    try:
        geo = get_geocoding_details(data['delivery_address'], restaurant)
    except Exception:
        geo = None

    delivery_fee_val = float(data.get('deliveryFee', data.get('delivery_fee', 4.99)))
    platform_fee_val = 0.0
    driver_fee_val = 0.0
    if geo and geo.get('delivery_fee') is not None:
        delivery_fee_val = float(geo.get('delivery_fee'))
        platform_fee_val = float(geo.get('platform_fee', round(delivery_fee_val * 0.2, 2)))
        driver_fee_val = float(geo.get('driver_fee', round(delivery_fee_val * 0.8, 2)))

    order = Order(
        customer_name=data['customer_name'],
        customer_phone=data['customer_phone'],
        customer_email=data.get('customer_email', ''),
        delivery_address=data['delivery_address'],
        notes=data.get('notes', ''),
        payment_method=payment_method,
        payment_status=payment_status,
        status='pending',
        subtotal=float(data.get('subtotal', 0)),
        tax=float(data.get('tax', 0)),
        delivery_fee=delivery_fee_val,
        platform_fee=platform_fee_val,
        driver_fee=driver_fee_val,
        total=float(data.get('total', 0)),
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        restaurant_id=get_current_restaurant_id(),
        estimated_delivery=datetime.now(timezone.utc) + timedelta(minutes=30),
    )

    # If geo resolved lat/lng not provided by client, populate
    if (not order.latitude or not order.longitude) and geo:
        order.latitude = geo.get('lat')
        order.longitude = geo.get('lng')

    # Recalculate total if subtotal/tax provided
    try:
        order.total = float(order.subtotal or 0) + float(order.tax or 0) + float(order.delivery_fee or 0)
    except Exception:
        order.total = float(data.get('total', 0))

    db.session.add(order)
    db.session.flush()  # Get the ID before adding items

    # Add order items
    items = data.get('items', [])
    for item_data in items:
        item = OrderItem(
            order_id=order.id,
            name=item_data.get('name', ''),
            quantity=int(item_data.get('quantity', 1)),
            price=float(item_data.get('price', 0)),
            notes=item_data.get('notes', ''),
        )
        db.session.add(item)

    db.session.commit()
    return jsonify(order.to_dict()), 201


@orders_bp.route('/<int:order_id>', methods=['PATCH'])
@require_role('restaurant_admin')
def update_order_status(order_id):
    """
    Update an order's status.
    Per PRD Section C.4: When status changes to 'ready', the route optimizer
    is triggered dynamically and instantly.
    """
    restaurant_id = get_current_restaurant_id()
    order = Order.query.filter(
        Order.id == order_id,
        Order.restaurant_id == restaurant_id,
    ).first_or_404(description=f'Order {order_id} not found')
    data = request.get_json()

    if not data or 'status' not in data:
        return jsonify({'error': 'Status field is required'}), 400

    new_status = data['status']
    valid_statuses = ['pending', 'preparing', 'ready', 'assigned', 'out_for_delivery', 'delivered', 'cancelled']
    if new_status not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400

    old_status = order.status
    order.status = new_status
    order.updated_at = datetime.now(timezone.utc)
    sync_route_stop_status(order, now=order.updated_at)

    # Mark payment as paid when delivered
    if new_status == 'delivered':
        order.payment_status = 'Paid'

    db.session.commit()

    # PRD: Trigger route optimization when order becomes "ready"
    # This assigns a driver and creates an optimized route, then
    # automatically transitions the order to "assigned"
    allocation_result = None
    if new_status == 'ready' and (old_status != 'ready' or order.driver_id is None):
        try:
            allocation_result = trigger_route_optimization(order.id)
        except Exception as e:
            # Don't fail the status update if optimization fails
            print(f'Route optimization warning: {e}')

    if new_status == 'delivered' and order.driver_id:
        try:
            finalize_order_delivery(order, now=datetime.now(timezone.utc), source='manual_patch')
            from flask import current_app
            schedule_order_lifecycle(current_app._get_current_object(), order.id)
        except Exception as e:
            print(f'Driver return lifecycle warning: {e}')

    if new_status == 'cancelled' and order.driver_id:
        try:
            driver = Driver.query.get(order.driver_id)
            if driver:
                stop_driver_location_simulation(driver.id, reason=f'order_{order.id}_cancelled')
                if driver.current_order_id == order.id:
                    driver.current_order_id = None
                    db.session.commit()
        except Exception as e:
            print(f'Driver cancellation lifecycle warning: {e}')

    db.session.refresh(order)
    response = order.to_dict()
    if allocation_result and response.get('status') == 'assigned':
        response.update({
            'order_id': allocation_result.get('order_id', order.id),
            'assigned_driver': {
                'id': allocation_result.get('assigned_driver', {}).get('id'),
                'name': allocation_result.get('assigned_driver', {}).get('name'),
                'vehicle_type': allocation_result.get('assigned_driver', {}).get('vehicle_type'),
                'current_location': {
                    'lat': order.driver.current_latitude if order.driver else None,
                    'lng': order.driver.current_longitude if order.driver else None,
                },
                'owner_type': allocation_result.get('assigned_driver', {}).get('owner_type'),
            },
            'eta': allocation_result.get('eta', {}),
            'assignment_score': allocation_result.get('assignment_score'),
            'assignment_method': allocation_result.get('assignment_method', 'scored'),
        })
    elif allocation_result:
        response['allocation'] = allocation_result
    return jsonify(response)


@orders_bp.route('/<int:order_id>', methods=['DELETE'])
@require_role('restaurant_admin')
def delete_order(order_id):
    """Cancel/delete an order."""
    restaurant_id = get_current_restaurant_id()
    order = Order.query.filter(
        Order.id == order_id,
        Order.restaurant_id == restaurant_id,
    ).first_or_404(description=f'Order {order_id} not found')
    if order.driver_id:
        driver = Driver.query.get(order.driver_id)
        if driver:
            stop_driver_location_simulation(driver.id, reason=f'order_{order.id}_deleted')
            if driver.current_order_id == order.id:
                driver.current_order_id = None
    order.status = 'cancelled'
    order.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'message': f'Order {order_id} cancelled', 'order': order.to_dict()})
