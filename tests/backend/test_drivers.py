from datetime import datetime, timedelta, timezone

from app import db
from app.models.driver import Driver


def _create_driver(client, headers, name="Driver One", status="available"):
    response = client.post(
        "/api/drivers",
        headers=headers,
        json={
            "name": name,
            "phone": "+440000001111",
            "email": f"{name.lower().replace(' ', '.')}@odms.test",
            "vehicle_type": "Car",
            "status": status,
            "current_latitude": 51.5074,
            "current_longitude": -0.1278,
        },
    )
    assert response.status_code == 201
    return response.get_json()


def test_create_driver_success(client, auth_headers):
    created = _create_driver(client, auth_headers)
    assert created["name"] == "Driver One"


def test_get_all_drivers(client, auth_headers):
    _create_driver(client, auth_headers)
    response = client.get("/api/drivers", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.get_json(), list)


def test_get_available_drivers_filter(client, auth_headers):
    _create_driver(client, auth_headers, name="Available Driver", status="available")
    _create_driver(client, auth_headers, name="Offline Driver", status="offline")

    response = client.get("/api/drivers?status=available", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert all(driver["status"] == "available" for driver in payload)


def test_update_driver_status(client, auth_headers):
    created = _create_driver(client, auth_headers)
    response = client.patch(
        f"/api/drivers/{created['id']}/status",
        headers=auth_headers,
        json={"status": "offline"},
    )
    assert response.status_code == 200
    assert response.get_json()["status"] == "offline"


def test_invalid_driver_status(client, auth_headers):
    created = _create_driver(client, auth_headers)
    response = client.patch(
        f"/api/drivers/{created['id']}/status",
        headers=auth_headers,
        json={"status": "flying"},
    )
    assert response.status_code == 400


def test_driver_self_heal_overdue_returning(client, app, auth_headers):
    created = _create_driver(client, auth_headers, status="returning")

    with app.app_context():
        driver = Driver.query.get(created["id"])
        driver.status = "returning"
        driver.driver_available_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        db.session.commit()

    response = client.get("/api/drivers", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    healed = next(item for item in payload if item["id"] == created["id"])
    assert healed["status"] == "available"


def test_delete_driver_success(client, auth_headers):
    created = _create_driver(client, auth_headers)
    response = client.delete(f"/api/drivers/{created['id']}", headers=auth_headers)
    assert response.status_code == 200


def test_get_driver_by_id(client, auth_headers):
    created = _create_driver(client, auth_headers)
    response = client.get(f"/api/drivers/{created['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()["id"] == created["id"]
