from app import db
from app.models.user import User


def test_restaurant_registration_success(client):
    payload = {
        "email": "register.success@odms.test",
        "password": "TestPass123!",
        "restaurant_name": "Auth Test Restaurant",
        "phone": "+440000000011",
        "address": "1 Test Street, London",
        "latitude": 51.5074,
        "longitude": -0.1278,
    }
    response = client.post("/api/auth/register/restaurant", json=payload)
    assert response.status_code == 201
    body = response.get_json()
    assert "token" in body
    assert body["user"]["role"] == "restaurant_admin"


def test_restaurant_registration_duplicate_email(client):
    payload = {
        "email": "register.duplicate@odms.test",
        "password": "TestPass123!",
        "restaurant_name": "Dup Restaurant",
        "phone": "+440000000012",
        "address": "1 Test Street, London",
        "latitude": 51.5074,
        "longitude": -0.1278,
    }
    first = client.post("/api/auth/register/restaurant", json=payload)
    second = client.post("/api/auth/register/restaurant", json=payload)
    assert first.status_code == 201
    assert second.status_code == 409


def test_restaurant_registration_missing_fields(client):
    response = client.post(
        "/api/auth/register/restaurant",
        json={"email": "missing@odms.test", "password": "TestPass123!"},
    )
    assert response.status_code == 400


def test_login_valid_credentials(client, register_restaurant):
    _, payload = register_restaurant(email="login.valid@odms.test")
    response = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert response.status_code == 200
    assert "token" in response.get_json()


def test_login_wrong_password(client, register_restaurant):
    _, payload = register_restaurant(email="login.wrong@odms.test")
    response = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": "WrongPass123!"},
    )
    assert response.status_code == 401


def test_login_nonexistent_email(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "missing.user@odms.test", "password": "TestPass123!"},
    )
    assert response.status_code == 401


def test_login_inactive_account(client, app, register_restaurant):
    _, payload = register_restaurant(email="login.inactive@odms.test")
    with app.app_context():
        user = User.query.filter_by(email=payload["email"]).first()
        user.is_active = False
        db.session.commit()

    response = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert response.status_code == 403


def test_protected_endpoint_without_token(client):
    response = client.get("/api/orders")
    assert response.status_code == 401


def test_protected_endpoint_with_valid_token(client, auth_headers):
    response = client.get("/api/orders", headers=auth_headers)
    assert response.status_code == 200


def test_auth_me_returns_current_user(client, auth_headers):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["role"] == "restaurant_admin"
    assert payload["email"].endswith("@odms.test")
