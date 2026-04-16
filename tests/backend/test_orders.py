from datetime import datetime, timedelta, timezone

from app import db
from app.models.order import Order
from app.models.settings import Settings


def _create_order(client, headers, monkeypatch, name="Order Customer"):
    monkeypatch.setattr("app.routes.orders.get_geocoding_details", lambda *args, **kwargs: {})
    response = client.post(
        "/api/orders",
        headers=headers,
        json={
            "customer_name": name,
            "customer_phone": "+440000000021",
            "delivery_address": "2 Test Street, London",
            "items": [{"name": "Pizza", "quantity": 1, "price": 10.0}],
            "subtotal": 10.0,
            "tax": 0.8,
            "delivery_fee": 4.99,
            "total": 15.79,
            "latitude": 51.5074,
            "longitude": -0.1278,
        },
    )
    assert response.status_code == 201
    return response.get_json()


def test_create_order_success(client, auth_headers, monkeypatch):
    payload = _create_order(client, auth_headers, monkeypatch)
    assert payload["status"] == "pending"


def test_create_order_uses_restaurant_settings_for_pricing(client, app, auth_headers, monkeypatch):
    monkeypatch.setattr("app.routes.orders.get_geocoding_details", lambda *args, **kwargs: {})

    with app.app_context():
        db.session.add(Settings(
            key="default_delivery_fee",
            value="6.5",
            value_type="number",
            category="order",
            restaurant_id=1,
        ))
        db.session.add(Settings(
            key="tax_rate",
            value="9.4",
            value_type="number",
            category="order",
            restaurant_id=1,
        ))
        db.session.commit()

    response = client.post(
        "/api/orders",
        headers=auth_headers,
        json={
            "customer_name": "Settings Pricing",
            "customer_phone": "+440000000023",
            "delivery_address": "5 Test Street, London",
            "items": [{"name": "Burger", "quantity": 2, "price": 10.0}],
            "subtotal": 20.0,
            "latitude": 51.5074,
            "longitude": -0.1278,
        },
    )
    assert response.status_code == 201
    payload = response.get_json()

    assert payload["tax"] == 1.88
    assert payload["delivery_fee"] == 6.5
    assert payload["total"] == 28.38


def test_create_order_prefers_geocoded_fee_over_default_setting(client, app, auth_headers, monkeypatch):
    with app.app_context():
        db.session.add(Settings(
            key="default_delivery_fee",
            value="6.5",
            value_type="number",
            category="order",
            restaurant_id=1,
        ))
        db.session.commit()

    monkeypatch.setattr(
        "app.routes.orders.get_geocoding_details",
        lambda *args, **kwargs: {
            "lat": 51.6,
            "lng": -0.11,
            "display_address": "Resolved Address",
            "delivery_fee": 7.8,
            "platform_fee": 1.56,
            "driver_fee": 6.24,
        },
    )

    response = client.post(
        "/api/orders",
        headers=auth_headers,
        json={
            "customer_name": "Geo Pricing",
            "customer_phone": "+440000000024",
            "delivery_address": "6 Test Street, London",
            "items": [{"name": "Wrap", "quantity": 1, "price": 12.0}],
            "subtotal": 12.0,
        },
    )
    assert response.status_code == 201
    payload = response.get_json()

    assert payload["delivery_fee"] == 7.8
    assert payload["platform_fee"] == 1.56
    assert payload["driver_fee"] == 6.24


def test_get_order_pricing_config_uses_settings(client, app, auth_headers):
    with app.app_context():
        db.session.add(Settings(
            key="default_delivery_fee",
            value="6.5",
            value_type="number",
            category="order",
            restaurant_id=1,
        ))
        db.session.add(Settings(
            key="tax_rate",
            value="9.4",
            value_type="number",
            category="order",
            restaurant_id=1,
        ))
        db.session.commit()

    response = client.get("/api/orders/pricing-config", headers=auth_headers)
    assert response.status_code == 200

    payload = response.get_json()
    assert payload["default_delivery_fee"] == 6.5
    assert payload["tax_rate"] == 9.4


