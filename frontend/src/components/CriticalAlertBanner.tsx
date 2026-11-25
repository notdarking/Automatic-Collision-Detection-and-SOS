import React from 'react';
import { 
  AlertTriangle, 
  CheckCheck, 
  Clock, 
  Ambulance, 
  CheckCircle2, 
  Zap,
  UserX,
  Stethoscope
} from 'lucide-react';
import { AccidentDetail } from '../types/contracts';
import { formatUtcTime, formatRelativeTime } from '../utils/date';

interface CriticalAlertBannerProps {
  activeAccident: AccidentDetail | null;
  unacknowledgedCount: number;
  onAcknowledge: (id: string) => void;
}

export const CriticalAlertBanner: React.FC<CriticalAlertBannerProps> = ({
  activeAccident,
  unacknowledgedCount,
  onAcknowledge,
}) => {
  if (!activeAccident) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 text-center text-slate-400 font-mono text-xs">
        No active collisions logged in the emergency queue.
      </div>
    );
  }

  const isCritical = activeAccident.severity === 'CRITICAL';
  const isHigh = activeAccident.severity === 'HIGH';
  const isUnacknowledged = !activeAccident.acknowledged;
  const hospital = activeAccident.selected_hospital;
  const patient = activeAccident.patient;

  if (!isUnacknowledged) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 backdrop-blur-xl shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  INCIDENT {activeAccident.accident_id} ACKNOWLEDGED
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Acknowledged at {formatUtcTime(activeAccident.acknowledged_at)} UTC
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Trauma bay mobilized at {hospital?.name || 'Local Hospital'}. Ambulance transit active &bull; ETA: {hospital?.eta_min || 5} mins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-500/30">
            <Ambulance className="w-4 h-4" />
            <span>EMS Intercept In Route</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 relative overflow-hidden backdrop-blur-xl shadow-2xl transition-all ${
      isCritical 
        ? 'border-red-500/70 bg-gradient-to-r from-red-950/70 via-[#101a35] to-amber-950/30' 
        : isHigh 
          ? 'border-amber-500/60 bg-gradient-to-r from-amber-950/60 via-[#101a35] to-slate-900'
          : 'border-blue-500/40 bg-slate-900/80'
    }`}>
      <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
        {/* Left: Emergency Alert Badge & Collision Info */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl border shrink-0 ${
            isCritical 
              ? 'bg-red-500/20 border-red-500/50 text-red-400' 
              : 'bg-amber-500/20 border-amber-500/50 text-amber-400'
          }`}>
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-mono text-xs font-black uppercase px-2.5 py-0.5 rounded border tracking-wider ${
                isCritical 
                  ? 'bg-red-500 text-white border-red-400' 
                  : 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
              }`}>
                {isCritical ? '🚨 VERY CRITICAL INBOUND COLLISION' : '⚠️ HIGH ALERT INBOUND'}
              </span>

              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-cyan-300 font-bold">
                {activeAccident.accident_id}
              </span>

              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatUtcTime(activeAccident.timestamp)} UTC ({formatRelativeTime(activeAccident.timestamp)})
              </span>

              {unacknowledgedCount > 1 && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-red-300 font-bold">
                  +{unacknowledgedCount - 1} more pending
                </span>
              )}
            </div>

            <h2 className="text-base font-bold text-white mt-1.5 flex items-center gap-2">
              <span>Vehicle {activeAccident.vehicle_id}</span>
              <span className="text-slate-400 font-normal">&bull;</span>
              <span className="text-red-400 font-mono flex items-center gap-1 font-black">
                <Zap className="w-4 h-4 text-amber-400" />
                {activeAccident.impact_magnitude}g Impact Spike
              </span>
              <span className="text-slate-400 font-normal">&bull;</span>
              <span className="text-emerald-400 font-mono text-sm font-bold">
                ETA: {hospital?.eta_min || 6} mins ({hospital?.road_distance_km || hospital?.distance_km || 4.2} km)
              </span>
            </h2>

            <p className="text-xs text-slate-300 mt-0.5 line-clamp-1 font-mono">
              {activeAccident.detection_reason || `Collision detected at Coordinates ${activeAccident.latitude.toFixed(4)}, ${activeAccident.longitude.toFixed(4)}`}
            </p>
          </div>
        </div>

        {/* Center: Medically Realistic Occupant Triage Status (NO BLIND BLOOD GROUP ASSUMPTION) */}
        <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl font-mono text-xs space-y-1.5 max-w-md">
          <div className="flex items-center justify-between text-[11px] border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <UserX className="w-3.5 h-3.5 text-amber-400" />
              <span>Occupant Status:</span>
            </span>
            <span className="text-amber-300 font-bold bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-500/30 text-[10px]">
              IDENTITY UNVERIFIED AT SCENE
            </span>
          </div>

          <div className="text-[11px] text-slate-300 space-y-0.5">
            <div>
              <span className="text-slate-400">Registered Vehicle Owner: </span>
              {activeAccident.patient_id ? (
                <>
                  <strong className="text-white">{patient?.name || 'Unrecorded'}</strong>
                  <span className="text-slate-500 text-[10px]"> ({patient?.patient_id || activeAccident.patient_id})</span>
                </>
              ) : (
                <strong className="text-slate-300">No patient record linked.</strong>
              )}
            </div>
            <div className="text-[10px] text-red-300/90 flex items-center gap-1 pt-0.5">
              <Stethoscope className="w-3 h-3 text-red-400 shrink-0" />
              <span>Bedside cross-matching mandatory. Driver may not be vehicle owner.</span>
            </div>
          </div>
        </div>

        {/* Right: Hospital Acknowledgement Action Button */}
        <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
          <button
            onClick={() => onAcknowledge(activeAccident.accident_id)}
            className="w-full xl:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-emerald-600 to-emerald-500 hover:from-red-500 hover:to-emerald-400 text-white font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl shadow-emerald-950/60 transform hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Acknowledge & Mobilize Trauma Bay</span>
          </button>
        </div>
      </div>
    </div>
  );
};
