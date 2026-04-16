import pytest

from app import db
from app.models.settings import Settings
from app.services import route_optimizer


def test_depot_uses_business_address_fallback_without_restaurant(app, monkeypatch):
    with app.app_context():
        db.session.add(
            Settings(
                key="business_address",
                value="221B Baker Street, London",
                value_type="string",
                category="general",
                restaurant_id=None,
            )
        )
        db.session.commit()

        monkeypatch.setattr("app.utils.geocoder.geocode_address", lambda address: (51.5237, -0.1585))
        depot = route_optimizer._get_restaurant_depot()

        assert depot["restaurant_id"] is None
        assert depot["lat"] == pytest.approx(51.5237)
        assert depot["lng"] == pytest.approx(-0.1585)
