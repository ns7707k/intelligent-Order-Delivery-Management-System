from datetime import datetime, timedelta, timezone
import uuid

from flask_jwt_extended import create_access_token

from app import db
from app.models.driver import Driver
from app.models.order import Order
from app.models.restaurant import Restaurant
from app.models.settings import Settings
from app.routes import driver_me as driver_me_routes


def _register_public_driver(client, email_prefix="driver.me"):
    email = f"{email_prefix}.{uuid.uuid4().hex[:8]}@odms.test"
    response = client.post(
        "/api/auth/register/driver/public",
        json={
            "email": email,
            "password": "DriverPass123!",
            "name": "Driver Me",
            "phone": "+440000007777",
            "vehicle_type": "Bike",
        },
    )
    assert response.status_code == 201
    payload = response.get_json()
    return payload["driver"], {"Authorization": f"Bearer {payload['token']}"}


def _driver_headers_without_driver_id(app):
    with app.app_context():
        token = create_access_token(
            identity="123",
            additional_claims={
                "user_id": 123,
                "role": "driver",
                "restaurant_id": 1,
                "driver_id": None,
            },
        )
    return {"Authorization": f"Bearer {token}"}


def _driver_headers_nonexistent_driver(app):
    with app.app_context():
        token = create_access_token(
            identity="321",
            additional_claims={
                "user_id": 321,
                "role": "driver",
                "restaurant_id": 1,
                "driver_id": "DRV_DOES_NOT_EXIST",
            },
        )
    return {"Authorization": f"Bearer {token}"}


def _seed_driver_order_pair(app, driver_id, *, status="assigned", with_coords=True):
    with app.app_context():
        restaurant = Restaurant.query.get(1)
        restaurant.latitude = 51.5074
        restaurant.longitude = -0.1278

        driver = Driver.query.get(driver_id)
        driver.restaurant_id = restaurant.id
        driver.owner_type = "restaurant"

        order = Order(
            customer_name="Driver Me Customer",
            customer_phone="+440000006001",
            delivery_address="25 Baker Street",
            status=status,
            payment_method="CASH",
            payment_status="Pending",
            restaurant_id=restaurant.id,
            driver_id=driver_id,
            latitude=51.5174 if with_coords else None,
            longitude=-0.1278 if with_coords else None,
            assigned_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            estimated_delivery=datetime.now(timezone.utc) + timedelta(minutes=15),
            estimated_delivery_minutes=20,
            estimated_return_minutes=10,
            driver_available_at=datetime.now(timezone.utc) + timedelta(minutes=25),
        )
        db.session.add(order)
        db.session.flush()

        driver.current_order_id = order.id
        driver.active_deliveries = 1
        driver.status = "on_delivery"
        db.session.commit()
        return order.id


def test_driver_me_missing_driver_context_returns_400(client, app, auth_headers):
    headers = _driver_headers_without_driver_id(app)
    response = client.get("/api/driver/me", headers=headers)
    assert response.status_code == 400
    assert response.get_json()["error"] == "Driver context missing"


def test_driver_me_nonexistent_driver_returns_404(client, app, auth_headers):
    headers = _driver_headers_nonexistent_driver(app)
    response = client.get("/api/driver/me", headers=headers)
    assert response.status_code == 404
    assert response.get_json()["error"] == "Driver not found"


