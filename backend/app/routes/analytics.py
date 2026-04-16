"""
Analytics API Blueprint.
Endpoints:
  GET /api/analytics/summary     - Revenue, orders, drivers summary
  GET /api/analytics/orders      - Order performance metrics
  GET /api/analytics/drivers     - Driver performance metrics
  GET /api/analytics/top-items   - Top selling items
  GET /api/analytics/hourly      - Hourly order distribution

Matches the frontend Analytics component mock data structure.
"""

from flask import Blueprint, request, jsonify
from app import db
from app.models.order import Order, OrderItem
from app.models.driver import Driver
from app.models.settings import Settings, DEFAULT_SETTINGS
from app.utils.auth import get_current_restaurant_id, require_role
from sqlalchemy import func, case, extract
from datetime import datetime, timezone, timedelta

analytics_bp = Blueprint('analytics', __name__)


def _get_date_range(time_range):
    """Convert time range string to start date."""
    now = datetime.now(timezone.utc)
    ranges = {
        'today': now.replace(hour=0, minute=0, second=0, microsecond=0),
        '7days': now - timedelta(days=7),
        '30days': now - timedelta(days=30),
        '90days': now - timedelta(days=90),
        'year': now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0),
    }
    return ranges.get(time_range, now - timedelta(days=7))


def _analytics_enabled(restaurant_id):
    fallback = DEFAULT_SETTINGS['enable_analytics'][0]
    value = Settings.get_typed_for_restaurant('enable_analytics', restaurant_id, fallback=fallback)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ('true', '1', 'yes', 'on')
    return bool(value)


def _to_positive_int(value, fallback=1):
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        return int(fallback)
    return parsed if parsed > 0 else int(fallback)


def _retention_start(restaurant_id):
    fallback_days = _to_positive_int(DEFAULT_SETTINGS['data_retention_days'][0], fallback=90)
    configured_days = Settings.get_typed_for_restaurant(
        'data_retention_days',
        restaurant_id,
        fallback=fallback_days,
    )
    retention_days = _to_positive_int(configured_days, fallback=fallback_days)
    return datetime.now(timezone.utc) - timedelta(days=retention_days)


@analytics_bp.route('/summary', methods=['GET'])
@require_role('restaurant_admin')
def get_summary():
    """Get complete analytics summary matching the frontend Analytics component."""
    time_range = request.args.get('timeRange', '7days')
    requested_start = _get_date_range(time_range)

    restaurant_id = get_current_restaurant_id()
    if not _analytics_enabled(restaurant_id):
        return jsonify({'error': 'Analytics is disabled in settings'}), 403
    start_date = max(requested_start, _retention_start(restaurant_id))

    # Revenue metrics
    revenue_query = db.session.query(
        func.coalesce(func.sum(Order.total), 0).label('total_revenue'),
        func.count(Order.id).label('total_orders'),
        func.coalesce(func.avg(Order.total), 0).label('avg_order_value'),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date,
        Order.status != 'cancelled'
    ).first()

    # Order counts by status
    delivered_count = Order.query.filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date,
        Order.status == 'delivered'
    ).count()

    cancelled_count = Order.query.filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date,
        Order.status == 'cancelled'
    ).count()

    # Previous period for growth calculation
    period_length = (datetime.now(timezone.utc) - start_date).days or 1
    prev_start = start_date - timedelta(days=period_length)
    prev_revenue = db.session.query(
        func.coalesce(func.sum(Order.total), 0)
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= prev_start,
        Order.created_at < start_date,
        Order.status != 'cancelled'
    ).scalar() or 0

    current_revenue = float(revenue_query.total_revenue)
    growth = 0
    if prev_revenue > 0:
        growth = round(((current_revenue - prev_revenue) / prev_revenue) * 100, 1)

    # Driver metrics
    active_drivers = Driver.query.filter(
        Driver.restaurant_id == restaurant_id,
        Driver.status != 'offline',
    ).count()
    avg_driver_rating = db.session.query(
        func.coalesce(func.avg(Driver.rating), 0)
    ).filter(Driver.restaurant_id == restaurant_id).scalar()

    total_on_time = db.session.query(
        func.coalesce(func.sum(Driver.on_time_deliveries), 0)
    ).filter(Driver.restaurant_id == restaurant_id).scalar()
    total_all_deliveries = db.session.query(
        func.coalesce(func.sum(Driver.total_deliveries), 0)
    ).filter(Driver.restaurant_id == restaurant_id).scalar()
    on_time_rate = round((total_on_time / total_all_deliveries * 100), 1) if total_all_deliveries > 0 else 0

    # Top items
    top_items = db.session.query(
        OrderItem.name,
        func.sum(OrderItem.quantity).label('total_orders'),
        func.sum(OrderItem.price * OrderItem.quantity).label('total_revenue')
    ).join(
        Order, OrderItem.order_id == Order.id
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date,
        Order.status != 'cancelled'
    ).group_by(
        OrderItem.name
    ).order_by(
        func.sum(OrderItem.quantity).desc()
    ).limit(5).all()

    # Hourly distribution
    hourly = db.session.query(
        extract('hour', Order.created_at).label('hour'),
        func.count(Order.id).label('order_count')
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date,
        Order.status != 'cancelled'
    ).group_by(
        extract('hour', Order.created_at)
    ).order_by(
        extract('hour', Order.created_at)
    ).all()

    return jsonify({
        'revenue': {
            'total': round(current_revenue, 2),
            'growth': growth,
            'orders': int(revenue_query.total_orders),
            'avgOrderValue': round(float(revenue_query.avg_order_value), 2),
        },
        'orders': {
            'total': int(revenue_query.total_orders),
            'delivered': delivered_count,
            'cancelled': cancelled_count,
            'avgDeliveryTime': 28,  # Will be computed from route data
        },
        'drivers': {
            'active': active_drivers,
            'totalDeliveries': int(total_all_deliveries) if total_all_deliveries else 0,
            'avgRating': round(float(avg_driver_rating), 1) if avg_driver_rating else 0,
            'onTimeRate': on_time_rate,
        },
        'topItems': [
            {
                'name': item.name,
                'orders': int(item.total_orders),
                'revenue': round(float(item.total_revenue), 2),
            }
            for item in top_items
        ],
        'hourlyDistribution': [
            {
                'hour': f'{int(h.hour):02d}:00',
                'orders': int(h.order_count),
            }
            for h in hourly
        ],
    })


