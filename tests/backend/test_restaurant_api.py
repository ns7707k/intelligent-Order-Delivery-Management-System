def test_public_restaurants_list(client, auth_headers):
    response = client.get("/api/restaurants", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)
    assert len(payload) >= 1


def test_public_restaurant_not_found(client, auth_headers):
    response = client.get("/api/restaurants/99999", headers=auth_headers)
    assert response.status_code == 404


def test_get_restaurant_profile(client, auth_headers):
    response = client.get("/api/restaurant", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["id"] == 1


def test_register_restaurant_when_exists_returns_409(client, auth_headers):
    response = client.post(
        "/api/restaurant",
        headers=auth_headers,
        json={"name": "New", "address": "Somewhere"},
    )
    assert response.status_code == 409


def test_update_restaurant_requires_payload(client, auth_headers):
    response = client.put("/api/restaurant", headers=auth_headers, json={})
    assert response.status_code == 400


def test_update_restaurant_invalid_radius(client, auth_headers):
    response = client.put(
        "/api/restaurant",
        headers=auth_headers,
        json={"max_delivery_radius_km": -1},
    )
    assert response.status_code == 400


def test_update_restaurant_success(client, auth_headers):
    response = client.put(
        "/api/restaurant",
        headers=auth_headers,
        json={"name": "Updated Restaurant", "avg_speed_kmh": 35},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["name"] == "Updated Restaurant"
    assert payload["avg_speed_kmh"] == 35.0
