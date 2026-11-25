"""Pydantic schemas for Accident (CONTRACTS.md section 3)."""

from datetime import datetime
from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field


SeverityLiteral = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class AccidentCreate(BaseModel):
    """Body for POST /api/v1/events (collision result + lat/lng)."""

    event_id: str = Field(..., min_length=1, description="Unique collision event identifier (accident_id)")
    vehicle_id: str = Field(..., min_length=1)
    timestamp: datetime
    collision_detected: bool = True
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    impact_magnitude: Optional[float] = None
    severity: Optional[SeverityLiteral] = None
    detection_reason: Optional[str] = None
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class AccidentOut(BaseModel):
    """Full Accident object returned to clients (CONTRACTS.md section 3)."""

    accident_id: str
    vehicle_id: str
    timestamp: datetime
    latitude: float
    longitude: float
    severity: Optional[str] = None
    impact_magnitude: Optional[float] = None
    confidence_score: Optional[float] = None
    selected_hospital: Optional[Dict[str, Any]] = None
    notification_status: str
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    patient_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
