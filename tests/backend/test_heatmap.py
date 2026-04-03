from datetime import datetime, timezone

from app import db
from app.models.order import Order


def _seed_order(app, status="ready", lat=51.5, lng=-0.12):
    with app.app_context():
        order = Order(
            customer_name="Heat Customer",
            customer_phone="+440000003333",
            delivery_address="Heat Street",
            status=status,
            subtotal=10.0,
            tax=1.0,
            delivery_fee=2.0,
            total=13.0,
            latitude=lat,
            longitude=lng,
            restaurant_id=1,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(order)
        db.session.commit()


def test_live_heatmap_returns_points(client, app, auth_headers):
    _seed_order(app, status="preparing")
    response = client.get("/api/heatmap/live", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)
    assert payload[0]["lat"] == 51.5


def test_predictive_heatmap_returns_clusters_or_fallback(client, app, auth_headers):
    _seed_order(app, status="delivered", lat=51.51, lng=-0.11)
    _seed_order(app, status="delivered", lat=51.52, lng=-0.10)

    response = client.get("/api/heatmap/predictive?days=30", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)
    assert len(payload) >= 1


def test_predictive_heatmap_empty_when_no_orders(client, auth_headers):
    response = client.get("/api/heatmap/predictive?days=30", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json() == []
