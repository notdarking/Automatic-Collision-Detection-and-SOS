"""Pydantic schemas for the collision analysis endpoint (CONTRACTS.md section 1)."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    t_ms: int = Field(..., ge=0)
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float


class CollisionAnalyzeRequest(BaseModel):
    """Body for POST /api/v1/collision/analyze (forwarded to collision_engine)."""

    vehicle_id: str = Field(..., min_length=1)
    timestamp: datetime
    readings: List[SensorReading] = Field(..., min_length=1)
    # Optional location fields added by the simulate route
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)


class CollisionAnalyzeResponse(BaseModel):
    """Response from collision_engine POST /api/v1/collision/analyze."""

    event_id: str
    vehicle_id: str
    timestamp: datetime
    collision_detected: bool
    confidence_score: Optional[float] = None
    impact_magnitude: Optional[float] = None
    severity: Optional[str] = None
    detection_reason: Optional[str] = None
