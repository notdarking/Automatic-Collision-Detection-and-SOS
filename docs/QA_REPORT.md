# Final QA Report — Automated Vehicle Collision Detection & Direct Emergency Hospital Dispatch System

**Branch:** `chore/final-qa` (branched from `main`)  
**Environment:** Windows, Python `.venv\Scripts\python.exe`, Node/Vite frontend  
**Notifications:** Mocked (`MOCK_NOTIFICATIONS=true`)

---

## 1. Automated Test-Suite & Build Results

| Suite / Check | Result | Count & Timing | Notes |
|---|---|---|---|
| `backend/tests` | PASS | 32 passed in 0.67s (fresh clone: 0.95s) | Sped up from 72.54s after fixing `event_service.py` module import so `@patch` intercepts `hospital_client.find_nearest_hospital` |
| `collision_engine/tests` | PASS | 14 passed in 0.55s (fresh clone: 0.65s) | Includes new bad-input (empty, negative `t_ms`, `NaN`, non-monotonic) and non-10ms spacing tests |
| `hospital_intelligence/tests` | PASS | 11 passed in 0.45s (fresh clone: 0.59s) | Mocked `httpx`/Overpass/OSRM in API tests for determinism without removing coverage |
| `collision_engine/tests/run_verification.py` | PASS | 6/6 scenarios verified | Naive 6g baseline tripped on `pothole` (`True`, 8.21g); multi-stage rejected `pothole` (`False`, 10ms, 6.2 deg/s) and detected `high_impact_collision` (CRITICAL, 13.13g, 50ms) and `rollover` (CRITICAL, 9.60g, 310ms) |
| `hospital_intelligence/tests/run_verification.py` | PASS | 7 discovered, top-5 ranked | Overpass timed out -> clean `MOCK` fallback; top hospital `Civil Hospital Hazratganj (demo data)` (ETA 1 min, 0.67 km, `phone=None`) |
| `frontend` (`npm run build`) | PASS | `tsc -b && vite build` 0 errors in 5.87s (fresh clone: 3.62s) | No `lint` script defined in `frontend/package.json` |
| Fresh-clone verification (`git clone` in `%TEMP%`) | PASS | 57/57 pytest passed + seed + build | Executed all `README.md` setup, test, seed, and build commands from clean clone |

---

## 2. End-to-End Verification Checklist (Checks 1–26)

