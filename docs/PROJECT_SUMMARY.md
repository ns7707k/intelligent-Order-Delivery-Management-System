# Intelligent Order Delivery Management System — Project Summary

Purpose
- Provide a single-source briefing for engineering teams onboarding to the project: architecture, key design decisions, how the system works, how to run it locally, testing, known issues, and next steps.

High-level overview
- What: A delivery management platform that handles driver registration/affiliation, order intake, route optimization, driver assignment, and analytics.
- Why: Automate efficient assignment of drivers to orders while supporting real-world constraints (drivers returning from deliveries, dynamic fees, platform fee split, and simple VRP optimization for small/medium scale).
- Who: Two main codebases — `backend` (Python Flask API + services), `frontend` (React + Vite UI), plus a data pipeline and database artifacts.

Repository structure (top-level)
- `backend/` — Flask application, models, routes, services, and utilities.
- `frontend/` — React + Vite client UI and related services.
- `database/` — SQL schema and seeds. Canonical schema is in `database/supabase/schema.sql`.
- `data_pipeline/` — ETL and replay engine for historical simulations.
- `tests/` — pytest-based backend tests and some frontend test harness.
- `amazon_delivery.csv`, `PRD.md` — project docs and sample data.

Important files (quick links)
- App entry: [run.py](run.py)
- Backend app factory and init: [backend/app/__init__.py](backend/app/__init__.py)
- Routes: [backend/app/routes/](backend/app/routes/) (orders, drivers, auth, routes_api, etc.)
- Services: [backend/app/services/](backend/app/services/) (route_optimizer, order_lifecycle, driver_location_simulator)
- Models: [backend/app/models/](backend/app/models/) (order.py, driver.py, route.py, restaurant.py)
- Geocoding & helpers: [backend/app/utils/geocoder.py](backend/app/utils/geocoder.py), [backend/app/utils/haversine.py](backend/app/utils/haversine.py)
- Canonical DB schema: [database/supabase/schema.sql](database/supabase/schema.sql)
- Seeder: [database/seed.py](database/seed.py)
- Frontend entry: [frontend/src/App.jsx](frontend/src/App.jsx)
- Frontend services: [frontend/src/services/api.js](frontend/src/services/api.js)
- Backend tests: [tests/backend/](tests/backend/)

Architecture and components
1) Backend (Flask + SQLAlchemy)
- App factory pattern in `backend/app/__init__.py`.
- Database models defined with SQLAlchemy in `backend/app/models/`.
- Routes grouped in `backend/app/routes/` (orders, drivers, auth, analytics, settings).
- Services encapsulate domain logic: `route_optimizer.py` does driver eligibility and assignment; `order_lifecycle.py` handles order state changes.
- Utilities: `geocoder.py` calculates distance/ETA and now computes `delivery_fee`, `platform_fee`, and `driver_fee` (20% platform cut, 80% driver share).

2) Route optimizer
- Purpose: find eligible drivers and assign orders when orders become `ready`.
- Eligibility: drivers with status `available` and `returning` are considered. Drivers `on_delivery` are excluded until they return.
- Selection logic: choose driver minimizing estimated time-to-customer, using driver.current_location and `driver_available_at` (for `returning` drivers we estimate availability first then time-to-pickup); fallback greedy logic uses same heuristic.
- Persistence: selected driver and route assignments are saved to the DB along with timing (`driver_available_at`, `assigned_at`, order route records).

3) Fee model
- Delivery fee is distance-based: base fee + per-km component (calculated in `geocoder` using haversine distance).
- Fee split: platform_cut = 20% of delivery fee, driver_cut = 80% of delivery fee.
- Persisted fields: `Order.platform_fee` and `Order.driver_fee` are now stored on order creation and returned in APIs.

4) Driver lifecycle and display status
- Driver statuses include `available`, `on_delivery`, and `returning`.
- For UI friendliness, `driver.display_status` exposes a human-readable status; a `returning` driver maps to "Coming back from delivery".
- `driver_available_at` timestamp is used to schedule when a `returning` driver becomes `available`.

Running locally (development)
- Recommended environment: Python 3.10+ in virtualenv for backend; NodeJS + npm or pnpm for frontend.
- Backend (from project root):
```powershell
# activate venv (Windows)
venv\Scripts\activate
# run backend (app auto-initializes local DB in dev)
python run.py
```
- Frontend (from `frontend/`):
```bash
cd frontend
npm install
npm run dev
# Vite often serves at http://localhost:3000 (may auto-shift to 3001/3002/3003 if ports occupied)
```
- Testing (backend unit tests):
```powershell
# use backend/venv if provided in repo
backend\venv\Scripts\activate
python -m pytest -q tests/backend
```

Testing and CI
- Tests are pytest-based and live under `tests/backend/`.
- The test setup avoids connecting to production DB by overriding DB connection in the app factory when `TESTING` is True.
- Two new tests validate: fee split and returning-driver selection (`tests/backend/test_fee_and_assignment.py`).

