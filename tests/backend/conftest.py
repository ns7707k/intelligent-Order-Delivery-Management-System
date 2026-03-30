"""
Pytest fixtures for backend tests.
Creates a test Flask app with an in-memory SQLite database.
"""

import os
import sys
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from app import create_app, db as _db


@pytest.fixture(scope='session')
def app():
    """Create a test Flask application."""
    os.environ['TEST_DATABASE_URL'] = 'sqlite:///:memory:'
    application = create_app('testing')
    application.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    application.config['TESTING'] = True

    with application.app_context():
        _db.create_all()

    yield application

    with application.app_context():
        _db.drop_all()


@pytest.fixture(scope='function')
def db(app):
    """Provide a clean database for each test."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app, db):
    """Provide a test client."""
    return app.test_client()


@pytest.fixture
def sample_restaurant(client):
    """Create a sample restaurant."""
    data = {
        'name': 'Test Restaurant',
        'phone': '+1234567890',
        'email': 'test@restaurant.com',
        'address': '123 Test St',
        'latitude': 51.505,
        'longitude': -0.09,
        'max_delivery_radius_km': 15.0,
        'avg_speed_kmh': 30.0,
    }
    response = client.post('/api/restaurant', json=data)
    return response.get_json()


@pytest.fixture
def sample_driver(client, sample_restaurant):
    """Create a sample driver."""
    data = {
        'name': 'Test Driver',
        'phone': '+1234567890',
        'email': 'driver@test.com',
        'vehicle_type': 'Car',
        'vehicle_number': 'TEST-001',
        'status': 'available',
    }
    response = client.post('/api/drivers', json=data)
    return response.get_json()


@pytest.fixture
def sample_order(client):
    """Create a sample order."""
    data = {
        'customer_name': 'John Doe',
        'customer_phone': '+1234567890',
        'delivery_address': '456 Delivery St',
        'latitude': 51.510,
        'longitude': -0.08,
        'items': [
            {'name': 'Pizza', 'quantity': 2, 'price': 12.99},
            {'name': 'Salad', 'quantity': 1, 'price': 8.99},
        ],
    }
    response = client.post('/api/orders', json=data)
    return response.get_json()
