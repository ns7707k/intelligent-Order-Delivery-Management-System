import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = PROJECT_ROOT / 'amazon_delivery.csv'
DB_PATH = PROJECT_ROOT / 'backend' / 'instance' / 'odms_dev.db'
STORE_RADIUS_KM = 15
TARGET_AREA = {'urban', 'metropolitian', 'metropolitan'}
MAX_ORDERS = 500


def haversine(lat1, lon1, lat2, lon2):
    radius_km = 6371
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlam = np.radians(lon2 - lon1)
    value = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2) ** 2
    return 2 * radius_km * np.arcsin(np.sqrt(value))


def _normalize_area(value):
    if pd.isna(value):
        return ''
    return str(value).strip().lower()


def _pickup_minutes(order_time, pickup_time):
    if pd.isna(order_time) or pd.isna(pickup_time):
        return None

    order_timestamp = pd.to_datetime(str(order_time), format='%H:%M:%S', errors='coerce')
    pickup_timestamp = pd.to_datetime(str(pickup_time), format='%H:%M:%S', errors='coerce')

    if pd.isna(order_timestamp) or pd.isna(pickup_timestamp):
        return None

    delta_minutes = (pickup_timestamp - order_timestamp).total_seconds() / 60
    if delta_minutes < 0:
        delta_minutes += 24 * 60
    return int(round(delta_minutes))


def _vehicle_type_counts(df):
    if 'vehicle_type' not in df.columns:
        return {}
    counts = df['vehicle_type'].value_counts().to_dict()
    return {key: int(value) for key, value in counts.items()}


def _select_depot_cluster(df):
    working_df = df.copy()
    working_df = working_df[
        ~(
            working_df['Store_Latitude'].abs() < 0.0001
        ) | ~(
            working_df['Store_Longitude'].abs() < 0.0001
        )
    ]

    if working_df.empty:
        raise ValueError('No valid store coordinates found after filtering out zero-coordinate rows')

    working_df['store_lat_round'] = working_df['Store_Latitude'].round(3)
    working_df['store_lng_round'] = working_df['Store_Longitude'].round(3)

    dominant_cluster = (
        working_df.groupby(['store_lat_round', 'store_lng_round'])
        .size()
        .sort_values(ascending=False)
        .index[0]
    )

    cluster_rows = working_df[
        (working_df['store_lat_round'] == dominant_cluster[0])
        & (working_df['store_lng_round'] == dominant_cluster[1])
    ].copy()

    depot_lat = float(cluster_rows['Store_Latitude'].median())
    depot_lon = float(cluster_rows['Store_Longitude'].median())
    return depot_lat, depot_lon, cluster_rows