Database and schema
- Canonical schema: `database/supabase/schema.sql` — use this for Postgres / Supabase deployments.
- The legacy duplicate schema `database/schema.sql` was removed to avoid confusion.
- Seed data: `database/seed.py` contains demo drivers and restaurants used for local testing; note that a seeded driver (`DRV002`) had `status: on_delivery`, which caused it to be excluded from assignments — this was the root cause of an early assignment bug.

Recent changes (what was implemented)
- Distance-based delivery fee calculation on order creation (backend).
- Persisting `platform_fee` and `driver_fee` (20% platform cut) on Order model.
- `driver.display_status` now includes "Coming back from delivery" when `status == 'returning'`.
- `route_optimizer` updated to include `returning` drivers in eligibility and to score drivers by estimated time-to-customer (taking `driver_available_at` into account).
- Tests added to assert fee split and returning-driver assignment logic.
- App factory updated to be test-friendly (override DB in tests, bypass certain lifecycle restore operations during testing, tolerate missing JWT in tests).
- Duplicate schema file removed (`database/schema.sql`).

APIs of note
- POST /orders — accepts order creation payloads, performs geocoding distance/ETA, computes fees, persists order with fees and lat/long, and triggers assignment flow if configured.
- GET /drivers — returns list of drivers including `display_status`.
- Routes for auth, affiliation, analytics and settings live in `backend/app/routes/`.

Key implementation notes and rationales
- Why include `returning` drivers: Returning drivers are physically closer sooner than some idle drivers; including them (with correct `driver_available_at` handling) decreases customer wait time and improves utilization.
- Why time-to-customer scoring: Minimizing ETA is a pragmatic heuristic that works well for single-order assignment and small fleets. It avoids the complexity of full VRP for many small shops, and is computationally cheap.
- Why persist platform/driver fee fields: Storing the split at creation time makes accounting and UI displays deterministic (fees don't change later if distance recalculation logic evolves).
- Why canonicalize schema to `database/supabase/schema.sql`: Supabase/Postgres is the intended production target; keeping a single canonical schema avoids drift.

Known issues & caveats
- Some behavior is intentionally simplified (heuristic selection instead of full large-scale VRP solver). For large fleets or multi-stop batching, OR-Tools integration or a dedicated VRP service is recommended.
- Timezone handling: backend normalizes datetime arithmetic; be careful importing naive datetimes. Tests forced fixes to convert naive datetimes to UTC when comparing/subtracting.
- Tests and DB connections: ensure `TEST_DATABASE_URL` is set appropriately for CI to avoid accidental connection attempts to production DB.

Pending / recommended next steps (priority-ordered)
1. Finalize and audit `_persist_routes` to ensure complete persistence of route/order timing and driver status transitions recorded atomically.
2. Frontend updates:
   - Show `platform_fee` and `driver_fee` on order screens.
   - Surface `driver.display_status` everywhere drivers are listed (map pins, lists, assignment UI) with the string "Coming back from delivery" for `returning` drivers.
3. Add integration tests that exercise end-to-end order creation → assignment → driver status update (simulate returning drivers with `driver_available_at`).
4. Add monitoring/telemetry for assignment latency and assignment success/failure rates.
5. If scale increases, evaluate OR-Tools or an external VRP microservice for batching/multi-order routes.

Operational/Deployment notes
- Production DB: use the `database/supabase/schema.sql` DDL and migrations; confirm indexes and FK constraints before import.
- Environment variables: document DB URL, JWT secrets, geocoder API keys (if using external geocoding), and any 3rd-party credentials in a secrets manager.
- Backups & seeds: maintain a sanitized seed file for demo environments (`database/seed.py`).

Contacts & ownership
- Current maintainer(s): (add team contacts here)
- Suggested handoff notes for 2nd dev team: focus first on `_persist_routes` correctness and frontend rendering of new fields; run unit tests and manual flows using the running dev servers.

Appendix — Quick commands
- Start backend:
```powershell
venv\Scripts\activate
python run.py
```
- Start frontend:
```bash
cd frontend
npm install
npm run dev
```
- Run backend tests:
```powershell
backend\venv\Scripts\activate
python -m pytest -q tests/backend
```

Appendix — Useful file references
- App entry: [run.py](run.py)
- Backend init: [backend/app/__init__.py](backend/app/__init__.py)
- Route optimizer: [backend/app/services/route_optimizer.py](backend/app/services/route_optimizer.py)
- Geocoding & fees: [backend/app/utils/geocoder.py](backend/app/utils/geocoder.py)
- Order model: [backend/app/models/order.py](backend/app/models/order.py)
- Driver model: [backend/app/models/driver.py](backend/app/models/driver.py)
- Canonical DB schema: [database/supabase/schema.sql](database/supabase/schema.sql)
- Seeder: [database/seed.py](database/seed.py)
- Tests: [tests/backend/test_fee_and_assignment.py](tests/backend/test_fee_and_assignment.py)

If you want, I can now:
- Open a PR with these docs and the tests attached.
- Implement the frontend changes to display `platform_fee` and `display_status`.
- Finish `_persist_routes` and add integration tests.

---
Generated on: 2026-03-30