def test_update_order_ready_respects_auto_assign_setting(client, app, auth_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch)

    with app.app_context():
        db.session.add(Settings(
            key="auto_assign_drivers",
            value="false",
            value_type="boolean",
            category="order",
            restaurant_id=1,
        ))
        db.session.commit()

    monkeypatch.setattr(
        "app.routes.orders.trigger_route_optimization",
        lambda *_: (_ for _ in ()).throw(AssertionError("trigger_route_optimization should not run")),
    )

    response = client.patch(
        f"/api/orders/{created['id']}",
        headers=auth_headers,
        json={"status": "ready"},
    )
    assert response.status_code == 200

    payload = response.get_json()
    assert payload["status"] == "ready"
    assert payload["allocation"]["auto_assign_drivers"] is False


def test_get_orders_auto_cancels_pending_timeout(client, app, auth_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch)

    with app.app_context():
        order = Order.query.get(created["id"])
        order.created_at = datetime.now(timezone.utc) - timedelta(minutes=5)

        db.session.add(Settings(
            key="order_timeout_minutes",
            value="1",
            value_type="number",
            category="order",
            restaurant_id=1,
        ))
        db.session.commit()

    response = client.get("/api/orders", headers=auth_headers)
    assert response.status_code == 200

    payload = response.get_json()
    timed_out = next(order for order in payload if order["id"] == created["id"])
    assert timed_out["status"] == "cancelled"


def test_update_order_rejects_pending_timeout(client, app, auth_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch)

    with app.app_context():
        order = Order.query.get(created["id"])
        order.created_at = datetime.now(timezone.utc) - timedelta(minutes=5)

        db.session.add(Settings(
            key="order_timeout_minutes",
            value="1",
            value_type="number",
            category="order",
            restaurant_id=1,
        ))
        db.session.commit()

    response = client.patch(
        f"/api/orders/{created['id']}",
        headers=auth_headers,
        json={"status": "preparing"},
    )
    assert response.status_code == 409

    payload = response.get_json()
    assert "cancelled" in payload["error"].lower()

    verify = client.get(f"/api/orders/{created['id']}", headers=auth_headers)
    assert verify.status_code == 200
    assert verify.get_json()["status"] == "cancelled"


def test_create_order_missing_required_fields(client, auth_headers):
    response = client.post(
        "/api/orders",
        headers=auth_headers,
        json={"customer_phone": "+440000000022", "delivery_address": "3 Test Street"},
    )
    assert response.status_code == 400


def test_get_orders_returns_list(client, auth_headers, monkeypatch):
    _create_order(client, auth_headers, monkeypatch)
    response = client.get("/api/orders", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.get_json(), list)


def test_get_order_by_id(client, auth_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch)
    response = client.get(f"/api/orders/{created['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()["id"] == created["id"]


def test_get_nonexistent_order(client, auth_headers):
    response = client.get("/api/orders/99999", headers=auth_headers)
    assert response.status_code == 404


def test_status_transition_pending_to_preparing(client, auth_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch)
    response = client.patch(
        f"/api/orders/{created['id']}",
        headers=auth_headers,
        json={"status": "preparing"},
    )
    assert response.status_code == 200
    assert response.get_json()["status"] == "preparing"


def test_status_transition_preparing_to_ready(client, auth_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch)
    _ = client.patch(
        f"/api/orders/{created['id']}",
        headers=auth_headers,
        json={"status": "preparing"},
    )
    response = client.patch(
        f"/api/orders/{created['id']}",
        headers=auth_headers,
        json={"status": "ready"},
    )
    assert response.status_code == 200
    assert response.get_json()["status"] in ["ready", "assigned"]


def test_invalid_status_value(client, auth_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch)
    response = client.patch(
        f"/api/orders/{created['id']}",
        headers=auth_headers,
        json={"status": "flying"},
    )
    assert response.status_code == 400


def test_order_scoped_to_restaurant(client, auth_headers, second_restaurant_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch, name="Scoped Order")

    response = client.get("/api/orders", headers=second_restaurant_headers)
    assert response.status_code == 200
    ids = [order["id"] for order in response.get_json()]
    assert created["id"] not in ids


def test_delete_order(client, auth_headers, monkeypatch):
    created = _create_order(client, auth_headers, monkeypatch)
    response = client.delete(f"/api/orders/{created['id']}", headers=auth_headers)
    assert response.status_code == 200

    verify = client.get(f"/api/orders/{created['id']}", headers=auth_headers)
    assert verify.status_code == 200
    assert verify.get_json()["status"] == "cancelled"
