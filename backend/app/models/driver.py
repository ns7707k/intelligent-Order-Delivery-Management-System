"""
Driver model.
Matches the frontend data shapes used in:
  - DriverManagement, DriverDetails components
  - Status: available | on_delivery | returning | offline
"""

from datetime import datetime, timezone
from app import db


class Driver(db.Model):
    """Represents a delivery driver belonging to a restaurant."""
    __tablename__ = 'drivers'

    id = db.Column(db.String(50), primary_key=True)  # e.g., DRV001
    name = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    vehicle_type = db.Column(db.String(50), default='Motorcycle')  # Car, Motorcycle, Bike
    vehicle_number = db.Column(db.String(50), nullable=True)
    license_number = db.Column(db.String(100), nullable=True)
    address = db.Column(db.Text, nullable=True)
    emergency_contact = db.Column(db.String(50), nullable=True)

    # Ownership model for future shared fleet support
    owner_type = db.Column(db.String(20), default='restaurant', nullable=False, index=True)

    # Restaurant FK — nullable for platform-owned drivers
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurants.id'), nullable=True)
    is_platform_driver = db.Column(db.Boolean, default=False, nullable=False)

    # Driver status: available | on_delivery | returning | offline
    status = db.Column(db.String(50), default='available', nullable=False, index=True)

    # Active assignment pointer for movement simulation
    current_order_id = db.Column(db.Integer, nullable=True)

    # Current location (for route optimization - closest driver logic)
    current_latitude = db.Column(db.Float, nullable=True)
    current_longitude = db.Column(db.Float, nullable=True)

    # Round-trip timing
    assigned_at = db.Column(db.DateTime(timezone=True), nullable=True)             # When current delivery was assigned
    estimated_delivery_at = db.Column(db.DateTime(timezone=True), nullable=True)   # When delivery completes
    estimated_return_at = db.Column(db.DateTime(timezone=True), nullable=True)     # Backward-compatible alias
    driver_available_at = db.Column(db.DateTime(timezone=True), nullable=True)     # When driver is available again

    # Performance metrics
    total_deliveries = db.Column(db.Integer, default=0)
    active_deliveries = db.Column(db.Integer, default=0)
    rating = db.Column(db.Float, default=5.0)
    on_time_deliveries = db.Column(db.Integer, default=0)
    late_deliveries = db.Column(db.Integer, default=0)
    average_delivery_time = db.Column(db.Float, default=0.0)  # in minutes

    # Timestamps
    joined_date = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Serialize driver to dict matching frontend expectations."""
        on_time_rate = round((self.on_time_deliveries / self.total_deliveries * 100), 1) \
                       if self.total_deliveries > 0 else 0
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'vehicle_type': self.vehicle_type,
            'vehicle_number': self.vehicle_number,
            'license_number': self.license_number,
            'address': self.address,
            'emergency_contact': self.emergency_contact,
            'owner_type': self.owner_type,
            'restaurant_id': self.restaurant_id,
            'is_platform_driver': self.is_platform_driver,
            'status': self.status,
            'current_order_id': self.current_order_id,
            'current_latitude': self.current_latitude,
            'current_longitude': self.current_longitude,
            'estimated_delivery_at': self.estimated_delivery_at.isoformat() if self.estimated_delivery_at else None,
            'estimated_return_at': self.estimated_return_at.isoformat() if self.estimated_return_at else None,
            'driver_available_at': self.driver_available_at.isoformat() if self.driver_available_at else None,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'total_deliveries': self.total_deliveries,
            'active_deliveries': self.active_deliveries,
            'rating': self.rating,
            'on_time_deliveries': self.on_time_deliveries,
            'on_time_rate': on_time_rate,
            'late_deliveries': self.late_deliveries,
            'average_delivery_time': self.average_delivery_time,
            'joined_date': self.joined_date.isoformat() if self.joined_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'display_status': ('Coming back from delivery' if self.status == 'returning' else self.status),
        }

    def to_summary_dict(self):
        """Short summary for lists and dropdowns."""
        return {
            'id': self.id,
            'name': self.name,
            'status': self.status,
            'vehicle_type': self.vehicle_type,
            'owner_type': self.owner_type,
            'active_deliveries': self.active_deliveries,
            'current_order_id': self.current_order_id,
            'rating': self.rating,
            'estimated_delivery_at': self.estimated_delivery_at.isoformat() if self.estimated_delivery_at else None,
            'estimated_return_at': self.estimated_return_at.isoformat() if self.estimated_return_at else None,
            'driver_available_at': self.driver_available_at.isoformat() if self.driver_available_at else None,
        }

    def __repr__(self):
        return f'<Driver {self.id} - {self.name}>'
