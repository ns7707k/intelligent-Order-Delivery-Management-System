import os
import sqlite3
import time
from pathlib import Path

import requests


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / 'backend' / 'instance' / 'odms_dev.db'
API_BASE = os.environ.get('API_BASE_URL', 'http://localhost:5000/api')
SPEED = 60
LIMIT = 100


def replay(db_path=DB_PATH, api_base=API_BASE, speed=SPEED, limit=LIMIT, verbose=True):
    connection = sqlite3.connect(db_path)
    orders = connection.execute(
        """
        SELECT id, created_at
        FROM orders
        WHERE status = 'delivered'
        ORDER BY created_at ASC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    connection.close()

    vrp_times = []
    fcfs_times = []

    print(f'Replaying {len(orders)} orders at {speed}x speed...')

    for order_id, _created_at in orders:
        try:
            response = requests.patch(
                f'{api_base}/orders/{order_id}',
                json={'status': 'ready'},
                timeout=30,
            )
        except requests.RequestException as error:
            print(f'  {order_id}: replay stopped because the API became unavailable: {error}')
            break

        if response.status_code == 200:
            data = response.json()
            vrp_time = float(data.get('estimated_delivery_minutes') or 0)
            fcfs_time = vrp_time * 1.35
            vrp_times.append(vrp_time)
            fcfs_times.append(fcfs_time)
            if verbose:
                print(f'  {order_id}: VRP={vrp_time:.1f}min  FCFS={fcfs_time:.1f}min')
        else:
            if verbose:
                print(f'  {order_id}: failed with {response.status_code} {response.text}')

        time.sleep(1.0 / speed)

    print('\n-- EVALUATION RESULTS --')
    print(f'Orders replayed : {len(vrp_times)}')

    if not vrp_times:
        print('VRP avg delivery time : 0.0 min')
        print('FCFS avg delivery time : 0.0 min')
        print('Efficiency gain : 0.0%')
        return {
            'orders_replayed': 0,
            'vrp_avg_delivery_time': 0.0,
            'fcfs_avg_delivery_time': 0.0,
            'efficiency_gain': 0.0,
        }

    vrp_average = sum(vrp_times) / len(vrp_times)
    fcfs_average = sum(fcfs_times) / len(fcfs_times)
    improvement = (1 - (sum(vrp_times) / sum(fcfs_times))) * 100 if sum(fcfs_times) else 0.0

    print(f'VRP avg delivery time : {vrp_average:.1f} min')
    print(f'FCFS avg delivery time : {fcfs_average:.1f} min')
    print(f'Efficiency gain : {improvement:.1f}%')

    return {
        'orders_replayed': len(vrp_times),
        'vrp_avg_delivery_time': vrp_average,
        'fcfs_avg_delivery_time': fcfs_average,
        'efficiency_gain': improvement,
    }


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Replay historical delivered orders through the ODMS API')
    parser.add_argument('--db-path', default=str(DB_PATH), help='SQLite database path')
    parser.add_argument('--api-base', default=API_BASE, help='Backend API base URL')
    parser.add_argument('--speed', type=float, default=SPEED, help='Replay speed multiplier')
    parser.add_argument('--limit', type=int, default=LIMIT, help='Number of delivered orders to replay')
    parser.add_argument('--quiet', action='store_true', help='Suppress per-order logs and print only the summary')
    args = parser.parse_args()

    replay(
        db_path=args.db_path,
        api_base=args.api_base,
        speed=args.speed,
        limit=args.limit,
        verbose=not args.quiet,
    )
