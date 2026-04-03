from app import db
from app.models.affiliation_request import AffiliationRequest


def _register_public_driver(client, email):
    response = client.post(
        "/api/auth/register/driver/public",
        json={
            "email": email,
            "password": "driverpass123",
            "name": "Public Driver",
            "phone": "+440000002222",
            "vehicle_type": "Bike",
        },
    )
    assert response.status_code == 201
    token = response.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_driver_apply_affiliation_requires_restaurant_id(client):
    driver_headers = _register_public_driver(client, "driver.apply1@odms.test")
    response = client.post("/api/affiliation/apply", headers=driver_headers, json={})
    assert response.status_code == 400


def test_driver_apply_affiliation_success(client):
    driver_headers = _register_public_driver(client, "driver.apply2@odms.test")
    response = client.post(
        "/api/affiliation/apply",
        headers=driver_headers,
        json={"restaurant_id": 1},
    )
    assert response.status_code == 201
    assert response.get_json()["status"] == "pending"


def test_driver_apply_affiliation_duplicate_pending(client):
    driver_headers = _register_public_driver(client, "driver.apply3@odms.test")
    first = client.post(
        "/api/affiliation/apply",
        headers=driver_headers,
        json={"restaurant_id": 1},
    )
    assert first.status_code == 201

    second = client.post(
        "/api/affiliation/apply",
        headers=driver_headers,
        json={"restaurant_id": 1},
    )
    assert second.status_code == 409


def test_driver_my_affiliation_requests(client):
    driver_headers = _register_public_driver(client, "driver.apply4@odms.test")
    client.post("/api/affiliation/apply", headers=driver_headers, json={"restaurant_id": 1})

    response = client.get("/api/affiliation/my-requests", headers=driver_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)
    assert len(payload) == 1


def test_restaurant_can_approve_request(client, app, auth_headers):
    driver_headers = _register_public_driver(client, "driver.apply5@odms.test")
    create = client.post("/api/affiliation/apply", headers=driver_headers, json={"restaurant_id": 1})
    req_id = create.get_json()["id"]

    response = client.post(f"/api/affiliation/restaurant/requests/{req_id}/approve", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()["status"] == "approved"


def test_restaurant_can_reject_request(client, app, auth_headers):
    driver_headers = _register_public_driver(client, "driver.apply6@odms.test")
    create = client.post("/api/affiliation/apply", headers=driver_headers, json={"restaurant_id": 1})
    req_id = create.get_json()["id"]

    response = client.post(f"/api/affiliation/restaurant/requests/{req_id}/reject", headers=auth_headers)
    assert response.status_code == 200

    with app.app_context():
        req = AffiliationRequest.query.get(req_id)
        assert req.status == "rejected"


def test_restaurant_pending_requests_list(client, auth_headers):
    driver_headers = _register_public_driver(client, "driver.apply7@odms.test")
    client.post("/api/affiliation/apply", headers=driver_headers, json={"restaurant_id": 1})

    response = client.get("/api/affiliation/restaurant/requests", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.get_json(), list)
