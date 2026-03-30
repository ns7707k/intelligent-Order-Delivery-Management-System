"""
Fix order coordinates for stuck test orders.
"""

import os
import sys
import random

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models.order import Order

# London bounding box
LONDON_LAT_MIN, LONDON_LAT_MAX = 51.4, 51.6
LONDON_LNG_MIN, LONDON_LNG_MAX = -0.3, 0.1
LONDON_DEPOT = (51.5074, -0.1278)


def generate_london_coords():
    """Generate random coordinates in London."""
    lat = LONDON_DEPOT[0] + random.uniform(-0.05, 0.05)
    lng = LONDON_DEPOT[1] + random.uniform(-0.05, 0.05)
    return lat, lng


def fix_orders():
    """Fix order coordinates."""
    
    app = create_app('development')
    with app.app_context():
        print("\n" + "="*80)
        print("FIXING ORDER COORDINATES")
        print("="*80 + "\n")
        
        # Find orders with invalid coordinates
        invalid_orders = Order.query.filter(
            ~(
                (Order.latitude >= LONDON_LAT_MIN) & (Order.latitude <= LONDON_LAT_MAX) &
                (Order.longitude >= LONDON_LNG_MIN) & (Order.longitude <= LONDON_LNG_MAX)
            )
        ).all()
        
        print(f"Found {len(invalid_orders)} orders with invalid coordinates\n")
        
        # Priority: fix stuck orders #507 and #6
        stuck_orders = [o for o in invalid_orders if o.id in [507, 6]]
        other_orders = [o for o in invalid_orders if o.id not in [507, 6]]
        
        fixed_count = 0
        
        # Fix stuck orders first with valid London coords
        for order in stuck_orders:
            lat, lng = generate_london_coords()
            order.latitude = lat
            order.longitude = lng
            print(f"  ✅ Order #{order.id} ({order.status}): ({lat:.4f}, {lng:.4f})")
            fixed_count += 1
        
        # Fix other invalid orders (limit to first 100 to avoid database churn)
        for order in other_orders[:100]:
            lat, lng = generate_london_coords()
            order.latitude = lat
            order.longitude = lng
            fixed_count += 1
        
        if len(other_orders) > 100:
            print(f"\n  (Fixed first 100 of {len(other_orders)} other invalid orders)")
        
        db.session.commit()
        print(f"\n✅ Fixed {fixed_count} total orders\n")
        
        # Summary
        still_invalid = Order.query.filter(
            ~(
                (Order.latitude >= LONDON_LAT_MIN) & (Order.latitude <= LONDON_LAT_MAX) &
                (Order.longitude >= LONDON_LNG_MIN) & (Order.longitude <= LONDON_LNG_MAX)
            )
        ).count()
        
        print(f"Remaining orders with invalid coordinates: {still_invalid}")
        print("="*80 + "\n")


if __name__ == '__main__':
    fix_orders()