def run_etl(csv_path=CSV_PATH, db_path=DB_PATH):
    csv_path = Path(csv_path)
    db_path = Path(db_path)

    print('-- Loading CSV --')
    print(f'  CSV path: {csv_path}')
    if not csv_path.exists():
        raise FileNotFoundError(f'Dataset not found at {csv_path}')

    df = pd.read_csv(csv_path)
    print(f'  Raw rows: {len(df)}')

    df.columns = df.columns.str.strip()
    df = df.dropna(subset=['Store_Latitude', 'Store_Longitude', 'Drop_Latitude', 'Drop_Longitude'])

    numeric_columns = ['Store_Latitude', 'Store_Longitude', 'Drop_Latitude', 'Drop_Longitude']
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors='coerce')
    df = df.dropna(subset=numeric_columns)
    df = df[
        df['Store_Latitude'].between(-90, 90)
        & df['Store_Longitude'].between(-180, 180)
        & df['Drop_Latitude'].between(-90, 90)
        & df['Drop_Longitude'].between(-180, 180)
    ]

    if 'Area' in df.columns:
        df['normalized_area'] = df['Area'].map(_normalize_area)
        df = df[df['normalized_area'].isin(TARGET_AREA)]

    depot_lat, depot_lon, _cluster_rows = _select_depot_cluster(df)
    print(f'  Depot centre: {depot_lat:.4f}, {depot_lon:.4f}')

    df['dist_km'] = haversine(depot_lat, depot_lon, df['Drop_Latitude'], df['Drop_Longitude'])
    df = df[df['dist_km'] <= STORE_RADIUS_KM]
    print(f'  After radius filter: {len(df)} rows')

    df['created_at'] = pd.to_datetime(
        df['Order_Date'].astype(str).str.strip() + ' ' + df['Order_Time'].astype(str).str.strip(),
        errors='coerce',
    )
    df = df.dropna(subset=['created_at'])

    minimum_time = df['created_at'].min()
    maximum_time = df['created_at'].max()
    original_span = (maximum_time - minimum_time).total_seconds()
    start_time = datetime.now() - timedelta(days=30)
    df['created_at'] = df['created_at'].apply(
        lambda timestamp: start_time + timedelta(
            seconds=(30 * 24 * 3600) * (timestamp - minimum_time).total_seconds() / max(original_span, 1)
        )
    )

    vehicle_map = {
        'van': 'Car',
        'motorcycle': 'Motorcycle',
        'scooter': 'Motorcycle',
        'bicycle': 'Bike',
        'electric_scooter': 'Motorcycle',
    }
    if 'Vehicle' in df.columns:
        df['vehicle_type'] = (
            df['Vehicle']
            .astype(str)
            .str.strip()
            .str.lower()
            .map(vehicle_map)
            .fillna('Car')
        )

    if 'Pickup_Time' in df.columns:
        df['estimated_delivery_minutes'] = df.apply(
            lambda row: _pickup_minutes(row.get('Order_Time'), row.get('Pickup_Time')),
            axis=1,
        )
    else:
        df['estimated_delivery_minutes'] = None

    if 'Traffic' in df.columns:
        df['traffic_level'] = df['Traffic'].astype(str).str.strip().str.lower()

    df = df.sort_values('created_at').head(MAX_ORDERS).reset_index(drop=True)
    print(f'  Final order count: {len(df)}')

    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM orders WHERE notes LIKE 'Amazon dataset import%'")

    inserted = 0
    for index, row in df.iterrows():
        subtotal = round(float(np.random.uniform(8, 35)), 2)
        tax = round(subtotal * 0.08, 2)
        delivery_fee = 4.99
        total = round(subtotal + tax + delivery_fee, 2)
        created_at = row['created_at'].isoformat()
        eta_minutes = row.get('estimated_delivery_minutes')
        customer_number = index + 1

        cursor.execute(
            """
            INSERT INTO orders (
                customer_name,
                customer_phone,
                customer_email,
                delivery_address,
                notes,
                status,
                payment_method,
                payment_status,
                subtotal,
                tax,
                delivery_fee,
                total,
                latitude,
                longitude,
                created_at,
                updated_at,
                estimated_delivery_minutes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f'Customer {customer_number}',
                f'+447{700000000 + customer_number:09d}',
                f'customer{customer_number}@example.com',
                f'Drop Location {customer_number}',
                f'Amazon dataset import | Area: {str(row.get("Area", "")).strip()} | Traffic: {str(row.get("Traffic", "")).strip()}',
                'delivered',
                'Card',
                'Paid',
                subtotal,
                tax,
                delivery_fee,
                total,
                float(row['Drop_Latitude']),
                float(row['Drop_Longitude']),
                created_at,
                created_at,
                int(eta_minutes) if pd.notna(eta_minutes) else None,
            ),
        )
        inserted += cursor.rowcount

    connection.commit()
    connection.close()

    print(f'  Inserted {inserted} orders into DB')
    print(f'  Depot: lat={depot_lat}, lon={depot_lon}')
    print(f'  Vehicle mix: {_vehicle_type_counts(df)}')
    print('-- ETL complete --')

    return {
        'depot_lat': depot_lat,
        'depot_lon': depot_lon,
        'rows_loaded': inserted,
        'vehicle_mix': _vehicle_type_counts(df),
    }


if __name__ == '__main__':
    run_etl()
