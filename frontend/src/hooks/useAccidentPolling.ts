import { useState, useEffect, useCallback, useRef } from 'react';
import { Accident, Patient, AccidentDetail } from '../types/contracts';
import { accidentService } from '../services/accidentService';
import { soundEffects } from '../services/soundEffects';
import { MOCK_SEED_ACCIDENTS, MOCK_PATIENTS } from '../mock/seedData';

interface UseAccidentPollingResult {
  accidents: AccidentDetail[];
  selectedAccident: AccidentDetail | null;
  setSelectedAccident: (accident: AccidentDetail | null) => void;
  isLoading: boolean;
  error: string | null;
  lastPollTime: Date | null;
  secondsUntilNextPoll: number;
  isMockMode: boolean;
  toggleMockMode: () => void;
  refreshNow: () => Promise<void>;
  acknowledgeAccident: (accidentId: string) => Promise<void>;
  injectSimulation: (preset: Partial<Accident>) => Promise<void>;
}

const POLLING_INTERVAL_SEC = 5;

// Pre-enriched initial seed state so Frame 0 has data immediately
const INITIAL_SEED_ACCIDENTS: AccidentDetail[] = MOCK_SEED_ACCIDENTS.map(acc => ({
  ...acc,
  patient: acc.patient_id ? (MOCK_PATIENTS[acc.patient_id] || null) : null
}));

export function useAccidentPolling(): UseAccidentPollingResult {
  const [accidents, setAccidents] = useState<AccidentDetail[]>(INITIAL_SEED_ACCIDENTS);
  const [selectedAccident, setSelectedAccident] = useState<AccidentDetail | null>(INITIAL_SEED_ACCIDENTS[0] || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(new Date());
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState<number>(POLLING_INTERVAL_SEC);
  const [isMockMode, setIsMockMode] = useState<boolean>(accidentService.isMock());

  const patientCache = useRef<Record<string, Patient>>(MOCK_PATIENTS);
  const prevCriticalCount = useRef<number>(0);

  // Helper to attach patient profile to an accident
  const enrichWithPatient = useCallback(async (accList: Accident[]): Promise<AccidentDetail[]> => {
    return Promise.all(
      accList.map(async (acc) => {
        if (!acc.patient_id) return { ...acc, patient: null };
        let patient = patientCache.current[acc.patient_id];
        if (!patient) {
          try {
            patient = await accidentService.getPatientById(acc.patient_id);
            patientCache.current[acc.patient_id] = patient;
          } catch {
            // patient lookup non-fatal fallback
          }
        }
        return {
          ...acc,
          patient: patient || null
        };
      })
    );
  }, []);

  // Poll function
  const poll = useCallback(async () => {
    try {
      const rawAccidents = await accidentService.getAccidents();
      const enriched = await enrichWithPatient(rawAccidents);

      setAccidents(enriched);
      setError(null);
      setLastPollTime(new Date());

      // Audio notification for newly arrived critical incidents
      const currentCritical = enriched.filter(
        a => !a.acknowledged && (a.severity === 'CRITICAL' || a.severity === 'HIGH')
      ).length;

      if (currentCritical > prevCriticalCount.current) {
        soundEffects.playCrashAlertSound();
      }
      prevCriticalCount.current = currentCritical;

      // Ensure active selected accident stays valid
      setSelectedAccident(prev => {
        if (!prev) return enriched[0] || null;
        const updated = enriched.find(a => a.accident_id === prev.accident_id);
        return updated || prev;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Telemetry polling network error';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [enrichWithPatient]);

  // Main Polling Interval
  useEffect(() => {
    poll();

    const interval = setInterval(() => {
      poll();
      setSecondsUntilNextPoll(POLLING_INTERVAL_SEC);
    }, POLLING_INTERVAL_SEC * 1000);

    const countdown = setInterval(() => {
      setSecondsUntilNextPoll(prev => (prev <= 1 ? POLLING_INTERVAL_SEC : prev - 1));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, [poll]);

  // Toggle Mock vs Real API
  const toggleMockMode = useCallback(() => {
    const nextMock = !isMockMode;
    accidentService.setMock(nextMock);
    setIsMockMode(nextMock);
    setIsLoading(true);
    poll();
  }, [isMockMode, poll]);

  // Refresh manually
  const refreshNow = useCallback(async () => {
    setIsLoading(true);
    await poll();
    setSecondsUntilNextPoll(POLLING_INTERVAL_SEC);
  }, [poll]);

  // Acknowledge incident
  const acknowledgeAccident = useCallback(async (accidentId: string) => {
    try {
      soundEffects.playClick();
      const updated = await accidentService.acknowledgeAccident(accidentId);
      let patient: Patient | undefined;
      if (updated.patient_id) {
        patient = patientCache.current[updated.patient_id];
        if (!patient) {
          try {
            patient = await accidentService.getPatientById(updated.patient_id);
            patientCache.current[updated.patient_id] = patient;
          } catch {
            // non-fatal: show the accident without a patient card
          }
        }
      }
      const detailed: AccidentDetail = {
        ...updated,
        patient: patient || null
      };

      setAccidents(prev => prev.map(a => a.accident_id === accidentId ? detailed : a));
      setSelectedAccident(prev => prev?.accident_id === accidentId ? detailed : prev);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to acknowledge incident';
      setError(msg);
    }
  }, []);

  // Inject simulation
  const injectSimulation = useCallback(async (preset: Partial<Accident>) => {
    const newAccident = await accidentService.injectCollisionEvent(preset);
    soundEffects.playCrashAlertSound();
    let patient: Patient | undefined;
    if (newAccident.patient_id) {
      patient = patientCache.current[newAccident.patient_id];
      if (!patient) {
        try {
          patient = await accidentService.getPatientById(newAccident.patient_id);
          patientCache.current[newAccident.patient_id] = patient;
        } catch {
          // non-fatal: show the accident without a patient card
        }
      }
    }
    const detailed: AccidentDetail = {
      ...newAccident,
      patient: patient || null
    };

    setAccidents(prev => [detailed, ...prev]);
    setSelectedAccident(detailed);
  }, []);

  return {
    accidents,
    selectedAccident,
    setSelectedAccident,
    isLoading,
    error,
    lastPollTime,
    secondsUntilNextPoll,
    isMockMode,
    toggleMockMode,
    refreshNow,
    acknowledgeAccident,
    injectSimulation
  };
}
