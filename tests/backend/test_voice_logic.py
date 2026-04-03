from app.models.settings import Settings


def test_voice_threshold_config_present(app):
    threshold = app.config.get("VOICE_CONFIDENCE_THRESHOLD")
    assert isinstance(threshold, float)
    assert 0.0 <= threshold <= 1.0


def test_voice_defaults_exposed_in_settings(client, auth_headers):
    response = client.get("/api/settings", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert "voice_auto_start" in payload
    assert "voice_confirmation_required" in payload
    assert "voice_confidence_threshold" in payload


def test_voice_settings_update_round_trip(client, app, auth_headers):
    update = client.put(
        "/api/settings",
        headers=auth_headers,
        json={
            "voice_auto_start": False,
            "voice_confirmation_required": False,
            "voice_confidence_threshold": 0.75,
        },
    )
    assert update.status_code == 200

    readback = client.get("/api/settings", headers=auth_headers)
    assert readback.status_code == 200
    payload = readback.get_json()
    assert payload["voice_auto_start"] is False
    assert payload["voice_confirmation_required"] is False

    with app.app_context():
        stored = Settings.query.filter_by(key="voice_confidence_threshold", restaurant_id=1).first()
        assert stored is not None
        assert stored.value == "0.75"
