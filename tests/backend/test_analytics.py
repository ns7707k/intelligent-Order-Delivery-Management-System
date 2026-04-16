from datetime import datetime, timedelta, timezone

from app import db
from app.models.driver import Driver
from app.models.order import Order, OrderItem
from app.models.settings import Settings


def _seed_analytics_data(app):
    with app.app_context():
        delivered = Order(
            customer_name="Alice",
            customer_phone="+440000000001",
            delivery_address="1 Test Street",
            status="delivered",
            subtotal=20.0,
            tax=2.0,
            delivery_fee=3.0,
            total=25.0,
            estimated_delivery_minutes=24,
            restaurant_id=1,
            created_at=datetime.now(timezone.utc),
        )
        cancelled = Order(
            customer_name="Bob",
            customer_phone="+440000000002",
            delivery_address="2 Test Street",
            status="cancelled",
            subtotal=10.0,
            tax=1.0,
            delivery_fee=2.0,
            total=13.0,
            restaurant_id=1,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add_all([delivered, cancelled])
        db.session.flush()

        db.session.add(
            OrderItem(
                order_id=delivered.id,
                name="Burger",
                quantity=2,
                price=8.5,
            )
        )

        d1 = Driver(
            id="DRV_ANALYTICS_1",
            name="Analytic One",
            phone="+440000001001",
            email="a1@odms.test",
            vehicle_type="Car",
            status="available",
            restaurant_id=1,
            rating=4.8,
            total_deliveries=20,
            on_time_deliveries=18,
        )
        d2 = Driver(
            id="DRV_ANALYTICS_2",
            name="Analytic Two",
            phone="+440000001002",
            email="a2@odms.test",
            vehicle_type="Bike",
            status="on_delivery",
            restaurant_id=1,
            rating=4.5,
            total_deliveries=10,
            on_time_deliveries=9,
        )
        db.session.add_all([d1, d2])
        db.session.commit()


def test_analytics_summary(client, app, auth_headers):
    _seed_analytics_data(app)
    response = client.get("/api/analytics/summary?timeRange=7days", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert "revenue" in payload
    assert "orders" in payload
    assert "drivers" in payload
    assert payload["orders"]["avgDeliveryTime"] == 24.0


def test_analytics_orders_breakdown(client, app, auth_headers):
    _seed_analytics_data(app)
    response = client.get("/api/analytics/orders?timeRange=7days", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["total"] >= 2
    assert "delivered" in payload["byStatus"]


def test_analytics_drivers_metrics(client, app, auth_headers):
    _seed_analytics_data(app)
    response = client.get("/api/analytics/drivers", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["total"] == 2
    assert payload["available"] == 1
    assert payload["on_delivery"] == 1


def test_analytics_top_items(client, app, auth_headers):
    _seed_analytics_data(app)
    response = client.get("/api/analytics/top-items?timeRange=7days&limit=5", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)
    assert payload[0]["name"] == "Burger"


def test_analytics_hourly_distribution(client, app, auth_headers):
    _seed_analytics_data(app)
    response = client.get("/api/analytics/hourly?timeRange=7days", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)


def test_analytics_respects_enable_analytics_setting(client, app, auth_headers):
    with app.app_context():
        db.session.add(Settings(
            key="enable_analytics",
            value="false",
            value_type="boolean",
            category="system",
            restaurant_id=1,
        ))
        db.session.commit()

    response = client.get("/api/analytics/summary?timeRange=7days", headers=auth_headers)
    assert response.status_code == 403
    assert "disabled" in response.get_json()["error"].lower()


def test_analytics_respects_data_retention_days_setting(client, app, auth_headers):
    now = datetime.now(timezone.utc)

    with app.app_context():
        db.session.add(Settings(
            key="data_retention_days",
            value="1",
            value_type="number",
            category="system",
            restaurant_id=1,
        ))

        db.session.add_all([
            Order(
                customer_name="Recent",
                customer_phone="+440000000101",
                delivery_address="Recent Street",
                status="delivered",
                subtotal=10.0,
                tax=1.0,
                delivery_fee=2.0,
                total=13.0,
                restaurant_id=1,
                created_at=now,
            ),
            Order(
                customer_name="Old",
                customer_phone="+440000000102",
                delivery_address="Old Street",
                status="delivered",
                subtotal=30.0,
                tax=3.0,
                delivery_fee=5.0,
                total=38.0,
                restaurant_id=1,
                created_at=now - timedelta(days=5),
            ),
        ])
        db.session.commit()

    response = client.get("/api/analytics/summary?timeRange=30days", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["revenue"]["orders"] == 1
    assert payload["revenue"]["total"] == 13.0