def test_driver_me_returns_active_order_with_pickup_metadata(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.active")
    order_id = _seed_driver_order_pair(app, driver_data["id"], status="assigned")

    response = client.get("/api/driver/me", headers=driver_headers)
    assert response.status_code == 200

    payload = response.get_json()
    assert payload["driver"]["id"] == driver_data["id"]
    assert payload["active_order"]["id"] == order_id
    assert payload["active_order"]["pickup_name"] is not None
    assert payload["active_order"]["pickup_latitude"] is not None
    assert payload["active_order"]["pickup_longitude"] is not None


def test_driver_me_orders_returns_only_my_orders(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.orders")
    order_id = _seed_driver_order_pair(app, driver_data["id"], status="out_for_delivery")

    with app.app_context():
        other = Order(
            customer_name="Other Customer",
            customer_phone="+440000006099",
            delivery_address="Other Place",
            status="assigned",
            restaurant_id=1,
            driver_id=None,
            latitude=51.5075,
            longitude=-0.1277,
        )
        db.session.add(other)
        db.session.commit()

    response = client.get("/api/driver/me/orders", headers=driver_headers)
    assert response.status_code == 200

    payload = response.get_json()
    ids = {item["id"] for item in payload}
    assert order_id in ids
    assert len(payload) == 1


def test_driver_status_rejects_invalid_value(client, auth_headers):
    _, driver_headers = _register_public_driver(client, email_prefix="driver.me.status.invalid")

    response = client.patch(
        "/api/driver/me/status",
        headers=driver_headers,
        json={"status": "busy"},
    )
    assert response.status_code == 400


def test_driver_status_rejects_offline_with_active_delivery(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.status.active")

    with app.app_context():
        driver = Driver.query.get(driver_data["id"])
        driver.current_order_id = 999
        db.session.commit()

    response = client.patch(
        "/api/driver/me/status",
        headers=driver_headers,
        json={"status": "offline"},
    )
    assert response.status_code == 400
    assert "active delivery" in response.get_json()["error"]


def test_driver_status_available_requires_location(client, auth_headers):
    _, driver_headers = _register_public_driver(client, email_prefix="driver.me.status.location")

    response = client.patch(
        "/api/driver/me/status",
        headers=driver_headers,
        json={"status": "available"},
    )
    assert response.status_code == 400
    assert "share your location" in response.get_json()["error"]


def test_driver_status_available_respects_max_active_drivers_limit(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.status.maxactive")

    with app.app_context():
        db.session.add(
            Driver(
                id="DRV_ACTIVE_CAP",
                name="Cap Driver",
                phone="+440000001212",
                email="cap.driver@odms.test",
                vehicle_type="Bike",
                status="available",
                restaurant_id=1,
            )
        )

        db.session.add(
            Settings(
                key="max_active_drivers",
                value="1",
                value_type="number",
                category="system",
                restaurant_id=1,
            )
        )

        target = Driver.query.get(driver_data["id"])
        target.restaurant_id = 1
        target.status = "offline"
        target.current_latitude = 51.501
        target.current_longitude = -0.111
        db.session.commit()

    response = client.patch(
        "/api/driver/me/status",
        headers=driver_headers,
        json={"status": "available"},
    )
    assert response.status_code == 409
    assert "Maximum active drivers reached" in response.get_json()["error"]


def test_driver_status_offline_clears_location(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.status.offline")

    with app.app_context():
        driver = Driver.query.get(driver_data["id"])
        driver.current_latitude = 51.5
        driver.current_longitude = -0.1
        driver.status = "available"
        db.session.commit()

    response = client.patch(
        "/api/driver/me/status",
        headers=driver_headers,
        json={"status": "offline"},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "offline"
    assert body["current_latitude"] is None
    assert body["current_longitude"] is None


def test_driver_location_requires_lat_lng(client, auth_headers):
    _, driver_headers = _register_public_driver(client, email_prefix="driver.me.loc.required")

    response = client.patch(
        "/api/driver/me/location",
        headers=driver_headers,
        json={"latitude": 51.5},
    )
    assert response.status_code == 400


def test_driver_location_updates_coordinates(client, auth_headers):
    _, driver_headers = _register_public_driver(client, email_prefix="driver.me.loc.success")

    response = client.patch(
        "/api/driver/me/location",
        headers=driver_headers,
        json={"latitude": 51.501, "longitude": -0.111},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["current_latitude"] == 51.501
    assert body["current_longitude"] == -0.111


def test_get_specific_driver_order_not_found(client, auth_headers):
    _, driver_headers = _register_public_driver(client, email_prefix="driver.me.order.404")

    response = client.get("/api/driver/me/orders/99999", headers=driver_headers)
    assert response.status_code == 404


def test_mark_delivered_rejects_when_self_delivery_disabled(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.deliver.disabled")
    order_id = _seed_driver_order_pair(app, driver_data["id"], status="assigned")

    with app.app_context():
        db.session.add(
            Settings(
                key="allow_driver_self_delivery",
                value="false",
                value_type="boolean",
                category="order",
                restaurant_id=1,
            )
        )
        db.session.commit()

    response = client.patch(f"/api/driver/me/orders/{order_id}/deliver", headers=driver_headers)
    assert response.status_code == 403
    assert "Awaiting restaurant confirmation" in response.get_json()["error"]


def test_mark_delivered_requires_restaurant_coordinates(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.deliver.depot")
    order_id = _seed_driver_order_pair(app, driver_data["id"], status="assigned")

    with app.app_context():
        restaurant = Restaurant.query.get(1)
        restaurant.latitude = None
        restaurant.longitude = None
        db.session.commit()

    response = client.patch(f"/api/driver/me/orders/{order_id}/deliver", headers=driver_headers)
    assert response.status_code == 400
    assert "depot location" in response.get_json()["error"]


def test_mark_delivered_requires_order_coordinates(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.deliver.coords")
    order_id = _seed_driver_order_pair(app, driver_data["id"], status="assigned", with_coords=False)

    response = client.patch(f"/api/driver/me/orders/{order_id}/deliver", headers=driver_headers)
    assert response.status_code == 400
    assert "coordinates missing" in response.get_json()["error"]


def test_mark_delivered_success_updates_driver_and_order(client, app, auth_headers, monkeypatch):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.deliver.ok")
    order_id = _seed_driver_order_pair(app, driver_data["id"], status="out_for_delivery")

    calls = {"stop": 0, "timer": 0}

    class FakeTimer:
        def __init__(self, delay, callback, args=None):
            self.delay = delay
            self.callback = callback
            self.args = args or ()
            self.daemon = False

        def start(self):
            calls["timer"] += 1

    monkeypatch.setattr("app.routes.driver_me.stop_driver_location_simulation", lambda *args, **kwargs: calls.__setitem__("stop", calls["stop"] + 1))
    monkeypatch.setattr("app.routes.driver_me.threading.Timer", FakeTimer)

    response = client.patch(f"/api/driver/me/orders/{order_id}/deliver", headers=driver_headers)
    assert response.status_code == 200
    body = response.get_json()
    assert body["order"]["status"] == "delivered"
    assert body["order"]["payment_status"] == "Paid"
    assert body["driver"]["status"] == "returning"
    assert body["driver"]["current_order_id"] is None
    assert body["return_trip_minutes"] >= 1
    assert calls["stop"] == 1
    assert calls["timer"] == 1


def test_collect_cash_rejects_non_cod_order(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.cash.noncod")

    with app.app_context():
        driver = Driver.query.get(driver_data["id"])
        driver.restaurant_id = 1
        order = Order(
            customer_name="Cashless Customer",
            customer_phone="+440000006111",
            delivery_address="No Cash Ave",
            status="assigned",
            payment_method="CARD",
            payment_status="Pending",
            restaurant_id=1,
            driver_id=driver.id,
            latitude=51.5074,
            longitude=-0.1278,
        )
        db.session.add(order)
        db.session.commit()
        order_id = order.id

    response = client.patch(f"/api/driver/me/orders/{order_id}/collect_cash", headers=driver_headers)
    assert response.status_code == 400


def test_collect_cash_returns_idempotent_when_already_paid(client, app, auth_headers):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.cash.paid")

    with app.app_context():
        driver = Driver.query.get(driver_data["id"])
        driver.restaurant_id = 1
        order = Order(
            customer_name="Paid Customer",
            customer_phone="+440000006112",
            delivery_address="Paid Road",
            status="assigned",
            payment_method="CASH",
            payment_status="Paid",
            restaurant_id=1,
            driver_id=driver.id,
            latitude=51.5074,
            longitude=-0.1278,
        )
        db.session.add(order)
        db.session.commit()
        order_id = order.id

    response = client.patch(f"/api/driver/me/orders/{order_id}/collect_cash", headers=driver_headers)
    assert response.status_code == 200
    assert response.get_json()["message"] == "Payment already collected"


def test_collect_cash_marks_paid_and_calls_sync(client, app, auth_headers, monkeypatch):
    driver_data, driver_headers = _register_public_driver(client, email_prefix="driver.me.cash.ok")

    with app.app_context():
        driver = Driver.query.get(driver_data["id"])
        driver.restaurant_id = 1
        order = Order(
            customer_name="Cash Customer",
            customer_phone="+440000006113",
            delivery_address="Cash Road",
            status="assigned",
            payment_method="CASH",
            payment_status="Pending",
            restaurant_id=1,
            driver_id=driver.id,
            latitude=51.5074,
            longitude=-0.1278,
        )
        db.session.add(order)
        db.session.commit()
        order_id = order.id

    tracker = {"called": 0}

    def fake_sync(order):
        tracker["called"] += 1
        return True

    monkeypatch.setattr("app.services.order_lifecycle.sync_route_stop_status", fake_sync)

    response = client.patch(f"/api/driver/me/orders/{order_id}/collect_cash", headers=driver_headers)
    assert response.status_code == 200
    assert response.get_json()["order"]["payment_status"] == "Paid"
    assert tracker["called"] == 1


def test_release_driver_to_available_helper(app, client, auth_headers):
    driver_data, _ = _register_public_driver(client, email_prefix="driver.me.release")

    with app.app_context():
        driver = Driver.query.get(driver_data["id"])
        driver.status = "returning"
        driver.current_order_id = 123
        driver.driver_available_at = datetime.now(timezone.utc)
        db.session.commit()

    driver_me_routes._release_driver_to_available(app, driver_data["id"])

    with app.app_context():
        refreshed = Driver.query.get(driver_data["id"])
        assert refreshed.status == "available"
        assert refreshed.current_order_id is None
        assert refreshed.driver_available_at is None
