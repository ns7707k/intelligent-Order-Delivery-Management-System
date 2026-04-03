import requests

from app.utils.geocoder import geocode_address, geocode_address_with_display, get_geocoding_details
from app.utils.haversine import haversine
from app.utils.validators import validate_coordinates, validate_required_fields, validate_status


class _FakeResponse:
    def __init__(self, payload=None, raises=None):
        self._payload = payload if payload is not None else []
        self._raises = raises

    def raise_for_status(self):
        if self._raises:
            raise self._raises

    def json(self):
        return self._payload


def test_validate_required_fields_and_status_and_coordinates():
    assert validate_required_fields({}, ["a", "b"]) == ["a", "b"]
    assert validate_required_fields({"a": "x", "b": " "}, ["a", "b"]) == ["b"]
    assert validate_status("ready", ["pending", "ready"]) is True
    assert validate_status("bad", ["pending", "ready"]) is False
    assert validate_coordinates(51.5, -0.12) is True
    assert validate_coordinates("oops", -0.12) is False


def test_haversine_distance_basics():
    assert haversine(51.5, -0.12, 51.5, -0.12) == 0
    assert haversine(51.5, -0.12, 51.6, -0.1) > 0


def test_geocode_address_empty_input():
    assert geocode_address("") == (None, None)


def test_geocode_address_success(monkeypatch):
    monkeypatch.setattr(
        "app.utils.geocoder.requests.get",
        lambda *args, **kwargs: _FakeResponse(
            payload=[{"lat": "51.5", "lon": "-0.12", "display_name": "London"}]
        ),
    )
    lat, lng = geocode_address("London")
    assert lat == 51.5
    assert lng == -0.12


def test_geocode_address_no_results(monkeypatch):
    monkeypatch.setattr("app.utils.geocoder.requests.get", lambda *args, **kwargs: _FakeResponse(payload=[]))
    assert geocode_address("Unknown") == (None, None)


def test_geocode_address_request_exception(monkeypatch):
    monkeypatch.setattr(
        "app.utils.geocoder.requests.get",
        lambda *args, **kwargs: _FakeResponse(raises=requests.exceptions.RequestException("boom")),
    )
    assert geocode_address("London") == (None, None)


def test_geocode_address_parse_exception(monkeypatch):
    monkeypatch.setattr(
        "app.utils.geocoder.requests.get",
        lambda *args, **kwargs: _FakeResponse(payload=[{"lat": "not-a-number", "lon": "-0.12"}]),
    )
    assert geocode_address("London") == (None, None)


def test_geocode_with_display_and_details(monkeypatch):
    monkeypatch.setattr(
        "app.utils.geocoder.requests.get",
        lambda *args, **kwargs: _FakeResponse(
            payload=[{"lat": "51.5", "lon": "-0.12", "display_name": "Display London"}]
        ),
    )
    resolved = geocode_address_with_display("London")
    assert resolved["display_address"] == "Display London"

    class RestaurantStub:
        latitude = 51.5074
        longitude = -0.1278
        avg_speed_kmh = 30

    details = get_geocoding_details("London", restaurant=RestaurantStub())
    assert details["lat"] == 51.5
    assert "distance_km" in details
    assert "delivery_fee" in details
    assert "platform_fee" in details
    assert "driver_fee" in details


def test_geocoding_details_returns_empty_when_unresolved(monkeypatch):
    monkeypatch.setattr("app.utils.geocoder.geocode_address_with_display", lambda *_: None)
    assert get_geocoding_details("Unknown") == {}
