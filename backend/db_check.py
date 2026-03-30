"""
Database integrity checker for driver assignment & settings.
Detects and reports on Culprits A, B, C, D from the briefing.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models.driver import Driver
from app.models.restaurant import Restaurant
from app.models.settings import Settings
from app.models.order import Order


def check_and_fix():
    """Check database state and suggest/apply fixes."""
    
    app = create_app('development')
    with app.app_context():
        print("\n" + "="*80)
        print("DATABASE INTEGRITY CHECK - Driver Assignment Diagnostics")
        print("="*80 + "\n")
        
        # ---- CULPRIT A: owner_type is null ----
        print("CULPRIT A: Checking driver owner_type values...")
        null_owner_drivers = Driver.query.filter(Driver.owner_type.is_(None)).all()
        if null_owner_drivers:
            print(f"  ❌ FOUND: {len(null_owner_drivers)} drivers with NULL owner_type")
            for d in null_owner_drivers:
                print(f"     - {d.id} ({d.name})")
            print("  🔧 FIX: Setting all NULL owner_type to 'restaurant'...")
            for d in null_owner_drivers:
                d.owner_type = 'restaurant'
            db.session.commit()
            print(f"  ✅ Fixed {len(null_owner_drivers)} drivers\n")
        else:
            print("  ✅ All drivers have owner_type set\n")
        
        # ---- CULPRIT B: restaurant_id issues ----
        print("CULPRIT B: Checking restaurant presence & driver assignments...")
        restaurants = Restaurant.query.all()
        print(f"  Found {len(restaurants)} restaurant(s)")
        for r in restaurants:
            print(f"     - {r.id}: {r.name} at ({r.latitude}, {r.longitude})")
        
        if not restaurants:
            print("  ❌ ERROR: No restaurant configured! System cannot function.")
            print("  🔧 FIX: Insert a default restaurant...")
            restaurant = Restaurant(
                name='London Takeaway Hub',
                phone='+44 20 7946 9000',
                email='ops@londontakeawayhub.co.uk',
                address='10 Downing Street, Westminster, London SW1A 2AA',
                latitude=51.5074,
                longitude=-0.1278,
                opens_at='09:00',
                closes_at='23:00',
                max_delivery_radius_km=15.0,
                avg_speed_kmh=30.0,
                use_platform_drivers=False,
            )
            db.session.add(restaurant)
            db.session.commit()
            print(f"  ✅ Created restaurant with id={restaurant.id}\n")
        else:
            restaurant_id = restaurants[0].id
        
        # Check restaurant-owned drivers have restaurant_id set
        restaurant_drivers = Driver.query.filter(Driver.owner_type == 'restaurant').all()
        bad_restaurant_drivers = [d for d in restaurant_drivers if d.restaurant_id is None]
        if bad_restaurant_drivers:
            print(f"  ❌ FOUND: {len(bad_restaurant_drivers)} restaurant-owned drivers with NULL restaurant_id")
            for d in bad_restaurant_drivers:
                print(f"     - {d.id} ({d.name})")
            print(f"  🔧 FIX: Assigning all to restaurant_id={restaurant_id}...")
            for d in bad_restaurant_drivers:
                d.restaurant_id = restaurant_id
            db.session.commit()
            print(f"  ✅ Fixed {len(bad_restaurant_drivers)} drivers\n")
        else:
            print(f"  ✅ All restaurant-owned drivers properly assigned\n")
        
        # ---- CULPRIT C: use_platform_drivers setting type ----
        print("CULPRIT C: Checking use_platform_drivers setting...")
        setting = Settings.query.filter_by(key='use_platform_drivers').first()
        if setting:
            print(f"  Found setting: key='{setting.key}', value='{setting.value}', value_type='{setting.value_type}'")
            typed_val = setting.get_typed_value()
            print(f"  get_typed_value() returns: {typed_val} (type={type(typed_val).__name__})")
            if setting.value_type != 'boolean':
                print(f"  ❌ ERROR: Setting should have value_type='boolean', not '{setting.value_type}'")
                print(f"  🔧 FIX: Correcting value_type...")
                setting.value_type = 'boolean'
                db.session.commit()
                print(f"  ✅ Fixed\n")
            else:
                print(f"  ✅ Setting type is correct\n")
        else:
            print("  ❌ ERROR: use_platform_drivers setting not found!")
            print("  🔧 FIX: Creating setting with default value=false...")
            setting = Settings(
                key='use_platform_drivers',
                value='false',
                value_type='boolean',
                category='order',
            )
            db.session.add(setting)
            db.session.commit()
            print(f"  ✅ Created setting\n")
        
        # ---- CULPRIT D: Orders with invalid coordinates ----
        print("CULPRIT D: Checking order coordinates...")
        orders_without_coords = Order.query.filter(
            (Order.latitude.is_(None)) | (Order.longitude.is_(None))
        ).all()
        
        orders_invalid_coords = Order.query.filter(
            ~(
                (Order.latitude >= 51.3) & (Order.latitude <= 51.7) &
                (Order.longitude >= -0.5) & (Order.longitude <= 0.3)
            )
        ).all()
        
        if orders_without_coords:
            print(f"  ⚠️  {len(orders_without_coords)} orders without coordinates")
        
        if orders_invalid_coords:
            print(f"  ⚠️  {len(orders_invalid_coords)} orders with coordinates outside London bounds")
            for o in orders_invalid_coords[:5]:
                print(f"     - Order #{o.id}: ({o.latitude}, {o.longitude}) - {o.delivery_address}")
            if len(orders_invalid_coords) > 5:
                print(f"     ... and {len(orders_invalid_coords) - 5} more")
        
        if not orders_without_coords and not orders_invalid_coords:
            print("  ✅ All orders have valid coordinates\n")
        else:
            print()
        
        # ---- SUMMARY ----
        print("\n" + "="*80)
        print("DRIVER ELIGIBILITY CHECK")
        print("="*80 + "\n")
        
        # Get first restaurant
        restaurant = Restaurant.query.first()
        if restaurant:
            restaurant_id = restaurant.id
            available_drivers = Driver.query.filter(Driver.status == 'available').all()
            print(f"Total drivers with status=available: {len(available_drivers)}")
            
            eligible = []
            for d in available_drivers:
                if d.owner_type == 'restaurant' and d.restaurant_id == restaurant_id:
                    eligible.append(d)
                    print(f"  ✅ {d.id} ({d.name}): ELIGIBLE (restaurant-owned, restaurant_id={restaurant_id})")
                elif d.owner_type == 'platform' and setting.get_typed_value():
                    eligible.append(d)
                    print(f"  ✅ {d.id} ({d.name}): ELIGIBLE (platform-owned, use_platform=true)")
                else:
                    reasons = []
                    if d.owner_type != 'restaurant' and d.owner_type != 'platform':
                        reasons.append(f"invalid owner_type={d.owner_type}")
                    if d.owner_type == 'restaurant' and d.restaurant_id != restaurant_id:
                        reasons.append(f"restaurant_id={d.restaurant_id} != {restaurant_id}")
                    if d.owner_type == 'platform' and not setting.get_typed_value():
                        reasons.append("platform but use_platform=false")
                    print(f"  ❌ {d.id} ({d.name}): NOT ELIGIBLE ({', '.join(reasons)})")
            
            print(f"\nTotal eligible drivers for assignment: {len(eligible)}")
            if len(eligible) == 0:
                print("  ⚠️  WARNING: No eligible drivers! Orders cannot be assigned.")
            else:
                print(f"  ✅ Ready for assignment")
        
        print("\n" + "="*80 + "\n")


if __name__ == '__main__':
    check_and_fix()
