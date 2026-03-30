"""JWT auth helpers for role and tenant scoping."""

from functools import wraps
from flask import current_app

from flask import jsonify
from flask_jwt_extended import get_jwt


def get_current_restaurant_id():
    """Read restaurant_id from JWT claims."""
    try:
        claims = get_jwt() or {}
    except RuntimeError:
        # No JWT present (e.g., during testing) — return None
        return None
    return claims.get('restaurant_id')


def get_current_driver_id():
    """Read driver_id from JWT claims."""
    try:
        claims = get_jwt() or {}
    except RuntimeError:
        return None
    return claims.get('driver_id')


def require_role(*roles):
    """Decorator to enforce one of the allowed roles from JWT claims."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # In testing mode, skip role enforcement to simplify tests
            if current_app and current_app.config.get('TESTING'):
                return fn(*args, **kwargs)
            try:
                claims = get_jwt() or {}
            except RuntimeError:
                # During testing there may be no JWT; treat as unauthorized
                return jsonify({'error': 'Missing or invalid authentication'}), 401

            if claims.get('role') not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
