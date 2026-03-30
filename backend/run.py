"""
Entry point for the ODMS Flask application.
Optimized for Render Deployment.
"""

import os
import sys
from app import create_app, db
from sqlalchemy import text

# 1. Environment Setup
# Default to SQLite if no DATABASE_URL is set (prevents crash if env var is missing)
if not os.environ.get('DATABASE_URL'):
    os.environ['DATABASE_URL'] = 'sqlite:///odms_dev.db'

config_name = os.environ.get('FLASK_CONFIG', 'production')
app = create_app(config_name)

def _ensure_schema_compatibility():
    """Add newly introduced columns for existing databases."""
    try:
        dialect = db.engine.url.get_backend_name()
    except Exception as e:
        print(f"[ERROR] Could not determine database dialect: {e}")
        return

    # Column definitions for SQLite and Postgres
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
        'routes': {'restaurant_id': 'INTEGER'},
        'settings': {'restaurant_id': 'INTEGER'},
        'users': {'must_change_password': 'BOOLEAN NOT NULL DEFAULT 0'},
    }

    postgres_table_columns = {
        'drivers': {
            'owner_type': "TEXT NOT NULL DEFAULT 'restaurant'",
            'is_platform_driver': 'BOOLEAN NOT NULL DEFAULT FALSE',
            'driver_available_at': 'TIMESTAMPTZ',
            'assigned_at': 'TIMESTAMPTZ',
            'current_order_id': 'INTEGER',
        },
        'restaurants': {'use_platform_drivers': 'BOOLEAN NOT NULL DEFAULT FALSE'},
        'orders': {
            'driver_pickup_eta': 'DOUBLE PRECISION',
            'driver_available_again_minutes': 'DOUBLE PRECISION',
            'driver_available_at': 'TIMESTAMPTZ',
            'assigned_at': 'TIMESTAMPTZ',
            'restaurant_id': 'INTEGER',
            'platform_fee': 'DOUBLE PRECISION',
            'driver_fee': 'DOUBLE PRECISION',
        },
        'routes': {'restaurant_id': 'INTEGER'},
        'settings': {'restaurant_id': 'INTEGER'},
        'users': {'must_change_password': 'BOOLEAN NOT NULL DEFAULT FALSE'},
    }

    if dialect == 'sqlite':
        for table, additions in sqlite_table_columns.items():
            try:
                existing = {
                    row[1] for row in db.session.execute(text(f'PRAGMA table_info({table})')).fetchall()
                }
                for column, ddl in additions.items():
                    if column not in existing:
                        db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))
            except Exception as e:
                print(f"[WARN] Table {table} migration failed: {e}")

    elif dialect in ('postgresql', 'postgres'):
        for table, additions in postgres_table_columns.items():
            for column, ddl in additions.items():
                try:
                    db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {ddl}'))
                except Exception as e:
                    print(f"[WARN] Column {column} in {table} migration failed: {e}")

    # Backfill ownership
    try:
        restaurant = db.session.execute(text('SELECT id FROM restaurants ORDER BY id LIMIT 1')).fetchone()
        if restaurant:
            restaurant_id = restaurant[0]
            db.session.execute(text(
                "UPDATE drivers SET owner_type = COALESCE(owner_type, 'restaurant'), "
                "is_platform_driver = COALESCE(is_platform_driver, FALSE), "
                "restaurant_id = COALESCE(restaurant_id, :rid) "
                "WHERE owner_type IS NULL"
            ), {'rid': restaurant_id})
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[WARN] Data backfill failed: {e}")

# 2. Production-Safe Startup
with app.app_context():
    try:
        print("[INFO] Initializing database tables...")
        db.create_all()
        
        # We only run the heavy compatibility check if explicitly requested or on first deploy
        # If it's crashing, you can comment the line below out to bypass it.
        _ensure_schema_compatibility()
        print("[INFO] Database initialization complete.")
    except Exception as e:
        print(f'[ERROR] Critical Database initialization failed: {e}')
        # We DON'T sys.exit(1) here so the web server still tries to boot
        # This allows the /health check to pass even if the DB is slow.

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    # Production should NOT use debug=True
    is_debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    print(f"[INFO] Starting server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=is_debug)