| # | Check | Status | Observed Evidence |
|---|---|---|---|
| 1 | Backend `GET /health` without key | PASS | `200` `{"status": "ok", "service": "acds-backend", "version": "1.0.0"}` |
| 2 | `GET /api/v1/events` auth & empty DB | PASS | No key -> `401`; wrong key -> `401`; `dev-hospital-key` on empty DB -> `200 []` |
| 3 | `POST /api/v1/events` contract payload | PASS | `200`, `selected_hospital` = `'Civil Hospital Hazratganj (demo data)'`, `notification_status` = `SENT`, SQLite `notification_logs` has `[('sms', 'SENT'), ('voice', 'SENT')]` |
| 4 | Repeat `POST /api/v1/events` duplicate prevention | PASS | Returned existing `qa-evt-001` (`200`); `notification_logs` count remained `2` (no second send) |
| 5 | `GET /api/v1/events/{id}`, 404, filters | PASS | Known ID -> `200`; unknown -> `404`; `?severity=HIGH&status=SENT&q=qa-evt` -> 1 match; `?severity=LOW` -> `[]` |
| 6 | `POST /api/v1/events/{id}/acknowledge` | PASS | `200`, `acknowledged=True`, `acknowledged_at` set, `notification_status` stayed `SENT`; second call idempotent (identical `acknowledged_at`); unknown ID -> `404` |
| 7 | Patients API & vehicle link | PASS | `POST /patients`: hospital key `403`, no key `401`, admin key `201`, duplicate `409`; `GET /patients/{id}`: hospital & admin `200`, unknown `404`; linked vehicle event got `patient_id='PT-QA-01'`, unlinked got `None` |
| 8 | Backend invalid inputs | PASS | Missing fields, bad severity (`ULTRA`), `lat=200`, `lon=-200`, malformed JSON, empty body all returned `422` JSON with `{"detail": ...}` (0 `500`s) |
| 9 | DB recreation on startup | PASS | Deleted `vehicle_emergency.db` and restarted backend on `:8000`; tables created on startup (`no such table` did not occur) |
| 10 | `backend.database.seed` & `demo.py` | PASS | `seed` inserted 2 patients + 5 accidents; `demo.py` completed with exit code `0`; second `seed` run succeeded idempotently |
| 11 | Mock mode & `MOCK_NOTIFICATIONS` parsing | PASS | Default `True`, `'true'` -> `True`, `'false'` -> `False`; mock tests verify Twilio is never constructed |
| 12 | Collision engine `:8001` scenarios | PASS | `GET /health` `200`; only `high_impact_collision` (`CRITICAL`) and `rollover` (`CRITICAL`) detected (`True`); `normal_driving`, `hard_braking`, `pothole`, `minor_bump` -> `collision_detected=False`, `severity=None` |
| 13 | Collision engine bad inputs | PASS | Empty readings `422`, single reading `200` (safe), negative `t_ms` `422`, non-monotonic `t_ms` `200` (safe), `NaN` `422`, `1e9` `200`, missing `vehicle_id` `422` (0 `500`s) |
| 14 | `collision_engine/tests/run_verification.py` | PASS | Ran cleanly; `pothole` naive 6g `True` vs multi-stage `False` (8.21g, 10ms, 6.2 deg/s); `high_impact_collision` `True` (`CRITICAL`); `rollover` `True` (`CRITICAL`) |
| 15 | Hospital finder `:8002` Lucknow `(26.8467, 80.9462, 15)` | PASS | `200`, `source='mock'`, 5 hospitals sorted by `eta_min` `[1, 4, 9, 11, 12]`, all labelled `(demo data)` with `phone=None` |
| 16 | Hospital finder invalid inputs & `(0, 0)` | PASS | `lat=91`, `lon=181`, `radius=0`, `radius=-5`, missing fields -> `422`; `(0, 0)` -> `200` `{"hospitals": [], "source": "mock"}` |
| 17 | Overpass/OSRM unreachable simulation | PASS | Pointed Overpass & OSRM URLs to dead port `127.0.0.1:59999`: returned `200`, `source='mock'`, 5 demo hospitals in `6.47s` (< `12.0s` backend timeout) |
| 18 | Integration with stopped services | PASS | Hospital `:8002` stopped -> backend `POST /events` returned `200` with `'MOCK Hospital A (test data)'`; Collision `:8001` stopped -> `POST /simulate/analyze` returned `502` |
| 19 | Full chain `/api/v1/simulate/analyze` | PASS | `high_impact_collision` created event `evt_2d7aee21` with `'Civil Hospital Hazratganj (demo data)'`; `pothole` returned `200` `{"detail": "No collision detected by the collision engine"}` and created no event |
| 20 | Frontend load & polling at `:3000` | PASS (Static/HTTP) | Chrome DevTools MCP & Playwright were unavailable in this environment; verified Vite dev server returns `200` at `http://localhost:3000`, `useAccidentPolling.ts` polls `/api/v1/events` every `5s` and guards `!acc.patient_id` so `/patients/null` is never requested, and `tsc -b && vite build` passed with 0 errors |
| 21 | Acknowledge with & without patient | PASS (Code/API) | Verified `useAccidentPolling.ts` `acknowledgeAccident` checks `if (updated.patient_id)` before fetching `/patients/{id}`, clears `error` on success, and backend returns `200` for both cases |
| 22 | Crash injector contract payload | PASS (Code) | Verified `accidentService.ts` `injectCollisionEvent` POSTs to `/api/v1/events` with `event_id` (not `accident_id`) and contract fields (`vehicle_id`, `timestamp`, `severity`, `impact_magnitude`, `confidence_score`, `detection_reason`, `latitude`, `longitude`) |
| 23 | Map markers, route fallback, UTC timestamps | PASS (Code) | Verified `HospitalMap.tsx` renders accident/hospital markers and straight-line/grid fallback when `route` is `null` or empty; fixed `frontend/src/utils/date.ts` to pass `timeZone: 'UTC'` when formatting timestamps lacking `Z` |
| 24 | `VITE_USE_MOCK_DATA=true` standalone mode | PASS | Set `VITE_USE_MOCK_DATA=true` in `frontend/.env` with backend stopped; `http://localhost:3000` served `200` and `accidentService.ts` uses `MOCK_SEED_ACCIDENTS` / `MOCK_PATIENTS` without backend calls; switched back to `false` |
| 25 | History search & severity/status filters | PASS (Code) | Fixed null `patient_id` search crash in `AccidentHistorySection.tsx` and added Severity (`CRITICAL`/`HIGH`/`MEDIUM`/`LOW`) & Status (`SENT`/`PENDING`/`FAILED`) filters alongside tabs |
| 26 | Unlinked patient wording | PASS (Code) | Updated `AccidentHistorySection.tsx` and `CriticalAlertBanner.tsx` to display `"No patient record linked."` when `patient_id` is `null` |

