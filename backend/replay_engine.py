import sqlite3
import time
import requests
from datetime import datetime
import statistics
from math import radians, sin, cos, sqrt, atan2

DB_PATH = "instance/odms_dev.db"
API_BASE = "http://localhost:5000/api"
SPEED = 1
LIMIT = 100
FCFS_MULTIPLIER = 1.35
SLA_MINUTES = 45
EVAL_ADMIN_EMAIL = "eval.admin@odms.local"
EVAL_ADMIN_PASSWORD = "EvalPass123!"


def haversine(lat1, lon1, lat2, lon2):
    radius_km = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius_km * atan2(sqrt(a), sqrt(1 - a))


def fcfs_assign(orders, drivers):
    """
    First Come First Serve baseline:
    Assign each order to the next driver in queue order, ignoring distance optimization.
    Returns list of FCFS delivery times in minutes.
    """

    if not drivers:
        return []

    avg_speed_kmh = 30
    avg_extra_wait_minutes = 5
    driver_index = 0
    times = []

    for order in orders:
        _driver = drivers[driver_index % len(drivers)]
        driver_index += 1

        dist_km = haversine(
            order["depot_lat"],
            order["depot_lng"],
            order["lat"],
            order["lng"],
        )
        delivery_time = (dist_km / avg_speed_kmh * 60) + avg_extra_wait_minutes
        times.append(float(delivery_time))

    return times


def _get_auth_headers():
    """Authenticate as evaluation restaurant admin and return bearer headers."""
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": EVAL_ADMIN_EMAIL, "password": EVAL_ADMIN_PASSWORD},
        timeout=10,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Auth failed: HTTP {response.status_code} {response.text}")

    payload = response.json() or {}
    token = payload.get("token")
    if not token:
        raise RuntimeError("Auth failed: token missing in login response")
    return {"Authorization": f"Bearer {token}"}


def _safe_get_drivers_snapshot(headers):
    """Return (available_count, total_count) from the live API, or (0, 0) on failure."""
    try:
        response = requests.get(f"{API_BASE}/drivers", headers=headers, timeout=10)
        if response.status_code != 200:
            return 0, 0
        drivers = response.json() or []
        total = len(drivers)
        available = sum(1 for d in drivers if d.get("status") == "available")
        return available, total
    except Exception:
        return 0, 0


def _safe_get_drivers(headers):
    """Return full driver list from API, or empty list on failure."""
    try:
        response = requests.get(f"{API_BASE}/drivers", headers=headers, timeout=10)
        if response.status_code != 200:
            return []
        return response.json() or []
    except Exception:
        return []