@analytics_bp.route('/orders', methods=['GET'])
@require_role('restaurant_admin')
def get_order_analytics():
    """Get detailed order performance metrics."""
    time_range = request.args.get('timeRange', '7days')
    requested_start = _get_date_range(time_range)
    restaurant_id = get_current_restaurant_id()
    if not _analytics_enabled(restaurant_id):
        return jsonify({'error': 'Analytics is disabled in settings'}), 403
    start_date = max(requested_start, _retention_start(restaurant_id))
    total = Order.query.filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date,
    ).count()
    by_status = db.session.query(
        Order.status,
        func.count(Order.id)
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date
    ).group_by(Order.status).all()

    return jsonify({
        'total': total,
        'byStatus': {status: count for status, count in by_status},
    })


@analytics_bp.route('/drivers', methods=['GET'])
@require_role('restaurant_admin')
def get_driver_analytics():
    """Get driver performance metrics."""
    restaurant_id = get_current_restaurant_id()
    if not _analytics_enabled(restaurant_id):
        return jsonify({'error': 'Analytics is disabled in settings'}), 403
    drivers = Driver.query.filter(Driver.restaurant_id == restaurant_id).all()
    return jsonify({
        'total': len(drivers),
        'available': len([d for d in drivers if d.status == 'available']),
        'on_delivery': len([d for d in drivers if d.status == 'on_delivery']),
        'returning': len([d for d in drivers if d.status == 'returning']),
        'offline': len([d for d in drivers if d.status == 'offline']),
        'avgRating': round(sum(d.rating for d in drivers) / len(drivers), 1) if drivers else 0,
        'topDrivers': [
            d.to_summary_dict()
            for d in sorted(drivers, key=lambda x: x.total_deliveries, reverse=True)[:5]
        ],
    })


@analytics_bp.route('/top-items', methods=['GET'])
@require_role('restaurant_admin')
def get_top_items():
    """Get top selling items."""
    restaurant_id = get_current_restaurant_id()
    if not _analytics_enabled(restaurant_id):
        return jsonify({'error': 'Analytics is disabled in settings'}), 403
    time_range = request.args.get('timeRange', '7days')
    requested_start = _get_date_range(time_range)
    start_date = max(requested_start, _retention_start(restaurant_id))
    limit = request.args.get('limit', 10, type=int)

    items = db.session.query(
        OrderItem.name,
        func.sum(OrderItem.quantity).label('total_quantity'),
        func.sum(OrderItem.price * OrderItem.quantity).label('total_revenue')
    ).join(
        Order, OrderItem.order_id == Order.id
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date,
        Order.status != 'cancelled'
    ).group_by(
        OrderItem.name
    ).order_by(
        func.sum(OrderItem.quantity).desc()
    ).limit(limit).all()

    return jsonify([
        {
            'name': item.name,
            'orders': int(item.total_quantity),
            'revenue': round(float(item.total_revenue), 2),
        }
        for item in items
    ])


@analytics_bp.route('/hourly', methods=['GET'])
@require_role('restaurant_admin')
def get_hourly_distribution():
    """Get hourly order distribution."""
    restaurant_id = get_current_restaurant_id()
    if not _analytics_enabled(restaurant_id):
        return jsonify({'error': 'Analytics is disabled in settings'}), 403
    time_range = request.args.get('timeRange', '7days')
    requested_start = _get_date_range(time_range)
    start_date = max(requested_start, _retention_start(restaurant_id))

    hourly = db.session.query(
        extract('hour', Order.created_at).label('hour'),
        func.count(Order.id).label('count')
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_date,
        Order.status != 'cancelled'
    ).group_by(
        extract('hour', Order.created_at)
    ).order_by(
        extract('hour', Order.created_at)
    ).all()

    return jsonify([
        {'hour': f'{int(h.hour):02d}:00', 'orders': int(h.count)}
        for h in hourly
    ])
