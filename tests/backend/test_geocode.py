def test_public_geocode_requires_address(client):
    response = client.get("/api/geocode")
    assert response.status_code == 400


def test_public_geocode_success(client, monkeypatch):
    def fake_geocode_details(address, restaurant):
        return {
            "lat": 51.5,
            "lng": -0.12,
            "display_address": "London",
            "distance_km": 2.2,
            "delivery_fee": 3.1,
            "eta_minutes": 8,
        }

    monkeypatch.setattr("app.routes.geocode.get_geocoding_details", fake_geocode_details)

    response = client.get("/api/geocode?address=London")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["lat"] == 51.5


def test_public_geocode_not_found(client, monkeypatch):
    monkeypatch.setattr("app.routes.geocode.get_geocoding_details", lambda *_: {})
    response = client.get("/api/geocode?address=unknown")
    assert response.status_code == 404


def test_orders_geocode_requires_address(client, auth_headers):
    response = client.get("/api/orders/geocode", headers=auth_headers)
    assert response.status_code == 400


def test_orders_geocode_success(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.routes.orders.get_geocoding_details",
        lambda *_: {
            "lat": 51.6,
            "lng": -0.1,
            "display_address": "Address",
            "distance_km": 4.5,
            "delivery_fee": 4.0,
            "eta_minutes": 12,
        },
    )
    response = client.get("/api/orders/geocode?address=Address", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()["delivery_fee"] == 4.0


def test_orders_geocode_not_found(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.routes.orders.get_geocoding_details", lambda *_: None)
    response = client.get("/api/orders/geocode?address=unknown", headers=auth_headers)
    assert response.status_code == 404
