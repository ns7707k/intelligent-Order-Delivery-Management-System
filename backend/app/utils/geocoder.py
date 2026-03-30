"""
Geocoding utility using Nominatim (free, no API key required).
Converts text addresses to latitude/longitude coordinates.
"""

import requests
import logging

log = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "ODMS-FYP/1.0"}
NOMINATIM_TIMEOUT = 5  # seconds


def geocode_address(address: str):
    """
    Convert a text address to lat/lng using Nominatim.
    
    Args:
        address: Text address to geocode (e.g., "10 Downing Street, London")
    
    Returns:
        Tuple of (lat, lng) as floats, or (None, None) if not found or error occurs
    """
    if not address or not address.strip():
        return None, None
    
    try:
        params = {
            "q": address.strip(),
            "format": "json",
            "limit": 1,
        }
        
        response = requests.get(
            NOMINATIM_URL,
            params=params,
            headers=HEADERS,
            timeout=NOMINATIM_TIMEOUT
        )
        response.raise_for_status()
        
        results = response.json()
        
        if not results or len(results) == 0:
            log.debug(f"[GEOCODE] No results for address: {address}")
            return None, None
        
        result = results[0]
        lat = float(result.get("lat"))
        lng = float(result.get("lon"))
        display_name = result.get("display_name", address)
        
        log.info(f"[GEOCODE] Resolved '{address}' → lat={lat}, lng={lng}, display='{display_name}'")
        return lat, lng
        
    except requests.exceptions.RequestException as e:
        log.error(f"[GEOCODE] Nominatim API error for '{address}': {str(e)}")
        return None, None
    except (ValueError, KeyError) as e:
        log.error(f"[GEOCODE] Parse error for '{address}': {str(e)}")
        return None, None
    except Exception as e:
        log.error(f"[GEOCODE] Unexpected error for '{address}': {str(e)}")
        return None, None


def geocode_address_with_display(address: str):
    """Resolve address to lat/lng plus Nominatim display name."""
    if not address or not address.strip():
        return None

    try:
        params = {
            "q": address.strip(),
            "format": "json",
            "limit": 1,
        }

        response = requests.get(
            NOMINATIM_URL,
            params=params,
            headers=HEADERS,
            timeout=NOMINATIM_TIMEOUT,
        )
        response.raise_for_status()

        results = response.json()
        if not results:
            return None

        result = results[0]
        return {
            'lat': float(result.get('lat')),
            'lng': float(result.get('lon')),
            'display_address': result.get('display_name', address.strip()),
        }
    except Exception as e:
        log.error(f"[GEOCODE] Detailed geocode failed for '{address}': {str(e)}")
        return None


def get_geocoding_details(address: str, restaurant=None):
    """
    Get full geocoding details including distance, delivery fee, and ETA.
    
    Args:
        address: Text address to geocode
        restaurant: Restaurant object (for distance/fee/ETA calculations)
    
    Returns:
        Dict with lat, lng, display_address, distance_km, delivery_fee, eta_minutes
        or empty dict if geocoding fails
    """
    resolved = geocode_address_with_display(address)

    if not resolved:
        return {}

    lat = resolved['lat']
    lng = resolved['lng']

    result = {
        "lat": lat,
        "lng": lng,
        "display_address": resolved['display_address']
    }
    
    # Add distance/fee/ETA if restaurant is provided
    if restaurant and restaurant.latitude is not None and restaurant.longitude is not None:
        from app.utils.haversine import haversine
        
        distance_km = haversine(
            restaurant.latitude,
            restaurant.longitude,
            lat,
            lng
        )
        
        # Delivery fee logic: base £2.99 + £0.50 per km beyond 2km
        base_fee = 2.99
        extra = max(0, distance_km - 2) * 0.50
        delivery_fee = round(base_fee + extra, 2)
        
        # ETA: distance / avg_speed in minutes
        avg_speed = restaurant.avg_speed_kmh or 30
        eta_minutes = round((distance_km / avg_speed) * 60)
        
        result["distance_km"] = round(distance_km, 2)
        result["delivery_fee"] = delivery_fee
        result["eta_minutes"] = eta_minutes
        # Platform/driver split (platform keeps 20%)
        platform_cut = round(delivery_fee * 0.2, 2)
        driver_share = round(delivery_fee * 0.8, 2)
        result["platform_fee"] = platform_cut
        result["driver_fee"] = driver_share
        
        log.info(f"[GEOCODE] Calculated distance={distance_km:.2f}km, fee=£{delivery_fee}, eta={eta_minutes}min")
    
    return result
