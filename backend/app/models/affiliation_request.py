from datetime import datetime, timezone
from app import db


class AffiliationRequest(db.Model):
    __tablename__ = 'affiliation_requests'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    driver_id = db.Column(db.String(50), db.ForeignKey('drivers.id'), nullable=False)
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurants.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, approved, rejected
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    driver = db.relationship('Driver', backref='affiliation_requests', lazy='joined')
    restaurant = db.relationship('Restaurant', backref='affiliation_requests', lazy='joined')

    def to_dict(self):
        return {
            'id': self.id,
            'driver_id': self.driver_id,
            'driver_name': self.driver.name if self.driver else None,
            'driver_email': self.driver.email if self.driver else None,
            'driver_phone': self.driver.phone if self.driver else None,
            'driver_vehicle': self.driver.vehicle_type if self.driver else None,
            'restaurant_id': self.restaurant_id,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
