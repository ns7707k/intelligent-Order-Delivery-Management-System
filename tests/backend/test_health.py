"""Tests for the Health Check API."""


class TestHealthCheck:
    """Health endpoint tests."""

    def test_health_returns_ok(self, client):
        """GET /api/health returns 200 with status ok."""
        resp = client.get('/api/health')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['status'] == 'ok'
        assert data['database'] == 'ok'
        assert 'timestamp' in data
        assert data['version'] == '1.0.0'
