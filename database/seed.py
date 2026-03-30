"""
Database seed script.
Populates the database with realistic demo data for immediate frontend testing.
"""

import os
import sys
import random
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import create_app, db
from app.models.order import Order, OrderItem
from app.models.driver import Driver
from app.models.restaurant import Restaurant
from app.models.route import Route, RouteStop
from app.models.settings import Settings, DEFAULT_SETTINGS


# ---- Demo Data ----

DRIVERS_DATA = [
    {
        'id': 'DRV001', 'name': 'Mike Johnson',
        'phone': '+44 20 7946 1001', 'email': 'mike.j@delivery.com',
        'vehicle_type': 'Car', 'vehicle_number': 'ABC-1234',
        'license_number': 'DL123456789',
        'address': '45 Baker Street, Marylebone, London W1U 8EW',
        'emergency_contact': '+44 20 7946 2101',
        'status': 'available',
        'owner_type': 'restaurant',
        'is_platform_driver': False,
        'current_latitude': 51.510, 'current_longitude': -0.095,
        'total_deliveries': 145, 'rating': 4.8,
        'on_time_deliveries': 142, 'late_deliveries': 3,
        'average_delivery_time': 28,
    },
    {
        'id': 'DRV002', 'name': 'Sarah Williams',
        'phone': '+44 20 7946 1002', 'email': 'sarah.w@delivery.com',
        'vehicle_type': 'Motorcycle', 'vehicle_number': 'XYZ-5678',
        'license_number': 'DL987654321',
        'address': '102 Shoreditch High Street, London E1 6JN',
        'emergency_contact': '+44 20 7946 2102',
        'status': 'on_delivery',
        'owner_type': 'restaurant',
        'is_platform_driver': False,
        'current_latitude': 51.515, 'current_longitude': -0.10,
        'total_deliveries': 203, 'rating': 4.9,
        'on_time_deliveries': 198, 'late_deliveries': 5,
        'average_delivery_time': 25,
    },
    {
        'id': 'DRV003', 'name': 'Tom Davis',
        'phone': '+44 20 7946 1003', 'email': 'tom.d@delivery.com',
        'vehicle_type': 'Bike', 'vehicle_number': 'BIK-9012',
        'license_number': 'DL456789012',
        'address': '18 Southwark Bridge Road, London SE1 9HF',
        'emergency_contact': '+44 20 7946 2103',
        'status': 'available',
        'owner_type': 'restaurant',
        'is_platform_driver': False,
        'current_latitude': 51.500, 'current_longitude': -0.085,
        'total_deliveries': 89, 'rating': 4.6,
        'on_time_deliveries': 84, 'late_deliveries': 5,
        'average_delivery_time': 32,
    },
    {
        'id': 'DRV004', 'name': 'Emily Chen',
        'phone': '+44 20 7946 1004', 'email': 'emily.c@delivery.com',
        'vehicle_type': 'Car', 'vehicle_number': 'DEF-3456',
        'license_number': 'DL112233445',
        'address': '27 Camden High Street, London NW1 7JE',
        'emergency_contact': '+44 20 7946 2104',
        'status': 'available',
        'owner_type': 'restaurant',
        'is_platform_driver': False,
        'current_latitude': 51.508, 'current_longitude': -0.088,
        'total_deliveries': 167, 'rating': 4.7,
        'on_time_deliveries': 160, 'late_deliveries': 7,
        'average_delivery_time': 26,
    },
    {
        'id': 'DRV005', 'name': 'James Wilson',
        'phone': '+44 20 7946 1005', 'email': 'james.w@delivery.com',
        'vehicle_type': 'Motorcycle', 'vehicle_number': 'GHI-7890',
        'license_number': 'DL556677889',
        'address': '60 Greenwich High Road, London SE10 8LF',
        'emergency_contact': '+44 20 7946 2105',
        'status': 'offline',
        'owner_type': 'platform',
        'is_platform_driver': True,
        'restaurant_id': None,
        'current_latitude': 51.512, 'current_longitude': -0.092,
        'total_deliveries': 56, 'rating': 4.5,
        'on_time_deliveries': 52, 'late_deliveries': 4,
        'average_delivery_time': 30,
    },
]

MENU_ITEMS = [
    ('Margherita Pizza', 12.99),
    ('Chicken Burger', 11.99),
    ('Caesar Salad', 8.99),
    ('Pasta Carbonara', 13.99),
    ('Garlic Bread', 4.99),
    ('Fish & Chips', 14.99),
    ('Veggie Wrap', 9.99),
    ('Chicken Wings', 10.99),
    ('Mushroom Risotto', 15.99),
    ('Chocolate Brownie', 6.99),
    ('Grilled Salmon', 18.99),
    ('BBQ Ribs', 16.99),
]

