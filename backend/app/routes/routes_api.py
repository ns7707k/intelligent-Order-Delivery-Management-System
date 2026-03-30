"""
Routes Optimization API Blueprint.
Endpoints:
  POST /api/routes/optimize   - Trigger route optimization for given orders
  GET  /api/routes/active     - Get all active routes

Per PRD Section C:
  - Google OR-Tools VRP solver
  - Path Cheapest Arc first solution strategy
  - Guided Local Search metaheuristic
  - Assigns closest driver to food waiting longest
"""

from flask import Blueprint, request, jsonify
from app import db
from app.models.route import Route, RouteStop
from app.models.order import Order
from app.models.driver import Driver
from app.services.route_optimizer import optimize_routes
from app.utils.auth import get_current_restaurant_id, require_role

routes_bp = Blueprint('routes', __name__)


@routes_bp.route('/optimize', methods=['POST'])
@require_role('restaurant_admin')
def optimize_delivery_routes():
    """
    Trigger route optimization for specified order IDs.
    Called by frontend's optimizeRoute(orderIds) API.
    Also triggered automatically when an order status changes to 'ready'.
    """
    restaurant_id = get_current_restaurant_id()

    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    order_ids = data.get('orderIds', [])
    single_order_id = data.get('orderId')
    if single_order_id and not order_ids:
        order_ids = [single_order_id]
    if not order_ids:
        # If no specific IDs, optimize all "ready" orders
        ready_orders = Order.query.filter(
            Order.status == 'ready',
            Order.restaurant_id == restaurant_id,
        ).all()
        order_ids = [o.id for o in ready_orders]

    if not order_ids:
        return jsonify({'message': 'No orders to optimize', 'routes': []}), 200

    try:
        result = optimize_routes(order_ids)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Optimization failed: {str(e)}'}), 500


@routes_bp.route('/active', methods=['GET'])
@require_role('restaurant_admin')
def get_active_routes():
    """Get all currently active routes with their stops."""
    restaurant_id = get_current_restaurant_id()
    routes = Route.query.filter(
        Route.status == 'active',
        Route.restaurant_id == restaurant_id,
    ).order_by(Route.created_at.desc()).all()

    return jsonify([route.to_dict() for route in routes])


@routes_bp.route('', methods=['GET'])
@require_role('restaurant_admin')
def get_all_routes():
    """Get all routes (active and completed)."""
    status = request.args.get('status')
    restaurant_id = get_current_restaurant_id()
    query = Route.query.filter(Route.restaurant_id == restaurant_id).order_by(Route.created_at.desc())

    if status and status != 'all':
        query = query.filter(Route.status == status)

    routes = query.all()
    return jsonify([route.to_dict() for route in routes])


@routes_bp.route('/<string:route_id>', methods=['GET'])
@require_role('restaurant_admin')
def get_route(route_id):
    """Get a specific route by ID."""
    restaurant_id = get_current_restaurant_id()
    route = Route.query.filter(
        Route.id == route_id,
        Route.restaurant_id == restaurant_id,
    ).first_or_404(description=f'Route {route_id} not found')
    return jsonify(route.to_dict())


@routes_bp.route('/<string:route_id>/complete', methods=['POST'])
@require_role('restaurant_admin')
def complete_route(route_id):
    """Mark a route as completed."""
    restaurant_id = get_current_restaurant_id()
    route = Route.query.filter(
        Route.id == route_id,
        Route.restaurant_id == restaurant_id,
    ).first_or_404(description=f'Route {route_id} not found')
    from datetime import datetime, timezone
    route.status = 'completed'
    route.completed_at = datetime.now(timezone.utc)
    route.updated_at = datetime.now(timezone.utc)

    # Free up the driver
    if route.driver:
        route.driver.active_deliveries = max(0, route.driver.active_deliveries - 1)
        if route.driver.active_deliveries == 0:
            route.driver.status = 'available'
            route.driver.estimated_delivery_at = None
            route.driver.estimated_return_at = None

    db.session.commit()
    return jsonify(route.to_dict())
