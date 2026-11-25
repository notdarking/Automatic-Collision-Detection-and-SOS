import { Accident, Patient } from '../types/contracts';
import { MOCK_SEED_ACCIDENTS, MOCK_PATIENTS } from '../mock/seedData';

// Configurable environment values
const DEFAULT_API_BASE = 'http://localhost:8000';
const DEFAULT_API_KEY = 'dev-hospital-key';

// Read env flags with clean fallbacks
const envUseMock = import.meta.env.VITE_USE_MOCK_DATA;
let useMockData = envUseMock === undefined ? true : String(envUseMock).toLowerCase() === 'true';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '');
const apiKey = import.meta.env.VITE_API_KEY || DEFAULT_API_KEY;

// In-memory mock database that preserves changes (like acknowledgements & new events) during session
let mockAccidentStore: Accident[] = [...MOCK_SEED_ACCIDENTS];
const mockPatientStore: Record<string, Patient> = { ...MOCK_PATIENTS };

export const accidentService = {
  // Check if currently running against mock or real backend
  isMock(): boolean {
    return useMockData;
  },

  // Toggle mock/live at runtime
  setMock(enabled: boolean) {
    useMockData = enabled;
  },

  getBaseUrl(): string {
    return apiBaseUrl;
  },

  getApiKey(): string {
    return apiKey;
  },

  // Helper for authenticated requests with header X-API-Key: dev-hospital-key
  async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${apiBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers || {});
    
    // As instructed: Send the header X-API-Key: dev-hospital-key on every request.
    headers.set('X-API-Key', apiKey);
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    return response;
  },

  // 1. GET /api/v1/events?severity=&status=&q=
  async getAccidents(params?: { severity?: string; status?: string; q?: string }): Promise<Accident[]> {
    if (useMockData) {
      let filtered = [...mockAccidentStore];

      if (params?.severity) {
        filtered = filtered.filter(a => a.severity.toUpperCase() === params.severity?.toUpperCase());
      }
      if (params?.status) {
        filtered = filtered.filter(a => a.notification_status.toUpperCase() === params.status?.toUpperCase());
      }
      if (params?.q) {
        const query = params.q.toLowerCase();
        filtered = filtered.filter(a => 
          a.accident_id.toLowerCase().includes(query) ||
          a.vehicle_id.toLowerCase().includes(query) ||
          (a.patient_id ?? '').toLowerCase().includes(query) ||
          (a.selected_hospital?.name && a.selected_hospital.name.toLowerCase().includes(query))
        );
      }

      // Sort newest first
      return filtered.sort((a, b) => {
        const tA = new Date(a.timestamp.endsWith('Z') ? a.timestamp : `${a.timestamp}Z`).getTime();
        const tB = new Date(b.timestamp.endsWith('Z') ? b.timestamp : `${b.timestamp}Z`).getTime();
        return tB - tA;
      });
    }

    // Real backend call
    const queryParams = new URLSearchParams();
    if (params?.severity) queryParams.set('severity', params.severity);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.q) queryParams.set('q', params.q);

    const qs = queryParams.toString();
    const endpoint = `/api/v1/events${qs ? `?${qs}` : ''}`;

    const res = await this.fetchWithAuth(endpoint);
    if (!res.ok) {
      throw new Error(`Failed to fetch events (${res.status} ${res.statusText})`);
    }
    const data: Accident[] = await res.json();
    return data;
  },

  // 2. GET /api/v1/events/{event_id}
  async getAccidentById(eventId: string): Promise<Accident> {
    if (useMockData) {
      const match = mockAccidentStore.find(a => a.accident_id === eventId);
      if (!match) throw new Error(`Accident ${eventId} not found`);
      return { ...match };
    }

    const res = await this.fetchWithAuth(`/api/v1/events/${eventId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch event ${eventId} (${res.status})`);
    }
    return res.json();
  },

  // 3. POST /api/v1/events/{event_id}/acknowledge
  async acknowledgeAccident(eventId: string): Promise<Accident> {
    if (useMockData) {
      const idx = mockAccidentStore.findIndex(a => a.accident_id === eventId);
      if (idx === -1) throw new Error(`Accident ${eventId} not found`);

      const nowIso = new Date().toISOString().replace('Z', ''); // simulate backend timestamp without Z
      const updated: Accident = {
        ...mockAccidentStore[idx],
        acknowledged: true,
        acknowledged_at: nowIso
      };
      mockAccidentStore[idx] = updated;
      return { ...updated };
    }

    const res = await this.fetchWithAuth(`/api/v1/events/${eventId}/acknowledge`, {
      method: 'POST'
    });
    if (!res.ok) {
      throw new Error(`Failed to acknowledge accident (${res.status})`);
    }
    return res.json();
  },

  // 4. GET /api/v1/patients/{patient_id}
  async getPatientById(patientId: string): Promise<Patient> {
    if (useMockData) {
      const patient = mockPatientStore[patientId];
      if (!patient) {
        // Return a clean fallback object instead of crashing if ID is unknown
        return {
          patient_id: patientId,
          name: `Patient ${patientId}`,
          blood_group: 'Unknown',
          allergies: [],
          medical_conditions: [],
          emergency_contact: { name: 'Emergency Contact', phone: 'N/A' }
        };
      }
      return { ...patient };
    }

    const res = await this.fetchWithAuth(`/api/v1/patients/${patientId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch patient ${patientId} (${res.status})`);
    }
    return res.json();
  },

  // 5. Simulation / Demo Helper: Inject a new event into the store (Mock or Backend)
  async injectCollisionEvent(event: Partial<Accident>): Promise<Accident> {
    const newId = event.accident_id || `evt-${Date.now().toString().slice(-4)}`;
    const nowTimestamp = new Date().toISOString().replace('Z', '');

    const newAccident: Accident = {
      accident_id: newId,
      vehicle_id: event.vehicle_id || 'VH-777',
      timestamp: event.timestamp || nowTimestamp,
      latitude: event.latitude || 26.8500,
      longitude: event.longitude || 80.9300,
      severity: event.severity || 'CRITICAL',
      impact_magnitude: event.impact_magnitude || 14.5,
      selected_hospital: event.selected_hospital || {
        name: 'MOCK Hospital A (demo data)',
        latitude: 26.8702,
        longitude: 80.9168,
        address: null,
        phone: null,
        distance_km: 3.5,
        road_distance_km: 4.2,
        eta_min: 6,
        route: [
          [26.8500, 80.9300],
          [26.8600, 80.9250],
          [26.8702, 80.9168]
        ]
      },
      notification_status: event.notification_status || 'SENT',
      acknowledged: false,
      acknowledged_at: null,
      patient_id: event.patient_id ?? null,
      detection_reason: event.detection_reason || 'Live simulator injection: 14.5g sensor impact.'
    };

    if (useMockData) {
      mockAccidentStore = [newAccident, ...mockAccidentStore];
      return newAccident;
    }

    // If connected to real backend, call POST /api/v1/events
    const res = await this.fetchWithAuth('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        event_id: newAccident.accident_id,
        vehicle_id: newAccident.vehicle_id,
        timestamp: newAccident.timestamp,
        severity: newAccident.severity,
        impact_magnitude: newAccident.impact_magnitude,
        confidence_score: 0.9,
        detection_reason: newAccident.detection_reason,
        latitude: newAccident.latitude,
        longitude: newAccident.longitude
      })
    });
    if (!res.ok) {
      throw new Error(`Failed to post new event to backend (${res.status})`);
    }
    return res.json();
  },

  // Reset mock store back to original seed data
  resetMockStore() {
    mockAccidentStore = [...MOCK_SEED_ACCIDENTS];
  }
};
