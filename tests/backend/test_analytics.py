"""Tests for the Analytics API."""

import pytest


class TestAnalyticsAPI:
    """Analytics endpoint tests."""

    ORDER_DATA = {
        'customer_name': 'Analytics Customer',
        'customer_phone': '+1234567890',
        'delivery_address': '789 Analytics Blvd',
        'latitude': 51.510,
        'longitude': -0.08,
        'total': 34.97,
        'items': [
            {'name': 'Burger', 'quantity': 2, 'price': 10.99},
            {'name': 'Fries', 'quantity': 1, 'price': 4.99},
        ],
    }

    def _seed_orders(self, client, count=3):
        """Create sample orders for analytics testing."""
        for i in range(count):
            data = {**self.ORDER_DATA, 'customer_name': f'Customer {i}'}
            client.post('/api/orders', json=data)

    # --- /api/analytics/summary ---

    def test_summary_empty(self, client):
        """GET /api/analytics/summary returns zeroes when no orders."""
        resp = client.get('/api/analytics/summary')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'revenue' in data
        assert 'orders' in data
        assert 'drivers' in data
        assert 'topItems' in data
        assert 'hourlyDistribution' in data
        assert data['revenue']['total'] == 0
        assert data['orders']['total'] == 0

    def test_summary_with_orders(self, client):
        """GET /api/analytics/summary returns metrics with orders."""
        self._seed_orders(client, count=3)
        resp = client.get('/api/analytics/summary')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['orders']['total'] == 3
        assert data['revenue']['total'] >= 0

    def test_summary_time_range_filter(self, client):
        """GET /api/analytics/summary?timeRange=today works."""
        self._seed_orders(client, count=2)
        resp = client.get('/api/analytics/summary?timeRange=today')
        assert resp.status_code == 200
        data = resp.get_json()
        # Orders created now should appear in "today" range
        assert data['orders']['total'] == 2

    def test_summary_top_items(self, client):
        """GET /api/analytics/summary includes top items."""
        self._seed_orders(client, count=2)
        resp = client.get('/api/analytics/summary')
        data = resp.get_json()
        assert isinstance(data['topItems'], list)
        if data['topItems']:
            item = data['topItems'][0]
            assert 'name' in item
            assert 'orders' in item
            assert 'revenue' in item

    def test_summary_hourly_distribution(self, client):
        """GET /api/analytics/summary includes hourly distribution."""
        self._seed_orders(client, count=2)
        resp = client.get('/api/analytics/summary')
        data = resp.get_json()
        assert isinstance(data['hourlyDistribution'], list)
        if data['hourlyDistribution']:
            entry = data['hourlyDistribution'][0]
            assert 'hour' in entry
            assert 'orders' in entry

    # --- /api/analytics/orders ---

    def test_order_analytics(self, client):
        """GET /api/analytics/orders returns order metrics."""
        self._seed_orders(client)
        resp = client.get('/api/analytics/orders')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'total' in data
        assert 'byStatus' in data
        assert data['total'] == 3

    # --- /api/analytics/drivers ---

    def test_driver_analytics_empty(self, client):
        """GET /api/analytics/drivers returns metrics for no drivers."""
        resp = client.get('/api/analytics/drivers')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['total'] == 0

    def test_driver_analytics_with_drivers(self, client):
        """GET /api/analytics/drivers returns driver metrics."""
        client.post('/api/drivers', json={'name': 'Driver A', 'phone': '+111'})
        client.post('/api/drivers', json={'name': 'Driver B', 'phone': '+222', 'status': 'offline'})

        resp = client.get('/api/analytics/drivers')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['total'] == 2
        assert data['available'] == 1
        assert data['offline'] == 1

    # --- /api/analytics/top-items ---

    def test_top_items_endpoint(self, client):
        """GET /api/analytics/top-items returns top selling items."""
        self._seed_orders(client)
        resp = client.get('/api/analytics/top-items')
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)

    # --- /api/analytics/hourly ---

    def test_hourly_endpoint(self, client):
        """GET /api/analytics/hourly returns hourly distribution."""
        self._seed_orders(client)
        resp = client.get('/api/analytics/hourly')
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