*(Note on checks 20–26: Live browser DOM/console execution could not run because Google Chrome remote debugging and Playwright were not available on the host; all frontend checks were verified via `tsc -b && vite build`, live Vite HTTP serving at `:3000`, live backend responses, and direct code inspection.)*

---

## 3. Fixes Applied (by File)

- `.gitignore` — Ignore TypeScript incremental `*.tsbuildinfo` files.
- `requirements.txt` — Remove duplicate `httpx` and unused `pydantic-settings`, `geopy`, `pytest-asyncio`.
- `backend/{api,models,schemas,services,integrations,notifications,database,tests}/__init__.py` — Delete stray literal-brace shell-artifact file and directory.
- `collision_engine/data/*.json` — Delete unused generated sample JSON files.
- `hospital_intelligence/api/schemas.py` — Replace fabricated `"King George's Medical University"` / `"Shah Mina Rd..."` / `"+91 522 225 7450"` schema examples with generic demo/null examples.
- `hospital_intelligence/discovery/overpass.py` — Use `"Unnamed hospital (OpenStreetMap)"` as default name when OSM tags lack a name.
- `hospital_intelligence/tests/test_hospitals.py` — Mock Overpass/OSRM in API tests for deterministic execution and add tests for `way`/`center` parsing, unnamed default, and remote `(0, 0)` empty result.
- `collision_engine/detection/detector.py` — Load `collision_engine/.env` with `python-dotenv` (if installed) and compute `step_ms` from median positive `t_ms` spacing (fallback `10`).
- `collision_engine/api/schemas.py` — Enforce `t_ms >= 0`, non-empty `vehicle_id`/`timestamp`, and finite float validation (`NaN`/`Inf` rejected).
- `collision_engine/api/main.py` — Add `RequestValidationError` handler sanitizing non-finite floats and `Exception` instances so `NaN` inputs return `422` instead of `500`.
- `backend/api/main.py` — Add `RequestValidationError` handler sanitizing non-finite floats and `Exception` instances.
- `backend/schemas/accident.py` — Validate `latitude` (`[-90, 90]`), `longitude` (`[-180, 180]`), `confidence_score` (`[0, 1]`), and `severity` (`LOW | MEDIUM | HIGH | CRITICAL | None`).
- `backend/schemas/collision.py` — Validate `t_ms >= 0`, non-empty `vehicle_id`/`readings`, and `latitude`/`longitude` bounds.
- `backend/models/accident.py` — Use microsecond-precision UTC default (`datetime.now(timezone.utc)`) for `created_at` so SQLite ordering (`newest first`) is deterministic within the same second.
- `backend/services/event_service.py` — Call `hospital_client.find_nearest_hospital` via module attribute so unit-test patches work cleanly (reducing `backend/tests` runtime from 72.5s to <1s).
- `backend/tests/test_events.py` — Add parametrized `422` validation tests for invalid coordinates and severity.
- `collision_engine/tests/test_api.py` — Add bad-input tests (`empty`, `neg t_ms`, `NaN`, non-monotonic, missing `vehicle_id`) and non-10ms spacing test.
- `frontend/src/components/*` (12 unused files), `frontend/src/mock/mockData.ts`, `frontend/src/types/index.ts` — Remove unused legacy components and mock data containing `availableIcuBeds`, `TraumaLevel`, and `EMERGENCY_SERVICES_E911`.
- `frontend/src/mock/seedData.ts` — Replace unverified real hospital names/addresses/phones and Indian mobile numbers with `MOCK Hospital ... (demo data)`, `address: null`, `phone: null`, and `+00-555-...` demo contacts.
- `frontend/src/services/accidentService.ts` — Replace fallback hospital details with `MOCK Hospital A (demo data)` / `null` fields and avoid defaulting unlinked injected events to `PT-001`.
- `frontend/src/components/HospitalMap.tsx` — Replace hardcoded fallback phone `'+91-522-2257540'` with `'Not available'`.
- `frontend/src/hooks/useAccidentPolling.ts` — Fix undefined `updated` reference in `injectSimulation` (`newAccident`), guard `MOCK_PATIENTS[acc.patient_id]` for `null`, and clear error state on successful acknowledge.
- `frontend/src/utils/date.ts` — Pass `timeZone: 'UTC'` in `formatUtcTime` and `formatUtcDateTime` so UTC timestamps display as UTC regardless of host timezone.
- `frontend/src/components/AccidentHistorySection.tsx` — Guard `(acc.patient_id ?? '')` in search, add Severity and Status filter dropdowns, and display `"No patient record linked."` when `patient_id` is `null`.
- `frontend/src/components/CriticalAlertBanner.tsx` — Display `"No patient record linked."` when `activeAccident.patient_id` is `null`.
- `README.md` — Update with Windows (`cmd`) and macOS/Linux quick start, `VITE_USE_MOCK_DATA`/`VITE_API_KEY` docs, ordered 4-terminal full demo guide, test commands, placeholder ownership table, and full Limitations section.

