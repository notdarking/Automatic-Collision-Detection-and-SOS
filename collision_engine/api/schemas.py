import math
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class SeverityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IMUReading(BaseModel):
    t_ms: int = Field(..., ge=0, description="Timestamp in milliseconds from start of window")
    ax: float = Field(..., description="Acceleration X (longitudinal) in g")
    ay: float = Field(..., description="Acceleration Y (lateral) in g")
    az: float = Field(..., description="Acceleration Z (vertical) in g")
    gx: float = Field(..., description="Gyroscope X (roll rate) in deg/s")
    gy: float = Field(..., description="Gyroscope Y (pitch rate) in deg/s")
    gz: float = Field(..., description="Gyroscope Z (yaw rate) in deg/s")

    @field_validator("ax", "ay", "az", "gx", "gy", "gz")
    @classmethod
    def _must_be_finite(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("IMU reading value must be finite")
        return v


class CollisionAnalysisRequest(BaseModel):
    vehicle_id: str = Field(..., min_length=1, json_schema_extra={"example": "VH-101"})
    timestamp: str = Field(..., min_length=1, json_schema_extra={"example": "2026-11-24T14:30:00Z"})
    readings: List[IMUReading] = Field(..., min_length=1)


class CollisionAnalysisResponse(BaseModel):
    event_id: str = Field(..., json_schema_extra={"example": "evt_001"})
    vehicle_id: str = Field(..., json_schema_extra={"example": "VH-101"})
    timestamp: str = Field(..., json_schema_extra={"example": "2026-11-24T14:30:00Z"})
    collision_detected: bool = Field(...)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    impact_magnitude: float = Field(..., description="Peak impact acceleration in g")
    severity: Optional[SeverityLevel] = Field(None, description="LOW | MEDIUM | HIGH | CRITICAL (null if not detected)")
    detection_reason: str = Field(..., description="Detailed explanation of multi-stage detection verdict")
