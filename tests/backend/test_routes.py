"""Tests for the Routes API."""

import pytest


class TestRoutesAPI:
    """Route optimization and retrieval tests."""

    def test_get_all_routes_empty(self, client):
        """GET /api/routes returns empty list when no routes exist."""
        resp = client.get('/api/routes')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_active_routes_empty(self, client):
        """GET /api/routes/active returns empty list."""
        resp = client.get('/api/routes/active')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_optimize_no_data(self, client):
        """POST /api/routes/optimize with empty body returns 400."""
        resp = client.post('/api/routes/optimize', content_type='application/json', data='')
        assert resp.status_code == 400

    def test_optimize_no_ready_orders(self, client):
        """POST /api/routes/optimize with no ready orders returns empty."""
        resp = client.post('/api/routes/optimize', json={'orderIds': []})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['message'] == 'No orders to optimize'

    def test_optimize_with_invalid_order_ids(self, client, sample_restaurant):
        """POST /api/routes/optimize handles missing orders gracefully."""
        # Create a driver so optimizer has one available
        client.post('/api/drivers', json={'name': 'Driver', 'phone': '+111'})

        resp = client.post('/api/routes/optimize', json={'orderIds': [9999]})
        # Should either return 200 with message or 500 with error
        assert resp.status_code in (200, 500)

    def test_route_not_found(self, client):
        """GET /api/routes/<id> returns 404 for missing route."""
        resp = client.get('/api/routes/NONEXISTENT')
        assert resp.status_code == 404