---

## 4. Remaining Issues & Design Risks (Not Fixed, Ordered by Severity)

1. **High — Client-side API key exposure & permissive CORS:** `VITE_API_KEY` is bundled in client-side JS and `backend/api/main.py`, `collision_engine/api/main.py`, and `hospital_intelligence/api/main.py` configure `allow_origins=["*"]`. Acceptable for local demo only; production requires proper auth/session tokens and restricted CORS origins.
2. **Medium — Live browser DOM/console execution unverified:** Chrome DevTools remote debugging and Playwright were unavailable, so runtime browser console/DOM checks (20–26) rely on TypeScript build + Vite HTTP `200` + live backend tests + code review rather than an automated browser run.
3. **Medium — `VehicleLink` duplicate vehicle collision on `POST /api/v1/patients`:** `vehicle_links.vehicle_id` is a primary key; creating a second patient with an already-linked `vehicle_id` would raise an unhandled SQLAlchemy `IntegrityError` (`500`) instead of `409`.
4. **Medium — Unverified OSM & mocked emergency routing:** Notifications stay mocked (`MOCK_NOTIFICATIONS=true`), OSM hospital contact details/bed readiness are unverified, and a real deployment must integrate with official `112` dispatch and explicit patient consent.
5. **Low — `frontend/package.json` has no `lint` script:** Only `tsc -b && vite build` runs; ESLint is not configured.
6. **Low — `backend/database/seed.py` & `backend/integrations/mock_hospitals.py` use synthetic placeholder addresses/phones:** Kept intentionally (`Simulation City`, `+00-000-0000001`, `MOCK Hospital A (test data)`) since they are obviously fake test fixtures.

---

## 5. Exact Commands to Run Everything on Windows

```cmd
:: 1. Setup venv & dependencies (from repo root)
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

:: 2. Create env files
copy backend\.env.example backend\.env
copy collision_engine\.env.example collision_engine\.env
copy frontend\.env.example frontend\.env
:: (Edit frontend\.env and set VITE_USE_MOCK_DATA=false to use the live backend)

:: 3. Run automated tests & frontend build
.venv\Scripts\python.exe -m pytest backend/tests -q
.venv\Scripts\python.exe -m pytest collision_engine/tests -q
.venv\Scripts\python.exe -m pytest hospital_intelligence/tests -q
.venv\Scripts\python.exe collision_engine/tests/run_verification.py
.venv\Scripts\python.exe hospital_intelligence/tests/run_verification.py
cd frontend && npm install && npm run build && cd ..

:: 4. Start all 4 services (in 4 separate terminals from repo root)
:: Terminal 1:
.venv\Scripts\python.exe -m uvicorn collision_engine.api.main:app --port 8001 --reload
:: Terminal 2:
.venv\Scripts\python.exe -m uvicorn hospital_intelligence.api.main:app --port 8002 --reload
:: Terminal 3:
.venv\Scripts\python.exe -m uvicorn backend.api.main:app --port 8000 --reload
:: Optional seed & demo (Terminal 3b):
.venv\Scripts\python.exe -m backend.database.seed
.venv\Scripts\python.exe demo.py
:: Terminal 4:
cd frontend && npm run dev
```
