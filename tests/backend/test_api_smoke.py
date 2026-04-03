def test_health_endpoint(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "ok"
    assert "database" in payload


def test_create_and_list_order(client, auth_headers, monkeypatch):
    # Keep tests deterministic and avoid external geocoder network calls.
    monkeypatch.setattr("app.routes.orders.get_geocoding_details", lambda *args, **kwargs: {})

    create_response = client.post(
        "/api/orders",
        headers=auth_headers,
        json={
            "customer_name": "Pytest Customer",
            "customer_phone": "+440000000000",
            "delivery_address": "1 Test Lane, London",
            "items": [{"name": "Burger", "quantity": 2, "price": 10.0}],
            "subtotal": 20.0,
            "tax": 1.6,
            "delivery_fee": 4.99,
            "total": 26.59,
            "latitude": 51.5074,
            "longitude": -0.1278,
        },
    )

    assert create_response.status_code == 201
    created_payload = create_response.get_json()
    assert created_payload["customer_name"] == "Pytest Customer"
    assert created_payload["status"] == "pending"

    list_response = client.get("/api/orders", headers=auth_headers)
    assert list_response.status_code == 200
    listed_orders = list_response.get_json()
    assert any(order["id"] == created_payload["id"] for order in listed_orders)
