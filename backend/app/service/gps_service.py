from math import radians, sin, cos, sqrt, atan2

EARTH_R = 6_371_000  # mét

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Trả về khoảng cách (mét) giữa 2 toạ độ GPS."""
    φ1, φ2 = radians(lat1), radians(lat2)
    Δφ = radians(lat2 - lat1)
    Δλ = radians(lng2 - lng1)
    a = sin(Δφ/2)**2 + cos(φ1)*cos(φ2)*sin(Δλ/2)**2
    return EARTH_R * 2 * atan2(sqrt(a), sqrt(1 - a))

def is_within_radius(user_lat: float, user_lng: float,
                     center_lat: float, center_lng: float,
                     radius_m: float) -> bool:
    return haversine(user_lat, user_lng, center_lat, center_lng) <= radius_m