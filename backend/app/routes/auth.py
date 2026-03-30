"""
Authentication API Blueprint.
Endpoints:
  POST /api/auth/register/restaurant - Restaurant self-registration
  POST /api/auth/login               - Unified login (restaurant_admin | driver)
  POST /api/auth/logout              - Stateless logout acknowledgment
  GET  /api/auth/me                  - Current user from JWT token
"""

from datetime import datetime, timezone
import random
import string
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from app import db
from app.models.driver import Driver
from app.models.restaurant import Restaurant
from app.models.settings import Settings
from app.models.user import User
from app.utils.auth import get_current_restaurant_id, require_role
from app.utils.geocoder import get_geocoding_details

auth_bp = Blueprint('auth', __name__)


def _missing_required(data, required_fields):
    return [field for field in required_fields if not data.get(field)]


def _generate_driver_id():
    count = Driver.query.count()
    next_id = f'DRV{str(count + 1).zfill(3)}'
    while Driver.query.get(next_id):
        count += 1
        next_id = f'DRV{str(count + 1).zfill(3)}'
    return next_id


def _generate_temp_password(length=10):
    alphabet = string.ascii_letters + string.digits + '#@!'
    return ''.join(random.choice(alphabet) for _ in range(length))


def _coerce_coordinate_pair(latitude, longitude):
    """Parse and validate coordinate inputs."""
    if latitude is None or longitude is None:
        return None, None

    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return None, None

    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None, None

    return lat, lng