CUSTOMER_NAMES = [
    'John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Brown',
    'Charlie Davis', 'Diana Evans', 'Frank Garcia', 'Hannah Jones',
    'Ivan Kim', 'Julia Lee', 'Kevin Martin', 'Laura Nelson',
    'Marcus Patel', 'Natalie Ross', 'Oliver Thompson', 'Patricia White',
]

ADDRESSES = [
    '12 Floral Street, Covent Garden, London WC2E 9DH',
    '221B Baker Street, Marylebone, London NW1 6XE',
    '38 Great Russell Street, Bloomsbury, London WC1B 3PH',
    '75 King Street, Hammersmith, London W6 9HW',
    '14 Bermondsey Street, London SE1 3UD',
    '29 Portobello Road, Notting Hill, London W11 3DB',
    '92 Upper Street, Islington, London N1 0NP',
    '6 Brick Lane, Shoreditch, London E1 6RF',
    '41 The Broadway, Wimbledon, London SW19 1QE',
    '17 Greenwich Church Street, London SE10 9BJ',
]

LONDON_LAT_RANGE = (51.4, 51.6)
LONDON_LNG_RANGE = (-0.3, 0.1)
LONDON_DEPOT = (51.5074, -0.1278)


def _in_london_bounds(lat, lng):
    return LONDON_LAT_RANGE[0] <= lat <= LONDON_LAT_RANGE[1] and LONDON_LNG_RANGE[0] <= lng <= LONDON_LNG_RANGE[1]


def seed_restaurant():
    """Seed or update the single restaurant depot in central London."""
    print("Seeding restaurant...")
    restaurant = Restaurant.query.first()

    if restaurant:
        restaurant.name = restaurant.name or 'London Takeaway Hub'
        restaurant.address = restaurant.address or '10 Downing Street, Westminster, London SW1A 2AA'
        restaurant.latitude = LONDON_DEPOT[0]
        restaurant.longitude = LONDON_DEPOT[1]
        restaurant.use_platform_drivers = bool(restaurant.use_platform_drivers)
    else:
        restaurant = Restaurant(
            name='London Takeaway Hub',
            phone='+44 20 7946 9000',
            email='ops@londontakeawayhub.co.uk',
            address='10 Downing Street, Westminster, London SW1A 2AA',
            latitude=LONDON_DEPOT[0],
            longitude=LONDON_DEPOT[1],
            opens_at='09:00',
            closes_at='23:00',
            max_delivery_radius_km=15.0,
            avg_speed_kmh=30.0,
            use_platform_drivers=False,
        )
        db.session.add(restaurant)

    db.session.commit()
    print("  -> Restaurant depot seeded at London coordinates")


def seed_drivers():
    """Seed the drivers table."""
    print("Seeding drivers...")
    restaurant = Restaurant.query.first()
    restaurant_id = restaurant.id if restaurant else None
    for data in DRIVERS_DATA:
        payload = dict(data)
        if payload.get('owner_type') == 'restaurant' and payload.get('restaurant_id') is None:
            payload['restaurant_id'] = restaurant_id
        driver = Driver.query.get(data['id'])
        if not driver:
            driver = Driver(**payload)
            db.session.add(driver)
    db.session.commit()
    print(f"  -> {len(DRIVERS_DATA)} drivers seeded")


def seed_orders(count=50):
    """Seed orders with items."""
    print(f"Seeding {count} orders...")
    now = datetime.now(timezone.utc)

    statuses = ['pending', 'preparing', 'ready', 'delivered', 'delivered',
                'delivered', 'delivered', 'cancelled']
    center_lat, center_lng = LONDON_DEPOT

    for i in range(count):
        # Random time within last 30 days
        created = now - timedelta(
            days=random.uniform(0, 30),
            hours=random.uniform(0, 24),
        )
        status = random.choice(statuses)

        # Random items
        num_items = random.randint(1, 4)
        selected_items = random.sample(MENU_ITEMS, num_items)
        quantities = [random.randint(1, 3) for _ in range(num_items)]

        subtotal = sum(price * qty for (_, price), qty in zip(selected_items, quantities))
        tax = round(subtotal * 0.08, 2)
        delivery_fee = 4.99
        total = round(subtotal + tax + delivery_fee, 2)

        lat = center_lat + random.uniform(-0.05, 0.05)
        lng = center_lng + random.uniform(-0.05, 0.05)

        # Assign driver to non-pending orders
        driver_id = None
        if status in ['ready', 'delivered']:
            driver_id = random.choice(['DRV001', 'DRV002', 'DRV003', 'DRV004'])

        order = Order(
            customer_name=random.choice(CUSTOMER_NAMES),
            customer_phone=f'+44 20 7{random.randint(100, 999)} {random.randint(1000, 9999)}',
            customer_email=f'customer{i}@example.com',
            delivery_address=random.choice(ADDRESSES),
            notes=random.choice(['', '', '', 'Extra napkins please', 'Ring doorbell twice', 'Leave at door']),
            payment_method=random.choice(['Card', 'Card', 'Cash']),
            payment_status='Paid' if status == 'delivered' else 'Pending',
            status=status,
            subtotal=round(subtotal, 2),
            tax=tax,
            delivery_fee=delivery_fee,
            total=total,
            latitude=lat,
            longitude=lng,
            driver_id=driver_id,
            created_at=created,
            updated_at=created + timedelta(minutes=random.randint(5, 45)),
            estimated_delivery=created + timedelta(minutes=30),
        )
        db.session.add(order)
        db.session.flush()

        # Add items
        for (item_name, item_price), qty in zip(selected_items, quantities):
            item = OrderItem(
                order_id=order.id,
                name=item_name,
                quantity=qty,
                price=item_price,
            )
            db.session.add(item)

    db.session.commit()
    print(f"  -> {count} orders with items seeded")


