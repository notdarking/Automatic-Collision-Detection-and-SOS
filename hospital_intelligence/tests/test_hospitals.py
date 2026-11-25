import pytest
from fastapi.testclient import TestClient
from hospital_intelligence.api.main import app
from hospital_intelligence.gps.distance import haversine_distance, estimate_road_distance_and_eta
from hospital_intelligence.discovery.mock_data import get_mock_hospitals_for_location
from hospital_intelligence.discovery.overpass import fetch_hospitals_overpass
from hospital_intelligence.routing.osrm import calculate_route_and_eta


@pytest.fixture
def client():
    return TestClient(app)


def test_haversine_distance_calculation():
    # Distance between Lucknow center (26.8467, 80.9462) and KGMU (26.8703, 80.9174) ~3.9km
    dist = haversine_distance(26.8467, 80.9462, 26.8703, 80.9174)
    assert 3.5 <= dist <= 4.5


def test_geometric_fallback_routing():
    road_dist, eta, route = estimate_road_distance_and_eta(26.8467, 80.9462, 26.8703, 80.9174)
    assert road_dist > 3.5
    assert eta >= 1
    assert len(route) == 2
    assert route[0] == [26.8467, 80.9462]


def test_mock_hospitals_fallback_data():
    hospitals = get_mock_hospitals_for_location(26.8467, 80.9462, radius_km=15.0)
    assert len(hospitals) >= 3
    # Check required fields
    for h in hospitals:
        assert "name" in h
        assert "latitude" in h
        assert "longitude" in h
        assert "distance_km" in h


def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "hospital_intelligence"
    assert data["port"] == "8002"


