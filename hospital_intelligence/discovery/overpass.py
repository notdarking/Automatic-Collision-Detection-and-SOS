import logging
import time
from typing import List, Dict, Any, Tuple
import httpx

from hospital_intelligence.gps.distance import haversine_distance
from hospital_intelligence.discovery.mock_data import get_mock_hospitals_for_location

logger = logging.getLogger(__name__)

OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"
# Public Overpass is often slow; backend timeout is 12s so discovery + OSRM still fit
OVERPASS_TIMEOUT_SEC = 3.0
# Skip repeated Overpass timeouts for 60s after a failure so consecutive requests are instant
_OVERPASS_COOLDOWN_SEC = 60.0
_last_overpass_failure_ts: float = 0.0


def fetch_hospitals_overpass(lat: float, lon: float, radius_km: float = 15.0) -> Tuple[List[Dict[str, Any]], str]:
    """
    Attempts to query the OpenStreetMap Overpass API for hospitals within radius_km.
    Falls back gracefully to high-fidelity mock data on timeout or connection error.
    Returns: (hospitals_list, source_string: 'overpass' | 'mock')
    """
    global _last_overpass_failure_ts

    now = time.monotonic()
    if _last_overpass_failure_ts and (now - _last_overpass_failure_ts) < _OVERPASS_COOLDOWN_SEC:
        mock_hospitals = get_mock_hospitals_for_location(lat, lon, radius_km)
        return mock_hospitals, "mock"

    headers = {
        "User-Agent": "VehicleCollisionEmergencySOS/1.0 (emergency-dispatch-research; contact@emergencysos.org)",
        "Accept": "application/json"
    }

    search_radii = [radius_km] if radius_km >= 30.0 else [radius_km, 30.0]

    try:
        with httpx.Client(timeout=OVERPASS_TIMEOUT_SEC, headers=headers) as client:
            for active_radius in search_radii:
                radius_meters = int(active_radius * 1000)
                query = f"""
                [out:json][timeout:10];
                nwr["amenity"="hospital"](around:{radius_meters},{lat},{lon});
                out center 20;
                """
                resp = client.post(OVERPASS_API_URL, data={"data": query})
                resp.raise_for_status()
                data = resp.json()
                elements = data.get("elements", [])

                hospitals = []
                for el in elements:
                    tags = el.get("tags", {})
                    name = tags.get("name") or tags.get("name:en") or "Unnamed hospital (OpenStreetMap)"
                    center = el.get("center") or {}
                    h_lat = el.get("lat") if el.get("lat") is not None else center.get("lat")
                    h_lon = el.get("lon") if el.get("lon") is not None else center.get("lon")

                    if h_lat is None or h_lon is None:
                        continue

                    dist = haversine_distance(lat, lon, h_lat, h_lon)
                    address = tags.get("addr:street") or tags.get("addr:full") or None
                    phone = tags.get("phone") or tags.get("contact:phone") or None

                    hospitals.append({
                        "name": name,
                        "latitude": round(h_lat, 5),
                        "longitude": round(h_lon, 5),
                        "address": address,
                        "phone": phone,
                        "distance_km": dist
                    })

                if hospitals:
                    _last_overpass_failure_ts = 0.0
                    logger.info(f"Overpass API returned {len(hospitals)} live hospitals (radius={active_radius}km).")
                    return hospitals, "overpass"

    except Exception as exc:
        _last_overpass_failure_ts = time.monotonic()
        logger.warning(f"Overpass query failed ({exc}). Engaging mock data fallback.")

    # Mock data fallback
    mock_hospitals = get_mock_hospitals_for_location(lat, lon, radius_km)
    return mock_hospitals, "mock"
