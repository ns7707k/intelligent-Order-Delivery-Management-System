"""
Heatmap API Blueprint.
Endpoints:
  GET /api/heatmap/live        - Current active orders as heatmap points
  GET /api/heatmap/predictive  - Historical order clusters for predictive hotspots

Per PRD Section B:
  - Live View: Current active orders
  - Predictive View: SQL aggregation of historical coordinates from dataset
"""

from flask import Blueprint, request, jsonify
from app import db
from app.models.order import Order
from app.utils.auth import get_current_restaurant_id, require_role
from sqlalchemy import func, text
from datetime import datetime, timezone, timedelta

heatmap_bp = Blueprint('heatmap', __name__)


@heatmap_bp.route('/live', methods=['GET'])
@require_role('restaurant_admin')
def get_live_heatmap():
    """
    Get current active orders as heatmap data points.
    Returns orders with valid coordinates that are not yet delivered/cancelled.
    """
    restaurant_id = get_current_restaurant_id()
    active_orders = Order.query.filter(
        Order.restaurant_id == restaurant_id,
        Order.status.in_(['pending', 'preparing', 'ready', 'assigned', 'out_for_delivery', 'delivered']),
        Order.latitude.isnot(None),
        Order.longitude.isnot(None)
    ).all()

    heatmap_points = [
        {
            'lat': order.latitude,
            'lng': order.longitude,
            'intensity': _get_status_intensity(order.status),
            'order_id': order.id,
            'status': order.status,
        }
        for order in active_orders
    ]

    return jsonify(heatmap_points)


@heatmap_bp.route('/predictive', methods=['GET'])
@require_role('restaurant_admin')
def get_predictive_heatmap():
    """
    Get historical order clusters for predictive heatmap.
    Uses SQL aggregation to cluster historical coordinates.
    Per PRD Section B.3: Optimized SQL aggregation queries to cluster
    actual historical coordinates from the Amazon dataset.
    """
    restaurant_id = get_current_restaurant_id()

    # Time window for historical data (default: last 30 days)
    days = request.args.get('days', 30, type=int)
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    # SQL aggregation: cluster orders by grid cells (~0.001 degree ≈ 100m)
    grid_size = 0.005  # ~500m grid cells for meaningful clusters

    clusters = db.session.query(
        func.round(Order.latitude / grid_size, 0).label('lat_grid'),
        func.round(Order.longitude / grid_size, 0).label('lng_grid'),
        func.avg(Order.latitude).label('avg_lat'),
        func.avg(Order.longitude).label('avg_lng'),
        func.count(Order.id).label('order_count')
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.latitude.isnot(None),
        Order.longitude.isnot(None),
        Order.status.in_(['delivered', 'ready', 'preparing', 'pending']),
        Order.created_at >= cutoff_date
    ).group_by(
        func.round(Order.latitude / grid_size, 0),
        func.round(Order.longitude / grid_size, 0)
    ).having(
        func.count(Order.id) >= 1
    ).all()

    if not clusters:
        # Fallback: return all historical orders with coordinates
        all_orders = Order.query.filter(
            Order.restaurant_id == restaurant_id,
            Order.latitude.isnot(None),
            Order.longitude.isnot(None)
        ).all()

        heatmap_points = [
            {
                'lat': order.latitude,
                'lng': order.longitude,
                'intensity': 0.5,
            }
            for order in all_orders
        ]
        return jsonify(heatmap_points)

    # Normalize intensity based on max count
    max_count = max(c.order_count for c in clusters)

    heatmap_points = [
        {
            'lat': float(c.avg_lat),
            'lng': float(c.avg_lng),
            'intensity': float(c.order_count) / max_count if max_count > 0 else 0.5,
            'order_count': c.order_count,
        }
        for c in clusters
    ]

    return jsonify(heatmap_points)


def _get_status_intensity(status):
    """Map order status to heatmap intensity value."""
    intensity_map = {
        'pending': 0.4,
        'preparing': 0.7,
        'ready': 1.0,
        'assigned': 0.95,
        'out_for_delivery': 0.85,
        'delivered': 0.55,
    }
    return intensity_map.get(status, 0.5)
