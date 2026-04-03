from app.models.restaurant import Restaurant
from app.models.settings import Settings


def test_get_settings_returns_defaults(client, auth_headers):
    response = client.get("/api/settings", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert "voice_confidence_threshold" in payload
    assert "use_platform_drivers" in payload


def test_update_settings_existing_key(client, app, auth_headers):
    response = client.put(
        "/api/settings",
        headers=auth_headers,
        json={"voice_confidence_threshold": 0.9},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert "voice_confidence_threshold" in body["updated"]

    with app.app_context():
        setting = Settings.query.filter_by(key="voice_confidence_threshold", restaurant_id=1).first()
        assert setting is not None
        assert setting.value == "0.9"


def test_update_settings_creates_custom_setting(client, app, auth_headers):
    response = client.put(
        "/api/settings",
        headers=auth_headers,
        json={"custom_dashboard_label": "Ops Board"},
    )
    assert response.status_code == 200

    with app.app_context():
        setting = Settings.query.filter_by(key="custom_dashboard_label", restaurant_id=1).first()
        assert setting is not None
        assert setting.category == "custom"


def test_update_use_platform_drivers_syncs_restaurant(client, app, auth_headers):
    response = client.put(
        "/api/settings",
        headers=auth_headers,
        json={"use_platform_drivers": True},
    )
    assert response.status_code == 200

    with app.app_context():
        restaurant = Restaurant.query.get(1)
        assert restaurant is not None
        assert restaurant.use_platform_drivers is True


def test_get_single_setting_existing(client, auth_headers):
    client.get("/api/settings", headers=auth_headers)
    response = client.get("/api/settings/voice_confidence_threshold", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["key"] == "voice_confidence_threshold"


def test_get_single_setting_not_found(client, auth_headers):
    response = client.get("/api/settings/does_not_exist", headers=auth_headers)
    assert response.status_code == 404
