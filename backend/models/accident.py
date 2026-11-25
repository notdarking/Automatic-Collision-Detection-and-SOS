"""Accident ORM model."""

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, String, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from backend.database.session import Base


class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class Accident(Base):
    """Represents a detected collision event."""

    __tablename__ = "accidents"

    accident_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    vehicle_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=True)
    impact_magnitude: Mapped[float] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=True)
    # Stored as JSON text; SQLite has no native JSON column, so we use Text
    selected_hospital: Mapped[str] = mapped_column(Text, nullable=True)
    notification_status: Mapped[str] = mapped_column(
        SAEnum(NotificationStatus, values_callable=lambda x: [e.value for e in x]),
        default=NotificationStatus.PENDING.value,
        nullable=False,
    )
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    patient_id: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