def test_nearest_hospitals_contract_sample(client, monkeypatch):
    """
    Test exact request from docs/CONTRACTS.md:
    Request: {"latitude": 26.8467, "longitude": 80.9462, "radius_km": 15}
    """
    monkeypatch.setattr(
        "hospital_intelligence.api.main.fetch_hospitals_overpass",
        lambda lat, lon, radius_km=15.0: (
            get_mock_hospitals_for_location(lat, lon, radius_km),
            "mock",
        ),
    )
    monkeypatch.setattr(
        "hospital_intelligence.ranking.ranker.calculate_distance_matrix",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "hospital_intelligence.ranking.ranker.calculate_route_and_eta",
        lambda start_lat, start_lon, dest_lat, dest_lon: estimate_road_distance_and_eta(
            start_lat, start_lon, dest_lat, dest_lon
        ),
    )
    payload = {
        "latitude": 26.8467,
        "longitude": 80.9462,
        "radius_km": 15
    }
    response = client.post("/api/v1/location/nearest-hospitals", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Validate top-level contract
    assert "hospitals" in data
    assert "source" in data
    assert data["source"] in ["overpass", "mock"]
    assert len(data["hospitals"]) > 0

    # Validate first hospital shape
    first = data["hospitals"][0]
    assert "name" in first
    assert "latitude" in first
    assert "longitude" in first
    assert "address" in first
    assert "phone" in first
    assert "distance_km" in first
    assert "road_distance_km" in first
    assert "eta_min" in first
    assert "route" in first

    # Route format: list of [lat, lng] pairs
    if first["route"]:
        assert len(first["route"][0]) == 2
        # Verify latitude coordinate order
        assert -90.0 <= first["route"][0][0] <= 90.0


def test_nearest_hospitals_sorted_by_eta(client, monkeypatch):
    monkeypatch.setattr(
        "hospital_intelligence.api.main.fetch_hospitals_overpass",
        lambda lat, lon, radius_km=15.0: (
            get_mock_hospitals_for_location(lat, lon, radius_km),
            "mock",
        ),
    )
    monkeypatch.setattr(
        "hospital_intelligence.ranking.ranker.calculate_distance_matrix",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "hospital_intelligence.ranking.ranker.calculate_route_and_eta",
        lambda start_lat, start_lon, dest_lat, dest_lon: estimate_road_distance_and_eta(
            start_lat, start_lon, dest_lat, dest_lon
        ),
    )
    payload = {"latitude": 26.8467, "longitude": 80.9462, "radius_km": 15}
    response = client.post("/api/v1/location/nearest-hospitals", json=payload)
    assert response.status_code == 200
    hospitals = response.json()["hospitals"]

    etas = [h["eta_min"] for h in hospitals]
    assert etas == sorted(etas), "Hospitals must be sorted by ETA ascending"


def test_matrix_ranking_overrides_straight_line(monkeypatch):
    """
    Verify OSRM /table matrix ranks ALL candidates by actual road distance & ETA
    rather than dropping candidates outside the straight-line top 5.
    """
    from hospital_intelligence.ranking.ranker import HospitalRanker

    # 6 hospitals: Hospital #6 is farthest straight-line (9.0km) but fastest by road (4.5km, 5m)
    raw = [
        {"name": f"Hosp {i}", "latitude": 26.85 + i * 0.01, "longitude": 80.95, "distance_km": float(i + 1)}
        for i in range(6)
    ]

    # Matrix returns slow road routes for Hosp 0..4, and fastest road route for Hosp 5
    fake_matrix = [
        (14.0, 22),
        (12.0, 18),
        (11.0, 16),
        (10.0, 15),
        (9.5, 14),
        (4.5, 5),  # Hosp 5 wins by actual road distance/ETA!
    ]

    monkeypatch.setattr(
        "hospital_intelligence.ranking.ranker.calculate_distance_matrix",
        lambda *_args, **_kwargs: fake_matrix,
    )
    monkeypatch.setattr(
        "hospital_intelligence.ranking.ranker.calculate_route_and_eta",
        lambda start_lat, start_lon, dest_lat, dest_lon: (4.5, 5, [[start_lat, start_lon], [dest_lat, dest_lon]]),
    )

    ranked = HospitalRanker.rank_hospitals(26.8467, 80.9462, raw, max_results=5)
    assert ranked[0].name == "Hosp 5"
    assert ranked[0].road_distance_km == 4.5
    assert ranked[0].eta_min == 5


def test_auto_expanding_radius_fallback():
    """Small radius (0.2km) auto-expands to find Civil Hospital Hazratganj (0.49km)."""
    hospitals = get_mock_hospitals_for_location(26.8467, 80.9462, radius_km=0.2)
    assert len(hospitals) > 0
    assert any("Civil Hospital" in h["name"] for h in hospitals)


def test_matrix_failure_fallback(monkeypatch):
    """When OSRM Table API is unavailable, ranker still returns valid sorted hospitals."""
    from hospital_intelligence.ranking.ranker import HospitalRanker

    raw = get_mock_hospitals_for_location(26.8467, 80.9462, radius_km=15.0)
    monkeypatch.setattr(
        "hospital_intelligence.ranking.ranker.calculate_distance_matrix",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        "hospital_intelligence.ranking.ranker.calculate_route_and_eta",
        lambda start_lat, start_lon, dest_lat, dest_lon: estimate_road_distance_and_eta(
            start_lat, start_lon, dest_lat, dest_lon
        ),
    )

    ranked = HospitalRanker.rank_hospitals(26.8467, 80.9462, raw, max_results=5)
    assert len(ranked) == 5
    etas = [h.eta_min for h in ranked]
    assert etas == sorted(etas)


def test_overpass_parses_center_and_unnamed_default(monkeypatch):
    """Overpass parser reads center coordinates for ways/relations and defaults missing names."""
    from unittest.mock import MagicMock
    import hospital_intelligence.discovery.overpass as ov

    monkeypatch.setattr(ov, "_last_overpass_failure_ts", 0.0)
    fake_resp = MagicMock()
    fake_resp.json.return_value = {
        "elements": [
            {"type": "way", "id": 1, "center": {"lat": 26.85, "lon": 80.95}, "tags": {}}
        ]
    }
    fake_client = MagicMock()
    fake_client.__enter__.return_value.post.return_value = fake_resp
    monkeypatch.setattr(ov.httpx, "Client", MagicMock(return_value=fake_client))

    hospitals, source = ov.fetch_hospitals_overpass(26.8467, 80.9462, radius_km=15.0)
    assert source == "overpass"
    assert len(hospitals) == 1
    assert hospitals[0]["name"] == "Unnamed hospital (OpenStreetMap)"
    assert hospitals[0]["latitude"] == 26.85
    assert hospitals[0]["longitude"] == 80.95


def test_remote_location_returns_empty_not_invented():
    """Remote coordinates far from demo region must return [] rather than invented hospitals."""
    assert get_mock_hospitals_for_location(0.0, 0.0, radius_km=15.0) == []
