"""
Database initialization and migration helper.
Creates all tables and runs initial setup.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import create_app, db
from app.models import Order, OrderItem, Driver, Route, RouteStop, Settings


def init_database(config_name='development'):
    """Initialize the database with all tables."""
    app = create_app(config_name)
    with app.app_context():
        print("Creating all database tables...")
        db.create_all()
        print("Database tables created successfully!")
        print("\nTables:")
        for table in db.metadata.sorted_tables:
            print(f"  - {table.name}")
        return app


def drop_database(config_name='development'):
    """Drop all database tables (USE WITH CAUTION)."""
    app = create_app(config_name)
    with app.app_context():
        confirm = input("Are you sure you want to drop all tables? (yes/no): ")
        if confirm.lower() == 'yes':
            db.drop_all()
            print("All tables dropped.")
        else:
            print("Aborted.")


def reset_database(config_name='development'):
    """Drop and recreate all tables, then seed with demo data."""
    app = create_app(config_name)
    with app.app_context():
        print("Dropping all tables...")
        db.drop_all()
        print("Creating all tables...")
        db.create_all()
        print("Database reset complete!")

    # Run seeder
    from database.seed import seed_all
    seed_all()


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='ODMS Database Management')
    parser.add_argument('action', choices=['init', 'drop', 'reset'],
                        help='Database action: init, drop, or reset')
    parser.add_argument('--config', default='development',
                        help='Configuration name (development, testing, production)')

    args = parser.parse_args()

    if args.action == 'init':
        init_database(args.config)
    elif args.action == 'drop':
        drop_database(args.config)
    elif args.action == 'reset':
        reset_database(args.config)
