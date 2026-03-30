"""
Entry point for the ODMS Flask application.
Usage: python run.py
"""

import os
from app import create_app, db
from sqlalchemy import text

# Default to SQLite if no DATABASE_URL is set (no PostgreSQL needed for dev)
if not os.environ.get('DATABASE_URL'):
    os.environ['DATABASE_URL'] = 'sqlite:///odms_dev.db'

config_name = os.environ.get('FLASK_CONFIG', 'development')
app = create_app(config_name)


def _ensure_schema_compatibility():
    """Add newly introduced columns for existing databases."""
    dialect = db.engine.url.get_backend_name()
    sqlite_table_columns = {
        'drivers': {
            'owner_type': "TEXT NOT NULL DEFAULT 'restaurant'",
            'is_platform_driver': 'BOOLEAN NOT NULL DEFAULT 0',
            'driver_available_at': 'TIMESTAMP',
            'assigned_at': 'TIMESTAMP',
            'current_order_id': 'INTEGER',
        },
        'restaurants': {
            'use_platform_drivers': 'BOOLEAN NOT NULL DEFAULT 0',
        },
        'orders': {
            'driver_pickup_eta': 'FLOAT',
            'driver_available_again_minutes': 'FLOAT',
            'driver_available_at': 'TIMESTAMP',
            'assigned_at': 'TIMESTAMP',
            'restaurant_id': 'INTEGER',
            'platform_fee': 'FLOAT DEFAULT 0.0',
            'driver_fee': 'FLOAT DEFAULT 0.0',
        },
        'routes': {
            'restaurant_id': 'INTEGER',
        },
        'settings': {
            'restaurant_id': 'INTEGER',
        },
        'users': {
            'must_change_password': 'BOOLEAN NOT NULL DEFAULT 0',
        },
    }

    postgres_table_columns = {
        'drivers': {
            'owner_type': "TEXT NOT NULL DEFAULT 'restaurant'",
            'is_platform_driver': 'BOOLEAN NOT NULL DEFAULT FALSE',
            'driver_available_at': 'TIMESTAMPTZ',
            'assigned_at': 'TIMESTAMPTZ',
            'current_order_id': 'INTEGER',
        },
        'restaurants': {
            'use_platform_drivers': 'BOOLEAN NOT NULL DEFAULT FALSE',
        },
        'orders': {
            'driver_pickup_eta': 'DOUBLE PRECISION',
            'driver_available_again_minutes': 'DOUBLE PRECISION',
            'driver_available_at': 'TIMESTAMPTZ',
            'assigned_at': 'TIMESTAMPTZ',
            'restaurant_id': 'INTEGER',
            'platform_fee': 'DOUBLE PRECISION',
            'driver_fee': 'DOUBLE PRECISION',
        },
        'routes': {
            'restaurant_id': 'INTEGER',
        },
        'settings': {
            'restaurant_id': 'INTEGER',
        },
        'users': {
            'must_change_password': 'BOOLEAN NOT NULL DEFAULT FALSE',
        },
    }

    if dialect == 'sqlite':
        for table, additions in sqlite_table_columns.items():
            existing = {
                row[1]
                for row in db.session.execute(text(f'PRAGMA table_info({table})')).fetchall()
            }
            for column, ddl in additions.items():
                if column in existing:
                    continue
                db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))
    elif dialect in ('postgresql', 'postgres'):
        for table, additions in postgres_table_columns.items():
            for column, ddl in additions.items():
                db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {ddl}'))
    else:
        return

    # Backfill ownership for existing rows so assignment keeps working.
    restaurant = db.session.execute(text('SELECT id FROM restaurants ORDER BY id LIMIT 1')).fetchone()
    if restaurant:
        restaurant_id = restaurant[0]
        db.session.execute(text(
            "UPDATE drivers "
            "SET owner_type = COALESCE(owner_type, 'restaurant'), "
            "    is_platform_driver = COALESCE(is_platform_driver, FALSE), "
            "    restaurant_id = COALESCE(restaurant_id, :restaurant_id) "
            "WHERE COALESCE(owner_type, 'restaurant') = 'restaurant'"
        ), {'restaurant_id': restaurant_id})
        db.session.execute(text(
            "UPDATE drivers SET owner_type = 'platform', restaurant_id = NULL "
            "WHERE is_platform_driver = TRUE"
        ))
        db.session.execute(text(
            "UPDATE orders SET restaurant_id = COALESCE(restaurant_id, :restaurant_id)"
        ), {'restaurant_id': restaurant_id})
        db.session.execute(text(
            "UPDATE routes SET restaurant_id = COALESCE(restaurant_id, :restaurant_id)"
        ), {'restaurant_id': restaurant_id})
        db.session.execute(text(
            "UPDATE settings SET restaurant_id = COALESCE(restaurant_id, :restaurant_id)"
        ), {'restaurant_id': restaurant_id})
    db.session.commit()

# Auto-create tables on startup
with app.app_context():
    db.create_all()
    try:
        _ensure_schema_compatibility()
    except Exception as e:
        print(f'[WARN] Schema compatibility check failed (will retry on next request): {e}')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG'])
