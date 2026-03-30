"""
Restaurant model.
Represents the restaurant that owns this ODMS instance.
Stores location (used as depot for VRP), name, and operating config.
Single-tenant: only one restaurant row expected.
"""

from datetime import datetime, timezone
from app import db


class Restaurant(db.Model):
    """Represents the restaurant using this system."""
    __tablename__ = 'restaurants'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(255), nullable=False, default='My Restaurant')
    phone = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    address = db.Column(db.Text, nullable=True)

    # Restaurant location — serves as the DEPOT for all VRP calculations
    # and the return destination for drivers after delivery
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)

    # Operating hours (optional)
    opens_at = db.Column(db.String(10), nullable=True, default='09:00')
    closes_at = db.Column(db.String(10), nullable=True, default='23:00')

    # Delivery config
    max_delivery_radius_km = db.Column(db.Float, default=15.0)
    avg_speed_kmh = db.Column(db.Float, default=30.0)  # Average driver speed
    use_platform_drivers = db.Column(db.Boolean, default=False, nullable=False)

    # Timestamps
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    drivers = db.relationship('Driver', backref='restaurant', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'opens_at': self.opens_at,
            'closes_at': self.closes_at,
            'max_delivery_radius_km': self.max_delivery_radius_km,
            'avg_speed_kmh': self.avg_speed_kmh,
            'use_platform_drivers': self.use_platform_drivers,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<Restaurant {self.id} - {self.name}>'