def validate_seed_coordinates():
    """Fail fast if seeded coordinates drift outside London simulation bounds."""
    print("Validating seeded coordinate ranges...")
    invalid_drivers = []
    invalid_orders = []

    for driver in Driver.query.all():
        lat = driver.current_latitude
        lng = driver.current_longitude
        if lat is not None and lng is not None and not _in_london_bounds(lat, lng):
            invalid_drivers.append((driver.id, lat, lng))

    for order in Order.query.filter(Order.latitude.isnot(None), Order.longitude.isnot(None)).all():
        if not _in_london_bounds(order.latitude, order.longitude):
            invalid_orders.append((order.id, order.latitude, order.longitude))

    if invalid_drivers or invalid_orders:
        raise ValueError(
            f"Out-of-range coordinates detected. drivers={invalid_drivers}, orders={invalid_orders}"
        )

    print("  -> All seeded coordinates are within London bounds")


def seed_routes():
    """Seed a couple of active routes."""
    print("Seeding routes...")

    # Get some recent ready/delivered orders
    ready_orders = Order.query.filter(
        Order.status.in_(['ready', 'delivered']),
        Order.latitude.isnot(None)
    ).limit(5).all()

    if len(ready_orders) >= 3:
        route1 = Route(
            id='ROUTE001',
            driver_id='DRV001',
            status='active',
            total_distance=12.5,
            estimated_time=45,
            total_orders=3,
        )
        db.session.add(route1)

        for seq, order in enumerate(ready_orders[:3], 1):
            stop = RouteStop(
                route_id='ROUTE001',
                order_id=order.id,
                sequence=seq,
                address=order.delivery_address,
                lat=order.latitude,
                lng=order.longitude,
                status='pending' if seq > 1 else 'in_transit',
            )
            db.session.add(stop)

    if len(ready_orders) >= 5:
        route2 = Route(
            id='ROUTE002',
            driver_id='DRV002',
            status='active',
            total_distance=8.3,
            estimated_time=30,
            total_orders=2,
        )
        db.session.add(route2)

        for seq, order in enumerate(ready_orders[3:5], 1):
            stop = RouteStop(
                route_id='ROUTE002',
                order_id=order.id,
                sequence=seq,
                address=order.delivery_address,
                lat=order.latitude,
                lng=order.longitude,
                status='delivered',
            )
            db.session.add(stop)
        route2.status = 'completed'

    db.session.commit()
    print("  -> Routes seeded")


def seed_settings():
    """Seed default settings."""
    print("Seeding settings...")
    for key, (value, value_type, category) in DEFAULT_SETTINGS.items():
        existing = Settings.query.filter_by(key=key).first()
        if not existing:
            setting = Settings(
                key=key,
                value=str(value),
                value_type=value_type,
                category=category,
            )
            db.session.add(setting)
    db.session.commit()
    print(f"  -> {len(DEFAULT_SETTINGS)} settings seeded")


def seed_all():
    """Run all seed functions."""
    app = create_app('development')
    with app.app_context():
        print("\n" + "=" * 60)
        print("ODMS Database Seeder")
        print("=" * 60 + "\n")

        # Create all tables
        db.create_all()
        print("Database tables created.\n")

        seed_restaurant()
        seed_drivers()
        seed_orders(50)
        seed_routes()
        seed_settings()
        validate_seed_coordinates()

        print("\n" + "=" * 60)
        print("Seeding complete!")
        print("=" * 60)


if __name__ == '__main__':
    seed_all()
