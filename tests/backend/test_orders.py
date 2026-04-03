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
