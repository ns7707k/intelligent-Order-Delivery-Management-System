"""Tests for the Restaurant API."""

import pytest


class TestRestaurantAPI:
    """Restaurant CRUD tests."""

    RESTAURANT_DATA = {
        'name': 'Test Restaurant',
        'phone': '+1234567890',
        'email': 'test@restaurant.com',
        'address': '123 Test St',
        'latitude': 51.505,
        'longitude': -0.09,
        'max_delivery_radius_km': 15.0,
        'avg_speed_kmh': 30.0,
    }

    def test_get_restaurant_empty(self, client):
        """GET /api/restaurant returns null when no restaurant registered."""
        resp = client.get('/api/restaurant')
        assert resp.status_code == 200
        # Returns null/None when no restaurant exists
        assert resp.get_json() is None

    def test_register_restaurant(self, client):
        """POST /api/restaurant creates a new restaurant."""
        resp = client.post('/api/restaurant', json=self.RESTAURANT_DATA)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['name'] == 'Test Restaurant'
        assert data['latitude'] == 51.505
        assert data['longitude'] == -0.09

    def test_register_duplicate_restaurant(self, client):
        """POST /api/restaurant fails if restaurant already exists."""
        client.post('/api/restaurant', json=self.RESTAURANT_DATA)
        resp = client.post('/api/restaurant', json=self.RESTAURANT_DATA)
        assert resp.status_code == 409
        assert 'already registered' in resp.get_json()['error']

    def test_register_restaurant_missing_fields(self, client):
        """POST /api/restaurant validates required fields."""
        resp = client.post('/api/restaurant', json={'name': 'Incomplete'})
        assert resp.status_code == 400
        assert 'Missing required fields' in resp.get_json()['error']

    def test_get_restaurant_after_register(self, client):
        """GET /api/restaurant returns registered restaurant data."""
        client.post('/api/restaurant', json=self.RESTAURANT_DATA)
        resp = client.get('/api/restaurant')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['name'] == 'Test Restaurant'

    def test_update_restaurant(self, client):
        """PUT /api/restaurant updates restaurant profile."""
        client.post('/api/restaurant', json=self.RESTAURANT_DATA)
        resp = client.put('/api/restaurant', json={'name': 'Updated Name', 'phone': '+9999999'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['name'] == 'Updated Name'
        assert data['phone'] == '+9999999'

    def test_update_nonexistent_restaurant(self, client):
        """PUT /api/restaurant fails if no restaurant exists."""
        resp = client.put('/api/restaurant', json={'name': 'Nope'})
        assert resp.status_code == 404
