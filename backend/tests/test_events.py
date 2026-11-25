"""Tests for event creation, duplicate prevention, hospital fallback, filters, and 404."""

import json
import pytest
from unittest.mock import patch, MagicMock

from backend.tests.conftest import HOSPITAL_HEADERS, ADMIN_HEADERS, BAD_HEADERS, make_event_payload

MOCK_HOSPITAL = {
    "name": "MOCK Hospital A (test data)",
    "latitude": 26.86,
    "longitude": 80.96,
    "address": "1 Test St",
    "phone": "+00-000-0000001",
    "distance_km": 1.5,
    "road_distance_km": 2.0,
    "eta_min": 7,
    "source": "mock",
}


def _post_event(client, payload=None, headers=None):
    payload = payload or make_event_payload()
    headers = headers or HOSPITAL_HEADERS
    return client.post("/api/v1/events", json=payload, headers=headers)


# ── Create event flow ─────────────────────────────────────────────────────────

@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_create_event_success(mock_hospital, client):
    """Full happy-path: event created, hospital selected, notification logged."""
    r = _post_event(client)
    assert r.status_code == 200
    body = r.json()
    assert body["accident_id"] == "evt-test-001"
    assert body["vehicle_id"] == "VH-TEST-01"
    assert body["notification_status"] == "SENT"
    assert body["acknowledged"] is False
    assert body["selected_hospital"]["name"] == MOCK_HOSPITAL["name"]


@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_create_event_duplicate_returns_existing_and_notifies_once(mock_hospital, client, db_session):
    """Duplicate event_id returns the existing record; dispatcher is called only once."""
    with patch("backend.notifications.dispatcher.send_alerts", wraps=__import__("backend.notifications.dispatcher", fromlist=["send_alerts"]).send_alerts) as mock_dispatch:
        _post_event(client)
        _post_event(client)  # duplicate
        # send_alerts should only be called once (first creation)
        assert mock_dispatch.call_count == 1


@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_create_event_response_shape(mock_hospital, client):
    """Response contains all required CONTRACTS.md fields."""
    r = _post_event(client)
    body = r.json()
    for field in ["accident_id", "vehicle_id", "timestamp", "latitude", "longitude",
                  "severity", "notification_status", "acknowledged", "selected_hospital"]:
        assert field in body, f"Missing field: {field}"


# ── Hospital service failure → mock fallback ──────────────────────────────────

@patch("backend.integrations.hospital_client.httpx.Client")
def test_hospital_service_failure_uses_fallback(mock_client_cls, client):
    """If hospital service is unreachable, mock hospital is used and event still created."""
    mock_client_cls.return_value.__enter__.return_value.post.side_effect = Exception("connection refused")
    r = _post_event(client)
    assert r.status_code == 200
    body = r.json()
    assert "MOCK" in body["selected_hospital"]["name"]
    assert body["selected_hospital"]["source"] == "mock"


# ── List filters ─────────────────────────────────────────────────────────────

@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_list_filter_severity(mock_hospital, client):
    """Filter by severity returns only matching events."""
    _post_event(client, make_event_payload("evt-high-01"))
    _post_event(client, {**make_event_payload("evt-low-01"), "severity": "LOW"})
    r = client.get("/api/v1/events?severity=HIGH", headers=HOSPITAL_HEADERS)
    assert r.status_code == 200
    bodies = r.json()
    assert all(b["severity"] == "HIGH" for b in bodies)


@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_list_filter_q(mock_hospital, client):
    """Filter by q searches accident_id substring."""
    _post_event(client, make_event_payload("unique-xyz-event"))
    _post_event(client, make_event_payload("other-event"))
    r = client.get("/api/v1/events?q=unique-xyz", headers=HOSPITAL_HEADERS)
    assert r.status_code == 200
    bodies = r.json()
    assert len(bodies) == 1
    assert bodies[0]["accident_id"] == "unique-xyz-event"


@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_list_newest_first(mock_hospital, client):
    """Events are returned newest-created first."""
    _post_event(client, make_event_payload("evt-first"))
    _post_event(client, make_event_payload("evt-second"))
    r = client.get("/api/v1/events", headers=HOSPITAL_HEADERS)
    ids = [e["accident_id"] for e in r.json()]
    assert ids.index("evt-second") < ids.index("evt-first")


# ── GET by id ─────────────────────────────────────────────────────────────────

@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_get_event_by_id(mock_hospital, client):
    _post_event(client)
    r = client.get("/api/v1/events/evt-test-001", headers=HOSPITAL_HEADERS)
    assert r.status_code == 200
    assert r.json()["accident_id"] == "evt-test-001"


def test_get_event_404(client):
    r = client.get("/api/v1/events/does-not-exist", headers=HOSPITAL_HEADERS)
    assert r.status_code == 404
    assert "detail" in r.json()


# ── Acknowledge ───────────────────────────────────────────────────────────────

@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_acknowledge_sets_flag(mock_hospital, client):
    """Acknowledging an event sets acknowledged=True and acknowledged_at, without changing notification_status."""
    _post_event(client)
    r = client.post("/api/v1/events/evt-test-001/acknowledge", headers=HOSPITAL_HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert body["acknowledged"] is True
    assert body["acknowledged_at"] is not None
    assert body["notification_status"] == "SENT"  # unchanged


@patch("backend.integrations.hospital_client.find_nearest_hospital", return_value=MOCK_HOSPITAL)
def test_acknowledge_idempotent(mock_hospital, client):
    """Acknowledging twice keeps acknowledged=True and doesn't raise."""
    _post_event(client)
    client.post("/api/v1/events/evt-test-001/acknowledge", headers=HOSPITAL_HEADERS)
    r = client.post("/api/v1/events/evt-test-001/acknowledge", headers=HOSPITAL_HEADERS)
    assert r.status_code == 200
    assert r.json()["acknowledged"] is True


def test_acknowledge_404(client):
    r = client.post("/api/v1/events/no-such-event/acknowledge", headers=HOSPITAL_HEADERS)
    assert r.status_code == 404


@pytest.mark.parametrize(
    "bad_override",
    [
        {"latitude": 200.0},
        {"longitude": -200.0},
        {"severity": "EXTREME"},
    ],
)
def test_create_event_invalid_payload_returns_422(client, bad_override):
    payload = {**make_event_payload(), **bad_override}
    r = _post_event(client, payload)
    assert r.status_code == 422
    assert "detail" in r.json()
