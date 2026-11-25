import math
import os
from pathlib import Path
from statistics import median
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from collision_engine.api.schemas import IMUReading

try:
    from dotenv import load_dotenv

    load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=False)
except ImportError:
    pass


@dataclass
class CollisionMetrics:
    peak_acceleration_g: float
    peak_angular_speed_deg_s: float
    sustained_duration_ms: int
    delta_v_ms: float
    is_inversion_detected: bool
    is_vertical_dominant: bool
    naive_6g_triggered: bool
    t_peak_ms: int


class MultiStageCollisionDetector:
    """
    Advanced multi-stage collision detection engine:
    1. Threshold Trigger (vector norm)
    2. Temporal Persistence Check (filters <20ms pothole impulses)
    3. Angular Rate / Gyro Correlation (filters non-rotational shocks)
    4. Energy / Delta-V Integration & Rollover Check
    """

    def __init__(self, threshold_g: float = None):
        if threshold_g is None:
            env_thresh = os.getenv("COLLISION_THRESHOLD_G", "6.0")
            try:
                self.threshold_g = float(env_thresh)
            except ValueError:
                self.threshold_g = 6.0
        else:
            self.threshold_g = threshold_g

    def extract_metrics(self, readings: List[IMUReading]) -> CollisionMetrics:
        if not readings:
            return CollisionMetrics(
                peak_acceleration_g=0.0,
                peak_angular_speed_deg_s=0.0,
                sustained_duration_ms=0,
                delta_v_ms=0.0,
                is_inversion_detected=False,
                is_vertical_dominant=False,
                naive_6g_triggered=False,
                t_peak_ms=0
            )

        peak_g = 0.0
        t_peak = 0
        peak_angular = 0.0
        dominant_ax = 0.0
        dominant_ay = 0.0
        dominant_az = 0.0

        # Calculate vector norms and peaks
        norms = []
        for r in readings:
            a_norm = math.sqrt(r.ax ** 2 + r.ay ** 2 + r.az ** 2)
            g_norm = math.sqrt(r.gx ** 2 + r.gy ** 2 + r.gz ** 2)
            norms.append((r.t_ms, a_norm, g_norm, r.ax, r.ay, r.az))

            if a_norm > peak_g:
                peak_g = a_norm
                t_peak = r.t_ms
                dominant_ax, dominant_ay, dominant_az = r.ax, r.ay, r.az
            
            if g_norm > peak_angular:
                peak_angular = g_norm

        # Naive baseline: simply checks if any sample exceeded threshold_g (default 6.0g)
        naive_triggered = peak_g >= self.threshold_g

        # Temporal persistence: count consecutive duration where a_norm >= 3.5g
        # Real vehicle impacts last >30ms; potholes/curbs rebound within <15ms
        sustained_threshold = min(4.0, max(3.0, peak_g * 0.45))
        deltas = [
            readings[i].t_ms - readings[i - 1].t_ms
            for i in range(1, len(readings))
            if readings[i].t_ms > readings[i - 1].t_ms
        ]
        step_ms = int(round(median(deltas))) if deltas else 10
        max_sustained_ms = 0
        current_streak_start = None
        last_t = None

        for t_ms, a_norm, _, _, _, _ in norms:
            if a_norm >= sustained_threshold:
                if current_streak_start is None:
                    current_streak_start = t_ms
                last_t = t_ms
            else:
                if current_streak_start is not None and last_t is not None:
                    duration = last_t - current_streak_start + step_ms  # include window interval
                    if duration > max_sustained_ms:
                        max_sustained_ms = duration
                current_streak_start = None

        if current_streak_start is not None and last_t is not None:
            duration = last_t - current_streak_start + step_ms
            if duration > max_sustained_ms:
                max_sustained_ms = duration

        # Check vertical dominance (pothole indicator: az is high while ax/ay are low)
        is_vertical_dominant = (abs(dominant_az) > 4.5) and (abs(dominant_ax) < 1.5) and (abs(dominant_ay) < 1.5)

        # Check vehicle inversion (rollover indicator: az stays negative while vehicle rolls)
        inverted_samples = sum(1 for _, _, _, _, _, az in norms if az < -0.4)
        is_inversion = inverted_samples >= 3 and peak_angular > 120.0

        # Delta-V estimation over crash window (dt ~ 10ms = 0.01s)
        delta_v = 0.0
        for i in range(1, len(norms)):
            t1, a_norm, _, ax, ay, _ = norms[i]
            t0, _, _, _, _, _ = norms[i - 1]
            dt = max(0.001, (t1 - t0) / 1000.0)
            # Horizontal acceleration dissipation
            a_horiz = math.sqrt(ax ** 2 + ay ** 2)
            if a_horiz > 1.5:
                delta_v += a_horiz * 9.81 * dt

        return CollisionMetrics(
            peak_acceleration_g=round(peak_g, 2),
            peak_angular_speed_deg_s=round(peak_angular, 2),
            sustained_duration_ms=max_sustained_ms,
            delta_v_ms=round(delta_v, 2),
            is_inversion_detected=is_inversion,
            is_vertical_dominant=is_vertical_dominant,
            naive_6g_triggered=naive_triggered,
            t_peak_ms=t_peak
        )

    def analyze(self, readings: List[IMUReading]) -> CollisionMetrics:
        return self.extract_metrics(readings)
