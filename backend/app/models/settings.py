"""
Settings model.
Matches the frontend Settings component fields:
  - business info, voice config, map config, order defaults, system config
"""

from datetime import datetime, timezone
from app import db


class Settings(db.Model):
    """Key-value store for application settings."""
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    value = db.Column(db.Text, nullable=True)
    value_type = db.Column(db.String(20), default='string')  # string, number, boolean
    category = db.Column(db.String(50), default='general')  # general, voice, map, order, system
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurants.id'), nullable=True, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def get_typed_value(self):
        """Return value cast to its correct type."""
        if self.value is None:
            return None
        if self.value_type == 'number':
            try:
                return float(self.value)
            except ValueError:
                return 0
        if self.value_type == 'boolean':
            return self.value.lower() in ('true', '1', 'yes')
        return self.value

    def to_dict(self):
        return {
            'key': self.key,
            'value': self.get_typed_value(),
            'category': self.category,
            'restaurant_id': self.restaurant_id,
        }

    def __repr__(self):
        return f'<Settings {self.key}={self.value}>'


# Default settings that match the frontend Settings component
DEFAULT_SETTINGS = {
    # General
    'business_name': ('ODMS Restaurant', 'string', 'general'),
    'business_email': ('contact@odms-restaurant.com', 'string', 'general'),
    'business_phone': ('+1 (555) 123-4567', 'string', 'general'),
    'business_address': ('123 Main Street, New York, NY 10001', 'string', 'general'),

    # Voice
    'voice_confidence_threshold': ('0.8', 'number', 'voice'),
    'voice_auto_start': ('true', 'boolean', 'voice'),
    'voice_confirmation_required': ('true', 'boolean', 'voice'),

    # Map
    'default_map_zoom': ('13', 'number', 'map'),
    'map_style': ('standard', 'string', 'map'),
    'show_heatmap_by_default': ('false', 'boolean', 'map'),

    # Order
    'default_delivery_fee': ('4.99', 'number', 'order'),
    'tax_rate': ('8.0', 'number', 'order'),
    'auto_assign_drivers': ('true', 'boolean', 'order'),
    'use_platform_drivers': ('false', 'boolean', 'order'),
    'allow_driver_self_delivery': ('true', 'boolean', 'order'),
    'order_timeout_minutes': ('30', 'number', 'order'),

    # System
    'refresh_interval': ('5', 'number', 'system'),
    'max_active_drivers': ('20', 'number', 'system'),
    'enable_analytics': ('true', 'boolean', 'system'),
    'data_retention_days': ('90', 'number', 'system'),
}
