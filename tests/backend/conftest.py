import os
import uuid

import pytest

from app import create_app, db
from app.models.affiliation_request import AffiliationRequest
from app.models.driver import Driver
from app.models.order import Order, OrderItem
from app.models.restaurant import Restaurant
from app.models.route import Route, RouteStop
from app.models.settings import Settings
from app.models.user import User


def _unique_email(prefix):
    return f"{prefix}.{uuid.uuid4().hex[:8]}@odms.test"


@pytest.fixture(scope="session")
def app():
    # Use development mode so auth middleware is active, but isolate to test DB.
    os.environ["DATABASE_URL"] = "sqlite:///odms_test_pytest.db"
    os.environ.pop("TESTING", None)

    application = create_app("development")

    with application.app_context():
        db.drop_all()
        db.create_all()

    yield application

    with application.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture(autouse=True)
def clean_db(app):
    with app.app_context():
        db.session.query(RouteStop).delete()
        db.session.query(Route).delete()
        db.session.query(OrderItem).delete()
        db.session.query(Order).delete()
        db.session.query(AffiliationRequest).delete()
        db.session.query(User).delete()
        db.session.query(Driver).delete()
        db.session.query(Settings).delete()
        db.session.query(Restaurant).delete()
        db.session.commit()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def register_restaurant(client):
    def _register(email=None, password="TestPass123!", name="Test Restaurant"):
        payload = {
            "email": email or _unique_email("admin"),
            "password": password,
            "restaurant_name": name,
            "phone": "+440000000001",
            "address": "10 Downing Street, London",
            # Provide explicit coordinates to avoid external geocoder dependency in tests.
            "latitude": 51.5074,
            "longitude": -0.1278,
        }
        response = client.post("/api/auth/register/restaurant", json=payload)
        return response, payload

    return _register


@pytest.fixture()
def auth_headers(client, register_restaurant):
    response, payload = register_restaurant()
    assert response.status_code == 201

    login_response = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login_response.status_code == 200
    token = login_response.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def second_restaurant_headers(client, register_restaurant):
    response, payload = register_restaurant(name="Second Restaurant")
    assert response.status_code == 201

    login_response = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login_response.status_code == 200
    token = login_response.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}