def replay():
    headers = _get_auth_headers()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    orders = conn.execute(
        """
        SELECT id, created_at, latitude, longitude, restaurant_id
        FROM orders
        WHERE status = 'delivered'
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        ORDER BY created_at ASC
        """,
    ).fetchall()

    restaurants = conn.execute(
        """
        SELECT id, latitude, longitude, max_delivery_radius_km
        FROM restaurants
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """
    ).fetchall()
    conn.close()

    restaurant_config_by_id = {
        int(row["id"]): {
            "lat": float(row["latitude"]),
            "lng": float(row["longitude"]),
            "max_radius_km": float(row["max_delivery_radius_km"] or 15.0),
        }
        for row in restaurants
    }

    # Keep replay sample aligned with the production service area constraints.
    serviceable_orders = []
    for row in orders:
        restaurant_id = row["restaurant_id"]
        if restaurant_id is None:
            continue
        cfg = restaurant_config_by_id.get(int(restaurant_id))
        if not cfg:
            continue

        distance_km = haversine(
            cfg["lat"],
            cfg["lng"],
            float(row["latitude"]),
            float(row["longitude"]),
        )
        if distance_km <= cfg["max_radius_km"]:
            serviceable_orders.append(row)

    orders = serviceable_orders[:LIMIT]

    if not orders:
        print("[ERROR] No delivered orders with coordinates found. Run ETL pipeline first.")
        return

    vrp_times = []
    fcfs_times = []
    fcfs_order_inputs = []
    on_time_count = 0
    failed = 0

    # Driver idle tracking (sampled over replay time)
    idle_ratio_samples = []

    print(f"\n{'=' * 50}")
    print("ODMS EVALUATION - VRP vs FCFS COMPARISON")
    print(f"{'=' * 50}")
    print(f"Orders to replay: {len(orders)}")
    print(f"Started at: {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'=' * 50}\n")

    started_at = time.time()

    for row in orders:
        order_id = int(row["id"])
        order_lat = float(row["latitude"])
        order_lng = float(row["longitude"])
        restaurant_id = row["restaurant_id"]

        available_count, total_count = _safe_get_drivers_snapshot(headers)
        if total_count > 0:
            idle_ratio_samples.append(available_count / total_count)

        try:
            response = requests.patch(
                f"{API_BASE}/orders/{order_id}",
                json={"status": "ready"},
                headers=headers,
                timeout=10,
            )

            if response.status_code == 200:
                data = response.json() or {}
                vrp_time = data.get("estimated_delivery_minutes", 0)

                if vrp_time and vrp_time > 0:
                    vrp_time = float(vrp_time)
                    vrp_times.append(vrp_time)

                    if restaurant_id is not None and int(restaurant_id) in restaurant_config_by_id:
                        cfg = restaurant_config_by_id[int(restaurant_id)]
                        depot_lat, depot_lng = cfg["lat"], cfg["lng"]
                        fcfs_order_inputs.append(
                            {
                                "order_id": order_id,
                                "depot_lat": depot_lat,
                                "depot_lng": depot_lng,
                                "lat": order_lat,
                                "lng": order_lng,
                            }
                        )

                    if vrp_time <= SLA_MINUTES:
                        on_time_count += 1

                    print(
                        f"  Order {order_id}: VRP={vrp_time:.1f}min  "
                        f"{'OK SLA' if vrp_time <= SLA_MINUTES else 'LATE'}"
                    )
                else:
                    failed += 1
            else:
                failed += 1
                print(f"  Order {order_id}: FAILED - HTTP {response.status_code}")

        except Exception as exc:
            failed += 1
            print(f"  Order {order_id}: FAILED - {exc}")

        # Keep pacing reasonable while still finishing quickly.
        time.sleep(0.5 / max(SPEED, 1))

    if not vrp_times:
        print("\n[ERROR] No results captured. Check backend is running and orders have coordinates.")
        return

    drivers = _safe_get_drivers(headers)
    fcfs_times = fcfs_assign(fcfs_order_inputs, drivers)
    if not fcfs_times:
        print("\n[ERROR] FCFS baseline could not be computed (missing drivers or depot coordinates).")
        return

    replay_count = min(len(vrp_times), len(fcfs_times))
    vrp_times = vrp_times[:replay_count]
    fcfs_times = fcfs_times[:replay_count]

    replay_duration_minutes = (time.time() - started_at) / 60.0

    vrp_avg = statistics.mean(vrp_times)
    fcfs_avg = statistics.mean(fcfs_times)
    vrp_min = min(vrp_times)
    vrp_max = max(vrp_times)
    vrp_med = statistics.median(vrp_times)
    improvement = (1 - vrp_avg / fcfs_avg) * 100 if fcfs_avg else 0.0
    on_time_rate = (on_time_count / len(vrp_times)) * 100

    avg_idle_ratio = statistics.mean(idle_ratio_samples) if idle_ratio_samples else 0.0
    estimated_idle_minutes = replay_duration_minutes * avg_idle_ratio

    print(f"\n{'=' * 50}")
    print("EVALUATION RESULTS SUMMARY")
    print(f"{'=' * 50}")
    print(f"Total orders replayed  : {replay_count}")
    print(f"Failed/skipped         : {failed}")
    print("")
    print("VRP DELIVERY TIMES")
    print(f"  Average              : {vrp_avg:.1f} min")
    print(f"  Median               : {vrp_med:.1f} min")
    print(f"  Minimum              : {vrp_min:.1f} min")
    print(f"  Maximum              : {vrp_max:.1f} min")
    print("")
    print("FCFS BASELINE (algorithmic queue assignment)")
    print(f"  Average              : {fcfs_avg:.1f} min")
    print("")
    print(f"EFFICIENCY GAIN        : {improvement:.1f}%")
    print(f"SLA Compliance (<={SLA_MINUTES}min): {on_time_rate:.1f}%")
    print(f"({on_time_count}/{replay_count} orders within SLA)")
    print("")
    print("DRIVER IDLE METRIC (sampled during replay)")
    print(f"  Avg idle ratio       : {avg_idle_ratio * 100:.1f}%")
    print(f"  Estimated idle time  : {estimated_idle_minutes:.2f} min over replay window")
    print(f"{'=' * 50}\n")


if __name__ == "__main__":
    replay()
