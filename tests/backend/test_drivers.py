"""Tests for the Drivers API."""

import pytest


class TestDriversAPI:
    """Driver CRUD and status tests."""

    DRIVER_DATA = {
        'name': 'Test Driver',
        'phone': '+1234567890',
        'email': 'driver@test.com',
        'vehicle_type': 'Car',
        'vehicle_number': 'ABC-123',
    }

    # --- GET ---

    def test_get_drivers_empty(self, client):
        """GET /api/drivers returns empty list when no drivers exist."""
        resp = client.get('/api/drivers')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_drivers_returns_list(self, client):
        """GET /api/drivers returns created drivers."""
        client.post('/api/drivers', json=self.DRIVER_DATA)
        resp = client.get('/api/drivers')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['name'] == 'Test Driver'

    def test_get_drivers_filter_by_status(self, client):
        """GET /api/drivers?status=available filters correctly."""
        client.post('/api/drivers', json=self.DRIVER_DATA)
        resp = client.get('/api/drivers?status=available')
        data = resp.get_json()
        assert len(data) == 1

        resp = client.get('/api/drivers?status=offline')
        assert resp.get_json() == []

    def test_get_available_drivers(self, client):
        """GET /api/drivers/available returns only available drivers."""
        client.post('/api/drivers', json=self.DRIVER_DATA)
        client.post('/api/drivers', json={**self.DRIVER_DATA, 'name': 'Offline Driver', 'phone': '+999', 'status': 'offline'})

        resp = client.get('/api/drivers/available')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['name'] == 'Test Driver'

    # --- GET by ID ---

    def test_get_driver_by_id(self, client):
        """GET /api/drivers/<id> returns driver details with history."""
        create_resp = client.post('/api/drivers', json=self.DRIVER_DATA)
        driver_id = create_resp.get_json()['id']

        resp = client.get(f'/api/drivers/{driver_id}')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['name'] == 'Test Driver'
        assert 'deliveryHistory' in data
        assert 'performance' in data

    def test_get_driver_not_found(self, client):
        """GET /api/drivers/<id> returns 404 for missing driver."""
        resp = client.get('/api/drivers/NONEXISTENT')
        assert resp.status_code == 404

    # --- POST ---

    def test_create_driver(self, client):
        """POST /api/drivers creates a new driver."""
        resp = client.post('/api/drivers', json=self.DRIVER_DATA)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['name'] == 'Test Driver'
        assert data['status'] == 'available'
        assert data['id'].startswith('DRV')

    def test_create_driver_missing_fields(self, client):
        """POST /api/drivers validates required fields."""
        resp = client.post('/api/drivers', json={'name': 'Incomplete'})
        assert resp.status_code == 400
        assert 'Missing required fields' in resp.get_json()['error']

    def test_create_driver_auto_generates_id(self, client):
        """POST /api/drivers auto-generates unique sequential IDs."""
        resp1 = client.post('/api/drivers', json=self.DRIVER_DATA)
        resp2 = client.post('/api/drivers', json={**self.DRIVER_DATA, 'phone': '+999'})
        assert resp1.get_json()['id'] != resp2.get_json()['id']

    # --- PUT ---

    def test_update_driver(self, client):
        """PUT /api/drivers/<id> updates driver fields."""
        create_resp = client.post('/api/drivers', json=self.DRIVER_DATA)
        driver_id = create_resp.get_json()['id']

        resp = client.put(f'/api/drivers/{driver_id}', json={
            'name': 'Updated Driver',
            'vehicle_type': 'Bicycle',
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['name'] == 'Updated Driver'
        assert data['vehicle_type'] == 'Bicycle'

    def test_update_driver_not_found(self, client):
        """PUT /api/drivers/<id> returns 404 for missing driver."""
        resp = client.put('/api/drivers/NONEXISTENT', json={'name': 'Nope'})
        assert resp.status_code == 404

    # --- PATCH status ---

    def test_update_driver_status(self, client):
        """PATCH /api/drivers/<id>/status changes driver status."""
        create_resp = client.post('/api/drivers', json=self.DRIVER_DATA)
        driver_id = create_resp.get_json()['id']

        resp = client.patch(f'/api/drivers/{driver_id}/status', json={'status': 'offline'})
        assert resp.status_code == 200
        assert resp.get_json()['status'] == 'offline'

    def test_update_driver_invalid_status(self, client):
        """PATCH /api/drivers/<id>/status rejects invalid status."""
        create_resp = client.post('/api/drivers', json=self.DRIVER_DATA)
        driver_id = create_resp.get_json()['id']

        resp = client.patch(f'/api/drivers/{driver_id}/status', json={'status': 'flying'})
        assert resp.status_code == 400
        assert 'Invalid status' in resp.get_json()['error']

    def test_update_driver_status_valid_values(self, client):
        """PATCH /api/drivers/<id>/status accepts all valid statuses."""
        create_resp = client.post('/api/drivers', json=self.DRIVER_DATA)
        driver_id = create_resp.get_json()['id']

        for status in ['on_delivery', 'returning', 'offline', 'available']:
            resp = client.patch(f'/api/drivers/{driver_id}/status', json={'status': status})
            assert resp.status_code == 200
            assert resp.get_json()['status'] == status

    # --- DELETE ---

    def test_delete_driver(self, client):
        """DELETE /api/drivers/<id> removes a driver."""
        create_resp = client.post('/api/drivers', json=self.DRIVER_DATA)
        driver_id = create_resp.get_json()['id']

        resp = client.delete(f'/api/drivers/{driver_id}')
        assert resp.status_code == 200
        assert 'deleted' in resp.get_json()['message']

        # Verify driver is gone
        get_resp = client.get(f'/api/drivers/{driver_id}')
        assert get_resp.status_code == 404

    def test_delete_driver_not_found(self, client):
        """DELETE /api/drivers/<id> returns 404 for missing driver."""
        resp = client.delete('/api/drivers/NONEXISTENT')
        assert resp.status_code == 404
