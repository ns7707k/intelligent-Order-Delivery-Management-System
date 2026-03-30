"""Quick smoke test for the ODMS backend."""
import os
import sys

# Use SQLite for testing (no PostgreSQL needed)
os.environ['DATABASE_URL'] = 'sqlite:///odms_smoke_test.db'

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models.order import Order, OrderItem
from app.models.driver import Driver
from app.models.route import Route, RouteStop
from app.models.settings import Settings

def main():
    print("=" * 50)
    print("ODMS Backend Smoke Test")
    print("=" * 50)

    # Create app with SQLite
    app = create_app('development')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///odms_smoke_test.db'

    with app.app_context():
        # Create tables
        db.create_all()
        print("\n[OK] All database tables created")

        # Test Driver model
        d = Driver(id='DRV001', name='Test Driver', phone='555-1234',
                   status='available', current_latitude=51.505, current_longitude=-0.09)
        db.session.add(d)
        db.session.commit()
        print(f"[OK] Driver created: {d.id} - {d.name}")

        # Test Order model
        o = Order(customer_name='John Doe', customer_phone='555-5678',
                  delivery_address='123 Main St', status='pending',
                  latitude=51.510, longitude=-0.095, total=25.99)
        db.session.add(o)
        db.session.flush()

        item = OrderItem(order_id=o.id, name='Pizza', quantity=2, price=12.99)
        db.session.add(item)
        db.session.commit()
        print(f"[OK] Order created: #{o.id} with {o.items.count()} item(s)")

        # Test API endpoints with test client
        client = app.test_client()

        # Health check
        resp = client.get('/api/health')
        print(f"[OK] GET /api/health -> {resp.status_code}")

        # Get orders
        resp = client.get('/api/orders')
        data = resp.get_json()
        print(f"[OK] GET /api/orders -> {resp.status_code} ({len(data)} orders)")

        # Get single order
        resp = client.get(f'/api/orders/{o.id}')
        print(f"[OK] GET /api/orders/{o.id} -> {resp.status_code}")

        # Create order
        resp = client.post('/api/orders', json={
            'customer_name': 'Jane Smith',
            'customer_phone': '555-9999',
            'delivery_address': '456 Elm St',
            'items': [{'name': 'Burger', 'quantity': 1, 'price': 11.99}],
            'subtotal': '11.99', 'tax': '0.96', 'total': '17.94',
            'latitude': 51.508, 'longitude': -0.088,
        })
        print(f"[OK] POST /api/orders -> {resp.status_code}")

        # Update order status
        resp = client.patch(f'/api/orders/{o.id}', json={'status': 'preparing'})
        print(f"[OK] PATCH /api/orders/{o.id} -> {resp.status_code}")

        # Get drivers
        resp = client.get('/api/drivers')
        data = resp.get_json()
        print(f"[OK] GET /api/drivers -> {resp.status_code} ({len(data)} drivers)")

        # Get available drivers
        resp = client.get('/api/drivers/available')
        print(f"[OK] GET /api/drivers/available -> {resp.status_code}")

        # Heatmap live
        resp = client.get('/api/heatmap/live')
        print(f"[OK] GET /api/heatmap/live -> {resp.status_code}")

        # Routes active
        resp = client.get('/api/routes/active')
        print(f"[OK] GET /api/routes/active -> {resp.status_code}")

        # Analytics summary
        resp = client.get('/api/analytics/summary')
        print(f"[OK] GET /api/analytics/summary -> {resp.status_code}")

        # Settings
        resp = client.get('/api/settings')
        print(f"[OK] GET /api/settings -> {resp.status_code}")

        # Route optimization
        resp = client.patch(f'/api/orders/{o.id}', json={'status': 'ready'})
        print(f"[OK] PATCH order to 'ready' (trigger optimization) -> {resp.status_code}")

        resp = client.post('/api/routes/optimize', json={'orderIds': [o.id]})
        print(f"[OK] POST /api/routes/optimize -> {resp.status_code}")

        # Cleanup test DB
        db.drop_all()

    # Remove test database file
    db_path = os.path.join(os.path.dirname(__file__), 'odms_smoke_test.db')
    if os.path.exists(db_path):
        os.remove(db_path)

    print("\n" + "=" * 50)
    print("ALL TESTS PASSED!")
    print("=" * 50)

if __name__ == '__main__':
    main()
