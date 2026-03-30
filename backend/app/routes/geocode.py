"""
Geocoding API Blueprint.
Endpoint:
  GET /api/geocode?address=<address>
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, verify_jwt_in_request

from app.models.restaurant import Restaurant
from app.utils.geocoder import get_geocoding_details

geocode_bp = Blueprint('geocode', __name__)


@geocode_bp.route('/geocode', methods=['GET'])
def geocode_address():
    """Resolve address and calculate dynamic distance/fee/ETA for current restaurant."""
    address = (request.args.get('address') or '').strip()
    if not address:
        return jsonify({'error': 'Address required'}), 400

    verify_jwt_in_request(optional=True)
    claims = get_jwt() or {}
    restaurant_id = claims.get('restaurant_id')
    restaurant = Restaurant.query.get(restaurant_id) if restaurant_id else None

    result = get_geocoding_details(address, restaurant)
    if not result or 'lat' not in result:
        return jsonify({'error': 'Address not found — please check and try again'}), 404

    return jsonify(result), 200
