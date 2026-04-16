"""
Geocoding utility using Nominatim (free, no API key required).
Converts text addresses to latitude/longitude coordinates.
"""

import requests
import logging
import re

log = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "ODMS-FYP/1.0"}
NOMINATIM_TIMEOUT = 5  # seconds


def _extract_uk_postcode(address: str):
    """Extract a UK postcode from free-text address input when present."""
    if not address:
        return None

    match = re.search(r"\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b", address.upper())
    return match.group(1).strip() if match else None


def _build_geocode_queries(address: str):
    """Build a small list of progressively simplified geocode queries."""
    normalized = " ".join(address.strip().split())
    if not normalized:
        return []

    queries = [normalized]

    parts = [part.strip() for part in normalized.split(",") if part.strip()]
    if len(parts) >= 3:
        # Remove likely directional/contextual fragments such as "canal side".
        for idx, part in enumerate(parts[1:-1], start=1):
            if not re.search(r"\d", part) and len(part.split()) <= 3:
                candidate = ", ".join(parts[:idx] + parts[idx + 1:])
                if candidate:
                    queries.append(candidate)

        # Use first street segment + strongest location segments.
        queries.append(", ".join([parts[0], parts[-2], parts[-1]]))
        queries.append(", ".join([parts[0], parts[-2]]))

    postcode = _extract_uk_postcode(normalized)
    if postcode:
        queries.append(f"{postcode}, United Kingdom")
        if len(parts) >= 2:
            queries.append(f"{parts[0]}, {postcode}, United Kingdom")

    # Deduplicate while preserving order.
    seen = set()
    deduped = []
    for query in queries:
        if query and query not in seen:
            seen.add(query)
            deduped.append(query)

    return deduped


def _nominatim_lookup(query: str):
    """Run a single Nominatim lookup and return the top result dict if any."""
    params = {
        "q": query,
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
    return results[0]


def geocode_address(address: str):
    """
    Convert a text address to lat/lng using Nominatim.
    
    Args:
        address: Text address to geocode (e.g., "10 Downing Street, London")
    
    Returns:
        Tuple of (lat, lng) as floats, or (None, None) if not found or error occurs
    """
    resolved = geocode_address_with_display(address)
    if not resolved:
        return None, None
    return resolved.get("lat"), resolved.get("lng")


def geocode_address_with_display(address: str):
    """Resolve address to lat/lng plus Nominatim display name."""
    if not address or not address.strip():
        return None

    queries = _build_geocode_queries(address)
    for idx, query in enumerate(queries):
        try:
            result = _nominatim_lookup(query)
            if not result:
                continue

            return {
                "lat": float(result.get("lat")),
                "lng": float(result.get("lon")),
                "display_address": result.get("display_name", query),
            }
        except Exception as e:
            # Continue trying fallback query variants before giving up.
            log.warning(
                f"[GEOCODE] Query attempt {idx + 1}/{len(queries)} failed for '{query}': {str(e)}"
            )

    log.error(f"[GEOCODE] Detailed geocode failed for '{address}' after {len(queries)} attempts")
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
