import pytest
from datetime import datetime, timezone, timedelta


def test_geocoding_fee_split(app, db, sample_restaurant, monkeypatch):
    """get_geocoding_details should compute delivery_fee and platform/driver split."""
    from app.utils import geocoder
    from app.models.restaurant import Restaurant

    # Stub external geocode to return nearby coords
    monkeypatch.setattr(
        'app.utils.geocoder.geocode_address_with_display',
        lambda address: {'lat': 51.506, 'lng': -0.089, 'display_address': 'Fake Addr'}
    )

    restaurant = Restaurant.query.first()
    assert restaurant is not None

    details = geocoder.get_geocoding_details('Some Fake Address', restaurant)
    assert 'delivery_fee' in details
    assert 'platform_fee' in details
    assert 'driver_fee' in details

    delivery_fee = details['delivery_fee']
    assert float(details['platform_fee']) == round(delivery_fee * 0.2, 2)
    assert float(details['driver_fee']) == round(delivery_fee * 0.8, 2)


def test_returning_driver_selected(app, db, client, sample_restaurant):
    """_route_optimizer should prefer a returning driver if their available time yields faster ETA."""
    from app.services import route_optimizer
    from app.models.driver import Driver
    from app.models.order import Order
    from app.models.restaurant import Restaurant
    from app import db as _db

    # Create a returning driver who will be available shortly
    resp = client.post('/api/drivers', json={
        'id': 'DRVRET',
        'name': 'Returner',
        'phone': '+100',
        'status': 'returning'
    })
    assert resp.status_code == 201

    # Update driver to set driver_available_at shortly in the future
    driver_ret = Driver.query.get('DRVRET')
    now = datetime.now(timezone.utc)
    driver_ret.driver_available_at = now + timedelta(minutes=1)
    driver_ret.current_latitude = None
    driver_ret.current_longitude = None
    _db.session.commit()

    # Create an available driver located farther from depot
    resp2 = client.post('/api/drivers', json={
        'id': 'DRVAV',
        'name': 'FarAway',
        'phone': '+101',
        'status': 'available',
        'current_latitude': 51.520,
        'current_longitude': -0.100,
    })
    assert resp2.status_code == 201

    # Create an order near the restaurant
    order_resp = client.post('/api/orders', json={
        'customer_name': 'Tester',
        'customer_phone': '+102',
        'delivery_address': 'Nearby',
        'latitude': 51.506,
        'longitude': -0.089,
        'items': [],
    })
    assert order_resp.status_code == 201
    order_json = order_resp.get_json()
    order = Order.query.get(order_json['id'])

    depot = route_optimizer._get_restaurant_depot()
    drivers = [Driver.query.get('DRVRET'), Driver.query.get('DRVAV')]
    selected = route_optimizer._select_driver_scored(drivers, order, depot, depot['max_radius_km'])

    assert selected is not None
    assert selected['driver'].id == 'DRVRET'
