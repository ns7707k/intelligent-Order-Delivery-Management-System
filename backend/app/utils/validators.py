"""
Validation utilities for request data.
"""


def validate_required_fields(data, required_fields):
    """
    Validate that all required fields are present and non-empty.
    Returns a list of missing field names.
    """
    if not data:
        return required_fields

    missing = []
    for field in required_fields:
        if field not in data or data[field] is None or str(data[field]).strip() == '':
            missing.append(field)
    return missing


def validate_status(status, valid_statuses):
    """Validate that a status value is in the allowed list."""
    return status in valid_statuses


def validate_coordinates(lat, lng):
    """Validate latitude and longitude values."""
    if lat is None or lng is None:
        return False
    try:
        lat = float(lat)
        lng = float(lng)
        return -90 <= lat <= 90 and -180 <= lng <= 180
    except (ValueError, TypeError):
        return False
