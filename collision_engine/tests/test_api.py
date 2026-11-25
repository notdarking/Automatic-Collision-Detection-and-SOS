import pytest
from fastapi.testclient import TestClient
from collision_engine.api.main import app
from collision_engine.api.schemas import SeverityLevel


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "collision_engine"


def test_analyze_contract_sample(client):
    """
    Test using the exact sample from docs/CONTRACTS.md:
    Request:
    {
      "vehicle_id": "VH-101",
      "timestamp": "2026-11-24T14:30:00Z",
      "readings": [
        {"t_ms": 0, "ax": 0.1, "ay": 0.0, "az": 1.0, "gx": 0.0, "gy": 0.0, "gz": 0.0}
      ]
    }
    """
    payload = {
        "vehicle_id": "VH-101",
        "timestamp": "2026-11-24T14:30:00Z",
        "readings": [
            {"t_ms": 0, "ax": 0.1, "ay": 0.0, "az": 1.0, "gx": 0.0, "gy": 0.0, "gz": 0.0}
        ]
    }
    response = client.post("/api/v1/collision/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Verify contract keys
    assert "event_id" in data
    assert data["vehicle_id"] == "VH-101"
    assert data["timestamp"] == "2026-11-24T14:30:00Z"
    assert data["collision_detected"] is False
    assert "confidence_score" in data
    assert "impact_magnitude" in data
    assert data["severity"] is None
    assert "detection_reason" in data


def test_analyze_high_impact_via_api(client):
    from collision_engine.simulator.generator import IMUScenarioGenerator
    req = IMUScenarioGenerator.get_scenario("high_impact_collision")
    response = client.post("/api/v1/collision/analyze", json=req.model_dump())

    assert response.status_code == 200
    data = response.json()
    assert data["collision_detected"] is True
    assert data["severity"] in ["HIGH", "CRITICAL"]
    assert data["confidence_score"] >= 0.85


def test_simulator_helper_endpoints(client):
    scenarios_resp = client.get("/api/v1/simulator/scenarios")
    assert scenarios_resp.status_code == 200
    scenarios = scenarios_resp.json()
    assert "pothole" in scenarios
    assert "high_impact_collision" in scenarios

    run_resp = client.post("/api/v1/simulator/run/pothole")
    assert run_resp.status_code == 200
    data = run_resp.json()
    assert data["collision_detected"] is False


def test_analyze_bad_inputs_never_500(client):
    # Empty readings -> 422
    r = client.post(
        "/api/v1/collision/analyze",
        json={"vehicle_id": "VH-1", "timestamp": "2026-11-24T14:30:00Z", "readings": []},
    )
    assert r.status_code == 422

    # Negative t_ms -> 422
    r = client.post(
        "/api/v1/collision/analyze",
        json={
            "vehicle_id": "VH-1",
            "timestamp": "2026-11-24T14:30:00Z",
            "readings": [{"t_ms": -5, "ax": 0.0, "ay": 0.0, "az": 1.0, "gx": 0.0, "gy": 0.0, "gz": 0.0}],
        },
    )
    assert r.status_code == 422

    # Missing vehicle_id -> 422
    r = client.post(
        "/api/v1/collision/analyze",
        json={
            "timestamp": "2026-11-24T14:30:00Z",
            "readings": [{"t_ms": 0, "ax": 0.0, "ay": 0.0, "az": 1.0, "gx": 0.0, "gy": 0.0, "gz": 0.0}],
        },
    )
    assert r.status_code == 422

    # Non-finite value -> 422
    r = client.post(
        "/api/v1/collision/analyze",
        content='{"vehicle_id":"VH-1","timestamp":"2026-11-24T14:30:00Z","readings":[{"t_ms":0,"ax":NaN,"ay":0,"az":1,"gx":0,"gy":0,"gz":0}]}',
        headers={"Content-Type": "application/json"},
    )
    assert 400 <= r.status_code < 500

    # Non-monotonic t_ms -> safe 200
    r = client.post(
        "/api/v1/collision/analyze",
        json={
            "vehicle_id": "VH-1",
            "timestamp": "2026-11-24T14:30:00Z",
            "readings": [
                {"t_ms": 20, "ax": 0.0, "ay": 0.0, "az": 1.0, "gx": 0.0, "gy": 0.0, "gz": 0.0},
                {"t_ms": 10, "ax": 0.0, "ay": 0.0, "az": 1.0, "gx": 0.0, "gy": 0.0, "gz": 0.0},
            ],
        },
    )
    assert r.status_code == 200
    assert r.json()["collision_detected"] is False


def test_detector_derives_step_from_tms_spacing():
    from collision_engine.api.schemas import IMUReading
    from collision_engine.detection.detector import MultiStageCollisionDetector

    detector = MultiStageCollisionDetector()
    readings = [
        IMUReading(t_ms=0, ax=0.0, ay=0.0, az=1.0, gx=0.0, gy=0.0, gz=0.0),
        IMUReading(t_ms=20, ax=-8.0, ay=0.0, az=1.0, gx=40.0, gy=0.0, gz=0.0),
        IMUReading(t_ms=40, ax=-8.0, ay=0.0, az=1.0, gx=40.0, gy=0.0, gz=0.0),
        IMUReading(t_ms=60, ax=0.0, ay=0.0, az=1.0, gx=0.0, gy=0.0, gz=0.0),
    ]
    metrics = detector.analyze(readings)
    assert metrics.sustained_duration_ms == 40