@auth_bp.route('/register/restaurant', methods=['POST'])
def register_restaurant():
    """Create restaurant and linked restaurant_admin account."""
    data = request.get_json() or {}
    required = ['email', 'password', 'restaurant_name', 'phone', 'address']
    missing = _missing_required(data, required)
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    email = data['email'].strip().lower()
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    lat, lng = _coerce_coordinate_pair(data.get('latitude'), data.get('longitude'))
    resolved = None
    if lat is None or lng is None:
        resolved = get_geocoding_details(data['address'].strip())
        if not resolved or 'lat' not in resolved or 'lng' not in resolved:
            return jsonify({'error': 'Unable to resolve restaurant coordinates from address. Provide a valid address or explicit latitude/longitude.'}), 400
        lat = resolved['lat']
        lng = resolved['lng']

    restaurant = Restaurant(
        name=data['restaurant_name'].strip(),
        phone=data['phone'].strip(),
        address=(resolved.get('display_address') if resolved and resolved.get('display_address') else data['address'].strip()),
        email=email,
        latitude=lat,
        longitude=lng,
    )
    db.session.add(restaurant)
    db.session.flush()

    user = User(
        email=email,
        role='restaurant_admin',
        restaurant_id=restaurant.id,
        is_active=True,
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id), additional_claims={
        'user_id': user.id,
        'role': user.role,
        'restaurant_id': restaurant.id,
        'driver_id': None,
    })

    return jsonify({
        'token': token,
        'user': user.to_dict(),
        'restaurant': restaurant.to_dict(),
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token + profile."""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403

    if user.role == 'driver' and user.must_change_password:
        return jsonify({
            'reset_required': True,
            'message': 'Password reset required before first login.',
            'user': user.to_dict(),
        }), 200

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()

    token = create_access_token(identity=str(user.id), additional_claims={
        'user_id': user.id,
        'role': user.role,
        'restaurant_id': user.restaurant_id,
        'driver_id': user.driver_id,
    })

    return jsonify({'token': token, 'user': user.to_dict()}), 200


@auth_bp.route('/register/driver', methods=['POST'])
@jwt_required()
@require_role('restaurant_admin')
def register_driver():
    """Create driver profile and linked user account for current restaurant."""
    data = request.get_json() or {}
    required = ['email', 'name', 'phone', 'vehicle_type']
    missing = _missing_required(data, required)
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    email = data['email'].strip().lower()
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    restaurant_id = get_current_restaurant_id()
    if not restaurant_id:
        return jsonify({'error': 'Restaurant context missing'}), 400

    driver = Driver(
        id=_generate_driver_id(),
        name=data['name'].strip(),
        phone=data['phone'].strip(),
        email=email,
        vehicle_type=data.get('vehicle_type', 'Motorcycle'),
        vehicle_number=data.get('vehicle_number', ''),
        license_number=data.get('license_number', ''),
        restaurant_id=restaurant_id,
        owner_type='restaurant',
        is_platform_driver=False,
        status='offline',
    )
    db.session.add(driver)
    db.session.flush()

    raw_password = data.get('password') or _generate_temp_password()
    user = User(
        email=email,
        role='driver',
        restaurant_id=restaurant_id,
        driver_id=driver.id,
        is_active=True,
        must_change_password=True,
    )
    user.set_password(raw_password)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': 'Driver account created',
        'driver': driver.to_dict(),
        'user': user.to_dict(),
        'temp_password': raw_password,
    }), 201


@auth_bp.route('/register/driver/public', methods=['POST'])
def register_driver_public():
    """Create a self-service platform driver account."""
    data = request.get_json() or {}
    required = ['email', 'password', 'name', 'phone', 'vehicle_type']
    missing = _missing_required(data, required)
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    email = data['email'].strip().lower()
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    driver = Driver(
        id=_generate_driver_id(),
        name=data['name'].strip(),
        phone=data['phone'].strip(),
        email=email,
        vehicle_type=data.get('vehicle_type', 'Motorcycle').strip() or 'Motorcycle',
        vehicle_number=data.get('vehicle_number', '').strip(),
        license_number=data.get('license_number', '').strip(),
        address=data.get('address', '').strip(),
        emergency_contact=data.get('emergency_contact', '').strip(),
        owner_type='platform',
        is_platform_driver=True,
        restaurant_id=None,
        status='offline',
    )
    db.session.add(driver)
    db.session.flush()

    user = User(
        email=email,
        role='driver',
        restaurant_id=None,
        driver_id=driver.id,
        is_active=True,
        must_change_password=False,
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id), additional_claims={
        'user_id': user.id,
        'role': user.role,
        'restaurant_id': user.restaurant_id,
        'driver_id': user.driver_id,
    })

    return jsonify({
        'token': token,
        'user': user.to_dict(),
        'driver': driver.to_dict(),
    }), 201


@auth_bp.route('/logout', methods=['POST'])
@jwt_required(optional=True)
def logout():
    """Stateless logout endpoint (frontend clears token)."""
    return jsonify({'message': 'Logged out'}), 200


@auth_bp.route('/reset-password-first-login', methods=['POST'])
def reset_password_first_login():
    """Allow first-login driver to replace temporary password and receive token."""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    current_password = data.get('current_password') or ''
    new_password = data.get('new_password') or ''

    if not email or not current_password or not new_password:
        return jsonify({'error': 'Email, current_password and new_password are required'}), 400

    if len(new_password) < 8:
        return jsonify({'error': 'New password must be at least 8 characters'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(current_password):
        return jsonify({'error': 'Invalid email or temporary password'}), 401

    if user.role != 'driver':
        return jsonify({'error': 'Password reset flow is only for driver accounts'}), 400

    if not user.must_change_password:
        return jsonify({'error': 'This account does not require first login reset'}), 400

    user.set_password(new_password)
    user.must_change_password = False
    user.last_login = datetime.now(timezone.utc)
    db.session.commit()

    token = create_access_token(identity=str(user.id), additional_claims={
        'user_id': user.id,
        'role': user.role,
        'restaurant_id': user.restaurant_id,
        'driver_id': user.driver_id,
    })

    return jsonify({'token': token, 'user': user.to_dict()}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    """Return currently authenticated user."""
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid token identity'}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict()), 200
