"""Tests for the Settings API."""

import pytest


class TestSettingsAPI:
    """Settings GET/PUT tests."""

    def test_get_settings_returns_defaults(self, client):
        """GET /api/settings returns default settings."""
        resp = client.get('/api/settings')
        assert resp.status_code == 200
        data = resp.get_json()
        # Should be a flat key-value object
        assert isinstance(data, dict)
        # Should contain known default keys (from DEFAULT_SETTINGS)
        assert 'business_name' in data

    def test_update_settings(self, client):
        """PUT /api/settings updates settings."""
        # First get defaults
        client.get('/api/settings')

        resp = client.put('/api/settings', json={
            'business_name': 'New Name',
            'default_delivery_fee': '5.99',
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'updated' in data
        assert 'business_name' in data['updated']
        assert 'default_delivery_fee' in data['updated']

    def test_update_settings_persists(self, client):
        """PUT /api/settings changes are reflected in GET."""
        client.get('/api/settings')
        client.put('/api/settings', json={'business_name': 'Persisted Name'})

        resp = client.get('/api/settings')
        data = resp.get_json()
        assert data['business_name'] == 'Persisted Name'

    def test_update_settings_no_data(self, client):
        """PUT /api/settings with empty body returns 400."""
        resp = client.put('/api/settings', content_type='application/json', data='')
        assert resp.status_code == 400

    def test_get_single_setting(self, client):
        """GET /api/settings/<key> returns a single setting."""
        # Ensure defaults are created
        client.get('/api/settings')

        resp = client.get('/api/settings/business_name')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'key' in data or 'value' in data

    def test_get_single_setting_not_found(self, client):
        """GET /api/settings/<key> returns 404 for unknown key."""
        resp = client.get('/api/settings/nonExistentKey12345')
        assert resp.status_code == 404

    def test_update_creates_custom_settings(self, client):
        """PUT /api/settings creates new settings for unknown keys."""
        resp = client.put('/api/settings', json={
            'myCustomSetting': 'custom_value',
        })
        assert resp.status_code == 200
        assert 'myCustomSetting' in resp.get_json()['updated']

        # Verify it was persisted
        resp = client.get('/api/settings')
        assert resp.get_json()['myCustomSetting'] == 'custom_value'
