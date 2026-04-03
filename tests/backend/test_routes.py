from app import db
from app.models.driver import Driver
from app.models.route import Route


def _seed_driver_and_route(app, route_status="active"):
    with app.app_context():
        driver = Driver(
            id="DRV_ROUTE_001",
            name="Route Driver",
            phone="+440000009999",
            email="route.driver@odms.test",
            vehicle_type="Car",
            status="on_delivery",
            active_deliveries=1,
            owner_type="restaurant",
            current_latitude=51.5074,
            current_longitude=-0.1278,
        )
        db.session.add(driver)
        db.session.flush()

        route = Route(
            id="ROUTE_TEST_001",
            driver_id=driver.id,
            restaurant_id=1,
            status=route_status,
            total_distance=3.5,
            estimated_time=14,
            total_orders=1,
        )
        db.session.add(route)
        db.session.commit()
        return route.id, driver.id


def test_optimize_without_payload_returns_400(client, auth_headers):
    response = client.post("/api/routes/optimize", headers=auth_headers, json={})
    assert response.status_code == 400


def test_optimize_with_no_ready_orders_returns_empty(client, auth_headers):
    response = client.post("/api/routes/optimize", headers=auth_headers, json={"orderIds": []})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["routes"] == []


def test_get_active_routes(client, app, auth_headers):
    route_id, _ = _seed_driver_and_route(app, route_status="active")
    response = client.get("/api/routes/active", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert any(route["id"] == route_id for route in payload)


def test_get_all_routes_filter_by_status(client, app, auth_headers):
    route_id, _ = _seed_driver_and_route(app, route_status="completed")
    response = client.get("/api/routes?status=completed", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert any(route["id"] == route_id for route in payload)


def test_get_route_by_id(client, app, auth_headers):
    route_id, _ = _seed_driver_and_route(app, route_status="active")
    response = client.get(f"/api/routes/{route_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()["id"] == route_id


def test_complete_route_marks_completed_and_frees_driver(client, app, auth_headers):
    route_id, driver_id = _seed_driver_and_route(app, route_status="active")
    response = client.post(f"/api/routes/{route_id}/complete", headers=auth_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "completed"

    with app.app_context():
        driver = Driver.query.get(driver_id)
        assert driver.active_deliveries == 0
        assert driver.status == "available"
