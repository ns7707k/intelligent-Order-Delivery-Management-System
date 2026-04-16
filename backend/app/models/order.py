"""
Order and OrderItem models.
Matches the frontend data shapes used in:
    - OrderHistory, OrderDetails, CreateOrder components
    - OrderContext (status: pending, preparing, ready, delivered, cancelled)
"""

from datetime import datetime, timedelta, timezone
from app import db


class Order(db.Model):
    """Represents a customer order."""
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customer_name = db.Column(db.String(255), nullable=False)
    customer_phone = db.Column(db.String(50), nullable=False)
    customer_email = db.Column(db.String(255), nullable=True)
    delivery_address = db.Column(db.Text, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    payment_method = db.Column(db.String(50), default='Card')
    payment_status = db.Column(db.String(50), default='Pending')

    # Order status: pending | preparing | ready | assigned | out_for_delivery | delivered | cancelled
    status = db.Column(db.String(50), default='pending', nullable=False, index=True)

    # Pricing
    subtotal = db.Column(db.Float, default=0.0)
    tax = db.Column(db.Float, default=0.0)
    delivery_fee = db.Column(db.Float, default=4.99)
    platform_fee = db.Column(db.Float, default=0.0)
    driver_fee = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, default=0.0)

    # Geolocation (for heatmap & routing)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurants.id'), nullable=True, index=True)

    # Driver assignment
    driver_id = db.Column(db.String(50), db.ForeignKey('drivers.id'), nullable=True)
    assigned_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    estimated_delivery = db.Column(db.DateTime(timezone=True), nullable=True)

    # Round-trip tracking
    driver_pickup_eta = db.Column(db.Float, nullable=True)            # Minutes until driver reaches restaurant
    estimated_delivery_minutes = db.Column(db.Integer, nullable=True)   # Delivery leg ETA in minutes
    estimated_return_minutes = db.Column(db.Integer, nullable=True)     # Return leg ETA in minutes
    estimated_round_trip_minutes = db.Column(db.Integer, nullable=True) # Total round trip
    driver_available_again_minutes = db.Column(db.Float, nullable=True) # Minutes until driver re-enters pool
    driver_available_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    items = db.relationship('OrderItem', backref='order', lazy='selectin',
                            cascade='all, delete-orphan')
    driver = db.relationship('Driver', foreign_keys=[driver_id], backref='assigned_orders', lazy='select')

    def to_dict(self):
        """Serialize order to dict matching frontend expectations."""
        pickup_eta_at = None
        if self.assigned_at and self.driver_pickup_eta is not None:
            pickup_eta_at = self.assigned_at + timedelta(minutes=float(self.driver_pickup_eta))

        items_payload = [item.to_dict() for item in self.items]

        display_driver = self.status in ('assigned', 'out_for_delivery', 'delivered')
        driver_status = self.driver.status if (self.driver and display_driver) else None
        if self.driver_id and self.status in ('assigned', 'out_for_delivery') and driver_status == 'available':
            driver_status = 'on_delivery'

        return {
            'id': self.id,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'customer_email': self.customer_email,
            'delivery_address': self.delivery_address,
            'notes': self.notes,
            'payment_method': self.payment_method,
            'payment_status': self.payment_status,
            'status': self.status,
            'subtotal': self.subtotal,
            'tax': self.tax,
            'delivery_fee': self.delivery_fee,
            'total': self.total,
            'platform_fee': getattr(self, 'platform_fee', 0.0),
            'driver_fee': getattr(self, 'driver_fee', 0.0),
            'latitude': self.latitude,
            'longitude': self.longitude,
            'restaurant_id': self.restaurant_id,
            'driver_id': self.driver_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'pickup_eta_at': pickup_eta_at.isoformat() if pickup_eta_at else None,
            'driver_name': self.driver.name if (self.driver and display_driver) else None,
            'driver_status': driver_status,
            'driver_vehicle_type': self.driver.vehicle_type if (self.driver and display_driver) else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'estimated_delivery': self.estimated_delivery.isoformat() if self.estimated_delivery else None,
            'estimated_delivery_at': self.estimated_delivery.isoformat() if self.estimated_delivery else None,
            'driver_pickup_eta': self.driver_pickup_eta,
            'estimated_delivery_minutes': self.estimated_delivery_minutes,
            'estimated_return_minutes': self.estimated_return_minutes,
            'estimated_round_trip_minutes': self.estimated_round_trip_minutes,
            'driver_available_again_minutes': self.driver_available_again_minutes,
            'driver_available_at': self.driver_available_at.isoformat() if self.driver_available_at else None,
            'items': items_payload,
            'items_count': len(items_payload),
        }

    def __repr__(self):
        return f'<Order {self.id} - {self.status}>'


class OrderItem(db.Model):
    """Represents an item within an order."""
    __tablename__ = 'order_items'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    quantity = db.Column(db.Integer, default=1, nullable=False)
    price = db.Column(db.Float, default=0.0, nullable=False)
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        """Serialize order item to dict."""
        return {
            'id': self.id,
            'order_id': self.order_id,
            'name': self.name,
            'quantity': self.quantity,
            'price': self.price,
            'notes': self.notes,
        }

    def __repr__(self):
        return f'<OrderItem {self.id} - {self.name}>'
