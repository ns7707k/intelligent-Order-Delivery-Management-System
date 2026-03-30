"""
Restaurant API Blueprint.
Single-tenant: one restaurant per system instance.
Endpoints:
  GET    /api/restaurants          - List all restaurants (public)
  GET    /api/restaurants/<id>     - Get single restaurant by ID (public)
  GET    /api/restaurant           - Get restaurant profile (auth required)
  POST   /api/restaurant           - Register restaurant (first-time setup)
  PUT    /api/restaurant           - Update restaurant profile
"""

from flask import Blueprint, request, jsonify
from app import db
from app.models.restaurant import Restaurant
from app.utils.auth import get_current_restaurant_id, require_role
from app.utils.geocoder import get_geocoding_details
from datetime import datetime, timezone

restaurant_bp = Blueprint('restaurant', __name__)
public_restaurants_bp = Blueprint('public_restaurants', __name__)


def _to_float_or_none(value):
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _valid_coords(lat, lng):
    return (
        lat is not None and lng is not None
        and -90 <= lat <= 90
        and -180 <= lng <= 180
    )


def _get_restaurant():
    """Helper: get restaurant row scoped to current token."""
    restaurant_id = get_current_restaurant_id()
    if not restaurant_id:
        return None
    return Restaurant.query.get(restaurant_id)


def _public_info(r):
    return {
        'id': r.id,
        'name': r.name,
        'address': r.address,
        'phone': r.phone,
        'email': r.email,
        'latitude': r.latitude,
        'longitude': r.longitude,
        'opens_at': r.opens_at,
        'closes_at': r.closes_at,
    }


@public_restaurants_bp.route('', methods=['GET'])
def list_restaurants():
    """List all restaurants with limited public info."""
    restaurants = Restaurant.query.all()
    return jsonify([_public_info(r) for r in restaurants])


@public_restaurants_bp.route('/<int:restaurant_id>', methods=['GET'])
def get_restaurant_by_id(restaurant_id):
    """Get a single restaurant by ID (public)."""
    r = Restaurant.query.get(restaurant_id)
    if not r:
        return jsonify({'error': 'Restaurant not found'}), 404
    return jsonify(_public_info(r))


@restaurant_bp.route('', methods=['GET'])
@require_role('restaurant_admin')
def get_restaurant():
    """Get restaurant profile (returns null if not yet registered)."""
    restaurant = _get_restaurant()
    if not restaurant:
        return jsonify(None), 200
    return jsonify(restaurant.to_dict())


@restaurant_bp.route('', methods=['POST'])
@require_role('restaurant_admin')
def register_restaurant():
    """
    Register the restaurant (first-time setup).
    Only one restaurant is allowed per instance.
    """
    existing = _get_restaurant()
    if existing:
        return jsonify({'error': 'Restaurant already registered. Use PUT to update.'}), 409

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['name', 'address']
    missing = [f for f in required if not data.get(f) and data.get(f) != 0]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    lat = _to_float_or_none(data.get('latitude'))
    lng = _to_float_or_none(data.get('longitude'))
    resolved = None
    if not _valid_coords(lat, lng):
        resolved = get_geocoding_details(data['address'])
        if not resolved:
            return jsonify({'error': 'Address could not be geocoded. Please provide a valid address or explicit coordinates.'}), 400
        lat = resolved.get('lat')
        lng = resolved.get('lng')
        if not _valid_coords(lat, lng):
            return jsonify({'error': 'Resolved coordinates are invalid. Please provide latitude and longitude manually.'}), 400

    restaurant = Restaurant(
        name=data['name'],
        phone=data.get('phone', ''),
        email=data.get('email', ''),
        address=(resolved.get('display_address') if resolved and resolved.get('display_address') else data.get('address', '')),
        latitude=lat,
        longitude=lng,
        opens_at=data.get('opens_at', '09:00'),
        closes_at=data.get('closes_at', '23:00'),
        max_delivery_radius_km=float(data.get('max_delivery_radius_km', 15.0)),
        avg_speed_kmh=float(data.get('avg_speed_kmh', 30.0)),
        use_platform_drivers=bool(data.get('use_platform_drivers', False)),
    )

    db.session.add(restaurant)
    db.session.commit()
    return jsonify(restaurant.to_dict()), 201


@restaurant_bp.route('', methods=['PUT'])
@require_role('restaurant_admin')
def update_restaurant():
    """Update restaurant profile."""
    restaurant = _get_restaurant()
    if not restaurant:
        return jsonify({'error': 'Restaurant not registered yet. Use POST first.'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    updatable = ['name', 'phone', 'email', 'opens_at', 'closes_at', 'use_platform_drivers']
    for field in updatable:
        if field in data:
            setattr(restaurant, field, data[field])

    if 'max_delivery_radius_km' in data:
        radius = _to_float_or_none(data.get('max_delivery_radius_km'))
        if radius is None or radius <= 0:
            return jsonify({'error': 'max_delivery_radius_km must be a positive number'}), 400
        restaurant.max_delivery_radius_km = radius

    if 'avg_speed_kmh' in data:
        speed = _to_float_or_none(data.get('avg_speed_kmh'))
        if speed is None or speed <= 0:
            return jsonify({'error': 'avg_speed_kmh must be a positive number'}), 400
        restaurant.avg_speed_kmh = speed

    address_in_payload = 'address' in data
    if address_in_payload:
        restaurant.address = data.get('address', '')

    lat = _to_float_or_none(data.get('latitude')) if 'latitude' in data else restaurant.latitude
    lng = _to_float_or_none(data.get('longitude')) if 'longitude' in data else restaurant.longitude

    if not _valid_coords(lat, lng):
        if not restaurant.address:
            return jsonify({'error': 'Restaurant address is required to resolve coordinates.'}), 400
        resolved = get_geocoding_details(restaurant.address)
        if not resolved:
            return jsonify({'error': 'Address could not be geocoded. Please update address or provide valid coordinates.'}), 400
        lat = resolved.get('lat')
        lng = resolved.get('lng')
        if not _valid_coords(lat, lng):
            return jsonify({'error': 'Resolved coordinates are invalid. Please provide latitude and longitude manually.'}), 400
        if resolved.get('display_address'):
            restaurant.address = resolved['display_address']

    restaurant.latitude = lat
    restaurant.longitude = lng

    restaurant.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(restaurant.to_dict())
