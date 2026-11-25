import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Clock, 
  CheckCheck, 
  Droplet, 
  Car, 
  Hospital as HospitalIcon, 
  Zap,
  PhoneCall,
  UserCheck,
  AlertCircle,
  FileText,
  Navigation,
  Waypoints,
  Archive
} from 'lucide-react';
import { AccidentDetail } from '../types/contracts';
import { formatUtcDateTime, formatRelativeTime } from '../utils/date';

interface AccidentHistorySectionProps {
  accidents: AccidentDetail[];
  selectedId: string | undefined;
  onSelectAccident: (accident: AccidentDetail) => void;
  onAcknowledge: (id: string) => void;
}

type FilterTab = 'ALL' | 'UNACKNOWLEDGED' | 'CRITICAL_HIGH' | 'ACKNOWLEDGED';

export const AccidentHistorySection: React.FC<AccidentHistorySectionProps> = ({
  accidents,
  selectedId,
  onSelectAccident,
  onAcknowledge,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Stats
  const unackCount = useMemo(() => accidents.filter(a => !a.acknowledged).length, [accidents]);
  const criticalHighCount = useMemo(() => accidents.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length, [accidents]);

  const filteredAccidents = useMemo(() => {
    return accidents.filter(acc => {
      // Tab filter
      if (filterTab === 'UNACKNOWLEDGED' && acc.acknowledged) return false;
      if (filterTab === 'ACKNOWLEDGED' && !acc.acknowledged) return false;
      if (filterTab === 'CRITICAL_HIGH' && acc.severity !== 'CRITICAL' && acc.severity !== 'HIGH') return false;
      if (severityFilter !== 'ALL' && acc.severity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && acc.notification_status !== statusFilter) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        acc.accident_id.toLowerCase().includes(q) ||
        acc.vehicle_id.toLowerCase().includes(q) ||
        (acc.patient_id ?? '').toLowerCase().includes(q) ||
        (acc.patient?.name && acc.patient.name.toLowerCase().includes(q)) ||
        (acc.patient?.blood_group && acc.patient.blood_group.toLowerCase().includes(q)) ||
        (acc.selected_hospital?.name && acc.selected_hospital.name.toLowerCase().includes(q))
      );
    });
  }, [accidents, filterTab, severityFilter, statusFilter, searchQuery]);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl shadow-black/20 space-y-5">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Previous Accidents & Patient Medical Records
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {accidents.length} Logged
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Historical collision logs with associated patient profile, blood group, allergies, conditions, and ER dispatch status
            </p>
          </div>
        </div>

        {/* Search & Quick Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by accident, patient, blood group, vehicle..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <select
            aria-label="Filter by severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <select
            aria-label="Filter by notification status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SENT">SENT</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
          </select>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterTab === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({accidents.length})
            </button>

            <button
              onClick={() => setFilterTab('UNACKNOWLEDGED')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                filterTab === 'UNACKNOWLEDGED' ? 'bg-red-950 text-red-300 border border-red-500/50 font-bold' : 'text-slate-400 hover:text-red-300'
              }`}
            >
              <span>Pending</span>
              {unackCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              )}
            </button>

            <button
              onClick={() => setFilterTab('CRITICAL_HIGH')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterTab === 'CRITICAL_HIGH' ? 'bg-amber-950 text-amber-300 border border-amber-500/50 font-bold' : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              Critical / High ({criticalHighCount})
            </button>

            <button
              onClick={() => setFilterTab('ACKNOWLEDGED')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterTab === 'ACKNOWLEDGED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold' : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              Acknowledged
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Accidents + Embedded Patient Medical Records */}
      {filteredAccidents.length === 0 ? (
        <div className="text-center py-12 text-slate-500 font-mono text-xs">
          No accidents match your search or filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredAccidents.map((acc) => {
            const isSelected = acc.accident_id === selectedId;
            const isCritical = acc.severity === 'CRITICAL';
            const isHigh = acc.severity === 'HIGH';
            const isMedium = acc.severity === 'MEDIUM';

            const severityBadge = isCritical 
              ? 'bg-red-500/10 text-red-400 border-red-500/40 glow-red'
              : isHigh
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 glow-amber'
                : isMedium
                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/40'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/40';

            const patient = acc.patient;
            const hospital = acc.selected_hospital;
            const hasWaypoints = Boolean(hospital?.route && hospital.route.length >= 2);

            return (
              <div
                key={acc.accident_id}
                className={`rounded-2xl border p-5 transition-all flex flex-col justify-between gap-4 ${
                  isSelected 
                    ? 'bg-slate-800/90 border-blue-500 shadow-xl glow-cyan ring-1 ring-blue-500/50' 
                    : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700/80 hover:bg-slate-900/60'
                }`}
              >
                {/* 1. Card Top Header: ID, Severity, G-Force & UTC Time */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-white">{acc.accident_id}</span>
                    <span className={`px-2 py-0.5 rounded font-black border text-[10px] ${severityBadge}`}>
                      {acc.severity}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      {acc.vehicle_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-amber-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      {acc.impact_magnitude.toFixed(1)}g Spike
                    </span>
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatUtcDateTime(acc.timestamp)} UTC ({formatRelativeTime(acc.timestamp)})
                    </span>
                  </div>
                </div>

                {/* 2. Embedded Patient Medical Record Box */}
                {patient ? (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 font-mono text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-bold text-[10px] flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          {patient.patient_id}
                        </span>
                        <strong className="text-white text-sm">{patient.name}</strong>
                      </div>

                      {/* Blood Group Highlight Badge */}
                      <div className="flex items-center gap-1.5 bg-red-950/70 border border-red-500/40 px-2.5 py-1 rounded-lg">
                        <Droplet className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                        <span className="text-[10px] text-red-300 font-bold">BLOOD:</span>
                        <span className="text-xs font-black text-red-400">{patient.blood_group}</span>
                      </div>
                    </div>

                    {/* Allergies & Conditions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-amber-400 font-bold flex items-center gap-1 mb-1">
                          <AlertCircle className="w-3 h-3" />
                          Critical Allergies:
                        </span>
                        {patient.allergies && patient.allergies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {patient.allergies.map((all, i) => (
                              <span key={i} className="px-1.5 py-0.2 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[10px]">
                                {all}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">None recorded</span>
                        )}
                      </div>

                      <div>
                        <span className="text-cyan-400 font-bold flex items-center gap-1 mb-1">
                          <FileText className="w-3 h-3" />
                          Chronic Conditions:
                        </span>
                        {patient.medical_conditions && patient.medical_conditions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {patient.medical_conditions.map((cond, i) => (
                              <span key={i} className="px-1.5 py-0.2 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-[10px]">
                                {cond}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">None recorded</span>
                        )}
                      </div>
                    </div>

                    {/* Emergency Next of Kin Contact */}
                    {patient.emergency_contact && (
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <PhoneCall className="w-3 h-3 text-slate-400" />
                          Contact: <strong className="text-white">{patient.emergency_contact.name}</strong>
                        </span>
                        <a 
                          href={`tel:${patient.emergency_contact.phone}`}
                          className="text-cyan-400 font-bold hover:underline"
                        >
                          {patient.emergency_contact.phone}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-900/60 p-2.5 rounded-lg text-xs font-mono text-slate-500">
                    {acc.patient_id
                      ? `Patient ID ${acc.patient_id} record unavailable.`
                      : 'No patient record linked.'}
                  </div>
                )}

                {/* 3. Hospital & Route Information */}
                {hospital && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono bg-slate-900/40 border border-slate-800/60 p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <HospitalIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <strong className="text-white block">{hospital.name}</strong>
                        <span className="text-[10px] text-slate-400">
                          {hospital.distance_km} km &bull; ETA: <strong className="text-emerald-400">{hospital.eta_min} mins</strong>
                        </span>
                      </div>
                    </div>

                    <div>
                      {hasWaypoints ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1">
                          <Waypoints className="w-3 h-3" />
                          {hospital.route!.length} Route Waypoints
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Route: Null (Direct Vector)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Collision Detection Reason */}
                {acc.detection_reason && (
                  <p className="text-[11px] font-mono text-slate-400 italic line-clamp-1 bg-slate-950/40 p-2 rounded border border-slate-800/40">
                    &ldquo;{acc.detection_reason}&rdquo;
                  </p>
                )}

                {/* 5. Card Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs font-mono">
                  {/* Acknowledgement Status & Action */}
                  <div>
                    {acc.acknowledged ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Acknowledged ({formatUtcDateTime(acc.acknowledged_at)})
                      </span>
                    ) : (
                      <button
                        onClick={() => onAcknowledge(acc.accident_id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Acknowledge Collision</span>
                      </button>
                    )}
                  </div>

                  {/* Load on Live Map button */}
                  <button
                    onClick={() => {
                      onSelectAccident(acc);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isSelected ? 'Active on Live Map' : 'Inspect on Live Map'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
