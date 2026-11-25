"""Core business logic for collision event creation and acknowledgement.

This is the single source of truth for event lifecycle.  Routes call these
functions; they never touch the DB or integrations directly.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from backend.integrations import hospital_client
from backend.models.accident import Accident, NotificationStatus
from backend.models.patient import Patient, VehicleLink
from backend.notifications import dispatcher
from backend.schemas.accident import AccidentCreate

logger = logging.getLogger(__name__)


def _resolve_patient(vehicle_id: str, db: Session) -> Optional[Patient]:
    """Look up a Patient via VehicleLink for the given vehicle_id."""
    link = db.query(VehicleLink).filter(VehicleLink.vehicle_id == vehicle_id).first()
    if link is None:
        return None
    return db.query(Patient).filter(Patient.patient_id == link.patient_id).first()


def create_event(payload: AccidentCreate, db: Session) -> Accident:
    """Create a new collision event (or return the existing one for duplicates).

    Steps:
      a) Return existing record immediately if accident_id already exists (idempotent).
      b) Find nearest hospital via hospital_client (falls back to mock on failure).
      c) Look up patient through VehicleLink if present.
      d) Save the Accident with notification_status PENDING.
      e) Call dispatcher.send_alerts → update notification_status.
      f) Return the saved Accident.
    """
    # a) Duplicate prevention
    existing = db.query(Accident).filter(Accident.accident_id == payload.event_id).first()
    if existing:
        logger.info("Duplicate event %s — returning existing record.", payload.event_id)
        return existing

    # b) Find nearest hospital
    hospital = hospital_client.find_nearest_hospital(payload.latitude, payload.longitude)

    # c) Look up patient
    patient = _resolve_patient(payload.vehicle_id, db)

    # d) Persist the Accident with PENDING status
    accident = Accident(
        accident_id=payload.event_id,
        vehicle_id=payload.vehicle_id,
        timestamp=payload.timestamp,
        latitude=payload.latitude,
        longitude=payload.longitude,
        severity=payload.severity,
        impact_magnitude=payload.impact_magnitude,
        confidence_score=payload.confidence_score,
        selected_hospital=json.dumps(hospital),
        notification_status=NotificationStatus.PENDING.value,
        acknowledged=False,
        patient_id=patient.patient_id if patient else None,
    )
    db.add(accident)
    db.commit()
    db.refresh(accident)

    # e) Send alerts and update notification_status
    status_str = dispatcher.send_alerts(accident, hospital, patient, db)
    accident.notification_status = status_str
    db.commit()
    db.refresh(accident)

    logger.info("Event %s created with notification_status=%s.", accident.accident_id, status_str)
    return accident


def list_events(
    db: Session,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
) -> List[Accident]:
    """Return events filtered by severity, notification_status, and/or accident_id substring."""
    query = db.query(Accident)
    if severity:
        query = query.filter(Accident.severity == severity.upper())
    if status:
        query = query.filter(Accident.notification_status == status.upper())
    if q:
        query = query.filter(Accident.accident_id.contains(q))
    return query.order_by(Accident.created_at.desc()).all()


def get_event(event_id: str, db: Session) -> Optional[Accident]:
    """Fetch a single event by id; returns None if not found."""
    return db.query(Accident).filter(Accident.accident_id == event_id).first()


def acknowledge_event(event_id: str, db: Session) -> Accident:
    """Mark an event acknowledged.  Idempotent: safe to call multiple times.

    Raises:
        KeyError: if the event_id does not exist (route converts to 404).
    """
    accident = db.query(Accident).filter(Accident.accident_id == event_id).first()
    if accident is None:
        raise KeyError(f"Event {event_id!r} not found")
    if not accident.acknowledged:
        accident.acknowledged = True
        accident.acknowledged_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(accident)
    return accident
