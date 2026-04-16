"""
Settings API Blueprint.
Endpoints:
  GET  /api/settings           - Get all settings (grouped by category)
  PUT  /api/settings           - Update settings
  GET  /api/settings/<key>     - Get a single setting

Matches the frontend Settings component fields.
"""

from flask import Blueprint, request, jsonify
from app import db
from app.models.settings import Settings, DEFAULT_SETTINGS
from app.models.restaurant import Restaurant
from app.utils.auth import get_current_restaurant_id, require_role

settings_bp = Blueprint('settings', __name__)


def _get_setting_for_restaurant(key, restaurant_id):
    """
    Return restaurant-scoped setting, with backward compatibility for legacy
    single-key rows created before restaurant scoping was consistent.
    """
    setting = Settings.query.filter_by(key=key, restaurant_id=restaurant_id).first()
    if setting:
        return setting

    # Legacy databases may have a single global row per key (restaurant_id=NULL)
    # or rows tied to an older restaurant_id while key remains globally unique.
    legacy_setting = Settings.query.filter_by(key=key).first()
    if legacy_setting and restaurant_id is not None and legacy_setting.restaurant_id != restaurant_id:
        legacy_setting.restaurant_id = restaurant_id
    return legacy_setting


def _ensure_defaults(restaurant_id):
    """Ensure all default settings exist in the database."""
    for key, (value, value_type, category) in DEFAULT_SETTINGS.items():
        existing = _get_setting_for_restaurant(key, restaurant_id)
        if not existing:
            setting = Settings(
                key=key,
                value=str(value),
                value_type=value_type,
                category=category,
                restaurant_id=restaurant_id,
            )
            db.session.add(setting)
    db.session.commit()


@settings_bp.route('', methods=['GET'])
@require_role('restaurant_admin')
def get_settings():
    """
    Get all settings as a flat key-value object.
    This matches the frontend Settings component's state structure.
    """
    restaurant_id = get_current_restaurant_id()
    _ensure_defaults(restaurant_id)
    settings = Settings.query.filter_by(restaurant_id=restaurant_id).all()

    result = {}
    for s in settings:
        result[s.key] = s.get_typed_value()

    return jsonify(result)


@settings_bp.route('', methods=['PUT'])
@require_role('restaurant_admin')
def update_settings():
    """
    Update settings from a flat key-value object.
    Accepts: { "key1": value1, "key2": value2, ... }
    """
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    restaurant_id = get_current_restaurant_id()
    _ensure_defaults(restaurant_id)

    updated = []
    for key, value in data.items():
        setting = _get_setting_for_restaurant(key, restaurant_id)
        if setting:
            setting.value = str(value)
            updated.append(key)
        else:
            # Create new setting
            value_type = 'string'
            if isinstance(value, bool):
                value_type = 'boolean'
            elif isinstance(value, (int, float)):
                value_type = 'number'

            new_setting = Settings(
                key=key,
                value=str(value),
                value_type=value_type,
                category='custom',
                restaurant_id=restaurant_id,
            )
            db.session.add(new_setting)
            updated.append(key)

        if key == 'use_platform_drivers':
            restaurant = Restaurant.query.get(restaurant_id)
            if restaurant:
                restaurant.use_platform_drivers = bool(value)

    db.session.commit()

    return jsonify({
        'message': f'Updated {len(updated)} settings',
        'updated': updated,
    })


@settings_bp.route('/<string:key>', methods=['GET'])
@require_role('restaurant_admin')
def get_setting(key):
    """Get a single setting by key."""
    restaurant_id = get_current_restaurant_id()
    setting = _get_setting_for_restaurant(key, restaurant_id)
    if not setting:
        # Check defaults
        if key in DEFAULT_SETTINGS:
            value, value_type, category = DEFAULT_SETTINGS[key]
            return jsonify({'key': key, 'value': value, 'category': category})
        return jsonify({'error': f'Setting {key} not found'}), 404

    return jsonify(setting.to_dict())
