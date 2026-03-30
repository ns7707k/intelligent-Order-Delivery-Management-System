"""
Route and RouteStop models.
Matches the frontend data shapes used in:
  - RouteVisualization component
  - Route Optimization API (OR-Tools VRP solver output)
"""

from datetime import datetime, timezone
from app import db


class Route(db.Model):
    """Represents an optimized delivery route assigned to a driver."""
    __tablename__ = 'routes'

    id = db.Column(db.String(50), primary_key=True)  # e.g., ROUTE001
    driver_id = db.Column(db.String(50), db.ForeignKey('drivers.id'), nullable=False)
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurants.id'), nullable=True, index=True)

    # Route status: active | completed | cancelled
    status = db.Column(db.String(50), default='active', nullable=False, index=True)

    # Route metrics (computed by OR-Tools)
    total_distance = db.Column(db.Float, default=0.0)  # in km
    estimated_time = db.Column(db.Integer, default=0)  # in minutes
    total_orders = db.Column(db.Integer, default=0)

    # Timestamps
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    driver = db.relationship('Driver', backref='routes', lazy='select')
    stops = db.relationship('RouteStop', backref='route', lazy='dynamic',
                            cascade='all, delete-orphan',
                            order_by='RouteStop.sequence')

    def to_dict(self):
        """Serialize route to dict matching frontend expectations."""
        return {
            'id': self.id,
            'driver_id': self.driver_id,
            'restaurant_id': self.restaurant_id,
            'driver_name': self.driver.name if self.driver else None,
            'status': self.status,
            'total_distance': self.total_distance,
            'estimated_time': self.estimated_time,
            'total_orders': self.total_orders,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'orders': [stop.to_dict() for stop in self.stops],
        }

    def __repr__(self):
        return f'<Route {self.id} - {self.status}>'


class RouteStop(db.Model):
    """Represents a stop (order delivery) within a route."""
    __tablename__ = 'route_stops'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    route_id = db.Column(db.String(50), db.ForeignKey('routes.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    sequence = db.Column(db.Integer, nullable=False)  # Order of delivery

    # Location
    address = db.Column(db.Text, nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)

    # Stop status: pending | in_transit | delivered
    status = db.Column(db.String(50), default='pending', nullable=False)

    # Time estimates
    estimated_arrival = db.Column(db.DateTime(timezone=True), nullable=True)
    actual_arrival = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    order = db.relationship('Order', backref='route_stop', lazy='select')

    def to_dict(self):
        """Serialize route stop to dict matching frontend expectations."""
        order_status = self.order.status if self.order else None
        if order_status in ('assigned', 'out_for_delivery'):
            resolved_status = 'in_transit'
        elif order_status == 'delivered':
            resolved_status = 'delivered'
        else:
            resolved_status = 'pending'

        return {
            'id': self.order_id,
            'address': self.address,
            'lat': self.lat,
            'lng': self.lng,
            'status': resolved_status,
            'sequence': self.sequence,
            'estimated_arrival': self.estimated_arrival.isoformat() if self.estimated_arrival else None,
            'actual_arrival': self.actual_arrival.isoformat() if self.actual_arrival else None,
        }

    def __repr__(self):
        return f'<RouteStop {self.id} - Stop {self.sequence}>'
