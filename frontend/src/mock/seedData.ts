import { Accident, Patient } from '../types/contracts';
import { ROAD_ROUTES } from './roadRoutes';

// Patient Records with Medical & Trauma Profiles (demo data)
// In compliance with clinical protocols, baseline owner records are available for historical verification,
// while active unverified crash notifications mandate bedside crossmatching before transfusion.
export const MOCK_PATIENTS: Record<string, Patient> = {
  'PT-001': {
    patient_id: 'PT-001',
    name: 'Rajesh Sharma (demo)',
    blood_group: 'B+',
    allergies: ['Penicillin', 'Sulfa Drugs'],
    medical_conditions: ['Type 2 Diabetes', 'Hypertension'],
    emergency_contact: {
      name: 'Sunita Sharma (Wife)',
      phone: '+00-555-0101'
    }
  },
  'PT-002': {
    patient_id: 'PT-002',
    name: 'Priya Verma (demo)',
    blood_group: 'O-',
    allergies: ['Aspirin (NSAIDs)'],
    medical_conditions: ['Asthma'],
    emergency_contact: {
      name: 'Amit Verma (Brother)',
      phone: '+00-555-0102'
    }
  },
  'PT-003': {
    patient_id: 'PT-003',
    name: 'Michael Chen (demo)',
    blood_group: 'A+',
    allergies: ['Latex', 'Iodine Radiocontrast'],
    medical_conditions: ['Previous Coronary Stent (2023)'],
    emergency_contact: {
      name: 'Linda Chen (Spouse)',
      phone: '+00-555-0103'
    }
  },
  'PT-004': {
    patient_id: 'PT-004',
    name: 'Emily Watson (demo)',
    blood_group: 'O+',
    allergies: ['None (NKDA)'],
    medical_conditions: ['Pregnancy (2nd Trimester)'],
    emergency_contact: {
      name: 'David Watson (Father)',
      phone: '+00-555-0104'
    }
  },
  'PT-005': {
    patient_id: 'PT-005',
    name: 'Arjun Patel (demo)',
    blood_group: 'AB-',
    allergies: ['Cephalosporins'],
    medical_conditions: ['None'],
    emergency_contact: {
      name: 'Sunita Patel (Mother)',
      phone: '+00-555-0105'
    }
  }
};

// Seed Accidents following Section 3 of CONTRACTS.md
// Routes follow true city street networks (from Hospital dispatch origin to Crash Site casualty location)
export const MOCK_SEED_ACCIDENTS: Accident[] = [
  {
    accident_id: 'evt-seed-001',
    vehicle_id: 'VH-101',
    timestamp: '2026-11-24T10:45:10', // CRITICAL - UNACKNOWLEDGED
    latitude: 26.8467,
    longitude: 80.9462,
    severity: 'CRITICAL',
    impact_magnitude: 15.4,
    selected_hospital: {
      name: 'MOCK Hospital A (demo data)',
      latitude: 26.8702,
      longitude: 80.9168,
      address: null,
      phone: null,
      distance_km: 4.2,
      road_distance_km: 5.1,
      eta_min: 7,
      route: ROAD_ROUTES['evt-seed-001']
    },
    notification_status: 'SENT',
    acknowledged: false,
    acknowledged_at: null,
    patient_id: 'PT-001',
    detection_reason: 'High-speed frontal collision at 78 km/h. Peak 15.4g impact sustained 48ms with gyro spike; ruled out braking.'
  },
  {
    accident_id: 'evt-seed-002',
    vehicle_id: 'VH-204',
    timestamp: '2026-11-24T10:20:00', // HIGH - UNACKNOWLEDGED
    latitude: 26.8520,
    longitude: 80.9600,
    severity: 'HIGH',
    impact_magnitude: 9.8,
    selected_hospital: {
      name: 'MOCK Hospital B (demo data)',
      latitude: 26.7450,
      longitude: 80.9380,
      address: null,
      phone: null,
      distance_km: 6.5,
      road_distance_km: 8.0,
      eta_min: 12,
      route: ROAD_ROUTES['evt-seed-002']
    },
    notification_status: 'SENT',
    acknowledged: false,
    acknowledged_at: null,
    patient_id: 'PT-002',
    detection_reason: 'Lateral T-bone impact at intersection. Curtain airbag deployment confirmed by ECU telemetry.'
  },
  {
    accident_id: 'evt-seed-003',
    vehicle_id: 'VH-309',
    timestamp: '2026-11-24T09:15:30', // MEDIUM - ACKNOWLEDGED
    latitude: 26.8390,
    longitude: 80.9350,
    severity: 'MEDIUM',
    impact_magnitude: 6.8,
    selected_hospital: {
      name: 'MOCK Hospital C (demo data)',
      latitude: 26.8620,
      longitude: 80.9980,
      address: null,
      phone: null,
      distance_km: 7.1,
      road_distance_km: 9.2,
      eta_min: 14,
      route: ROAD_ROUTES['evt-seed-003']
    },
    notification_status: 'SENT',
    acknowledged: true,
    acknowledged_at: '2026-11-24T09:18:12',
    patient_id: 'PT-003',
    detection_reason: 'Rear-end barrier collision at 34 km/h. Moderate cabin deceleration.'
  },
  {
    accident_id: 'evt-seed-004',
    vehicle_id: 'VH-412',
    timestamp: '2026-11-24T08:05:45', // CRITICAL - ACKNOWLEDGED
    latitude: 26.8850,
    longitude: 80.9120,
    severity: 'CRITICAL',
    impact_magnitude: 18.2,
    selected_hospital: {
      name: 'MOCK Hospital A (demo data)',
      latitude: 26.8702,
      longitude: 80.9168,
      address: null,
      phone: null,
      distance_km: 2.1,
      road_distance_km: 2.8,
      eta_min: 4,
      route: ROAD_ROUTES['evt-seed-004']
    },
    notification_status: 'SENT',
    acknowledged: true,
    acknowledged_at: '2026-11-24T08:08:01',
    patient_id: 'PT-004',
    detection_reason: 'Highway rollover crash. Tri-axis gyro inverted (180deg). Structural roof crush sensor triggered.'
  },
  {
    accident_id: 'evt-seed-005',
    vehicle_id: 'VH-505',
    timestamp: '2026-11-24T07:30:10', // LOW - PENDING
    latitude: 26.8420,
    longitude: 80.9410,
    severity: 'LOW',
    impact_magnitude: 6.1,
    selected_hospital: {
      name: 'MOCK Hospital D (demo data)',
      latitude: 26.8510,
      longitude: 80.9450,
      address: null,
      phone: null,
      distance_km: 1.4,
      road_distance_km: 1.8,
      eta_min: 4,
      route: ROAD_ROUTES['evt-seed-005']
    },
    notification_status: 'PENDING',
    acknowledged: false,
    acknowledged_at: null,
    patient_id: 'PT-005',
    detection_reason: 'Low-speed barrier scrape at 22 km/h. Just crossed 6.0g hardware gate; driver responsive.'
  }
];
