"""
User auth model.
Stores credentials and role mapping for restaurant admins and drivers.
"""

from datetime import datetime, timezone
import bcrypt
from app import db


class User(db.Model):
    """Authenticated user account with role bindings."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, index=True)  # restaurant_admin | driver

    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurants.id'), nullable=True)
    driver_id = db.Column(db.String(50), db.ForeignKey('drivers.id'), nullable=True)

    is_active = db.Column(db.Boolean, default=True, nullable=False)
    must_change_password = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login = db.Column(db.DateTime(timezone=True), nullable=True)

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'), bcrypt.gensalt()
        ).decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'restaurant_id': self.restaurant_id,
            'driver_id': self.driver_id,
            'is_active': self.is_active,
            'must_change_password': self.must_change_password,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }

    def __repr__(self):
        return f'<User {self.id} - {self.email} ({self.role})>'
