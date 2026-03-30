"""Tests for the Orders API."""

import pytest


class TestOrdersAPI:
    """Order CRUD and status tests."""

    ORDER_DATA = {
        'customer_name': 'John Doe',
        'customer_phone': '+1234567890',
        'delivery_address': '456 Delivery St',
        'latitude': 51.510,
        'longitude': -0.08,
        'items': [
            {'name': 'Pizza Margherita', 'quantity': 2, 'price': 12.99},
            {'name': 'Caesar Salad', 'quantity': 1, 'price': 8.99},
        ],
    }

    # --- GET ---

    def test_get_orders_empty(self, client):
        """GET /api/orders returns empty list when no orders exist."""
        resp = client.get('/api/orders')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_orders_returns_list(self, client):
        """GET /api/orders returns list of created orders."""
        client.post('/api/orders', json=self.ORDER_DATA)
        resp = client.get('/api/orders')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['customer_name'] == 'John Doe'

    def test_get_orders_filter_by_status(self, client):
        """GET /api/orders?status=pending filters correctly."""
        client.post('/api/orders', json=self.ORDER_DATA)
        resp = client.get('/api/orders?status=pending')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1

        resp = client.get('/api/orders?status=delivered')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_orders_pagination(self, client):
        """GET /api/orders supports page and per_page."""
        for i in range(5):
            d = {**self.ORDER_DATA, 'customer_name': f'Customer {i}'}
            client.post('/api/orders', json=d)

        resp = client.get('/api/orders?page=1&per_page=2')
        assert resp.status_code == 200
        assert len(resp.get_json()) == 2

        resp = client.get('/api/orders?page=3&per_page=2')
        assert resp.status_code == 200
        assert len(resp.get_json()) == 1

    # --- GET by ID ---

    def test_get_order_by_id(self, client):
        """GET /api/orders/<id> returns a specific order."""
        create_resp = client.post('/api/orders', json=self.ORDER_DATA)
        order_id = create_resp.get_json()['id']
        resp = client.get(f'/api/orders/{order_id}')
        assert resp.status_code == 200
        assert resp.get_json()['customer_name'] == 'John Doe'

    def test_get_order_not_found(self, client):
        """GET /api/orders/<id> returns 404 for missing order."""
        resp = client.get('/api/orders/9999')
        assert resp.status_code == 404

    # --- POST ---

    def test_create_order(self, client):
        """POST /api/orders creates a new order."""
        resp = client.post('/api/orders', json=self.ORDER_DATA)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['customer_name'] == 'John Doe'
        assert data['status'] == 'pending'
        assert 'id' in data

    def test_create_order_with_items(self, client):
        """POST /api/orders includes order items."""
        resp = client.post('/api/orders', json=self.ORDER_DATA)
        assert resp.status_code == 201
        data = resp.get_json()
        assert 'items' in data
        assert len(data['items']) == 2

    def test_create_order_missing_fields(self, client):
        """POST /api/orders validates required fields."""
        resp = client.post('/api/orders', json={'customer_name': 'Incomplete'})
        assert resp.status_code == 400
        assert 'Missing required fields' in resp.get_json()['error']

    def test_create_order_no_data(self, client):
        """POST /api/orders with empty body returns 400."""
        resp = client.post('/api/orders', content_type='application/json', data='')
        assert resp.status_code == 400

    # --- PATCH (status update) ---

    def test_update_order_status(self, client):
        """PATCH /api/orders/<id> updates the order status."""
        create_resp = client.post('/api/orders', json=self.ORDER_DATA)
        order_id = create_resp.get_json()['id']

        resp = client.patch(f'/api/orders/{order_id}', json={'status': 'preparing'})
        assert resp.status_code == 200
        assert resp.get_json()['status'] == 'preparing'

    def test_update_order_invalid_status(self, client):
        """PATCH /api/orders/<id> rejects invalid statuses."""
        create_resp = client.post('/api/orders', json=self.ORDER_DATA)
        order_id = create_resp.get_json()['id']

        resp = client.patch(f'/api/orders/{order_id}', json={'status': 'invalid_status'})
        assert resp.status_code == 400
        assert 'Invalid status' in resp.get_json()['error']

    def test_update_order_missing_status(self, client):
        """PATCH /api/orders/<id> requires status field."""
        create_resp = client.post('/api/orders', json=self.ORDER_DATA)
        order_id = create_resp.get_json()['id']

        resp = client.patch(f'/api/orders/{order_id}', json={'notes': 'no status'})
        assert resp.status_code == 400

    def test_update_order_status_to_delivered(self, client):
        """Delivered status sets payment_status to Paid."""
        create_resp = client.post('/api/orders', json=self.ORDER_DATA)
        order_id = create_resp.get_json()['id']

        client.patch(f'/api/orders/{order_id}', json={'status': 'preparing'})
        resp = client.patch(f'/api/orders/{order_id}', json={'status': 'delivered'})
        assert resp.status_code == 200
        assert resp.get_json()['payment_status'] == 'Paid'

    # --- DELETE ---

    def test_delete_order(self, client):
        """DELETE /api/orders/<id> cancels the order."""
        create_resp = client.post('/api/orders', json=self.ORDER_DATA)
        order_id = create_resp.get_json()['id']

        resp = client.delete(f'/api/orders/{order_id}')
        assert resp.status_code == 200
        assert 'cancelled' in resp.get_json()['message']

        # Verify order is cancelled
        get_resp = client.get(f'/api/orders/{order_id}')
        assert get_resp.get_json()['status'] == 'cancelled'

    def test_delete_order_not_found(self, client):
        """DELETE /api/orders/<id> returns 404 for missing order."""
        resp = client.delete('/api/orders/9999')
        assert resp.status_code == 404
