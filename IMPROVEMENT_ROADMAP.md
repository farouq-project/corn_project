# Improvement Roadmap — Corn Breed UNPAD 2026

Prioritized follow-ups derived from `PROJECT_AUDIT.md`, `SYSTEM_ARCHITECTURE.md`, and `DATABASE_ANALYSIS.md`. Grouped by urgency, not by sprint — pick based on team capacity.

---

## P0 — Before/At Production Go-Live

### 1. Enforce server-side RBAC
**Problem:** Spatie roles/permissions exist and are returned to the frontend, but no controller or route checks them. Any authenticated user (e.g. `field_researcher`) can call `POST /finance/expenses/{id}/approve` or `DELETE /users/{id}` directly via the API.
**Action:**
- Define a permission matrix per role (super_admin, principal_researcher, field_researcher, storage_officer, finance_staff — per README's 5 demo roles).
- Apply `->middleware('permission:approve-expenses')` etc. to sensitive routes (approvals, deletes, user management, finance).
- Seed the permission matrix in a dedicated seeder so it's documented in code, not tribal knowledge.

### 2. Confirm `.env` hygiene
**Problem:** `backend/.env` exists in the working tree with `APP_DEBUG=true` and DB credentials.
**Action:**
- Verify `.env` is in `.gitignore` and was never committed (`git log --all --full-history -- backend/.env`).
- If it was ever committed, rotate the Postgres password and any other secrets, even if they're "just local dev" values.
- Confirm production (Railway) sets `APP_DEBUG=false`, `LOG_LEVEL=error` via environment variables, not a committed `.env.production` with real values.

### 3. Tighten CORS before final domain is set
**Problem:** `config/cors.php` allows any `*.vercel.app` and `*.railway.app` subdomain.
**Action:** Once the production frontend domain is finalized, replace the wildcard patterns with the exact origin(s) and keep `FRONTEND_URL` as the single source of truth.

### 4. Add login rate limiting
**Action:** Add `throttle:5,1` (or similar) to `POST /api/v1/auth/login` to mitigate credential stuffing/brute force.

---

## P1 — High Value, Near-Term

### 5. Consolidate the two phenotyping systems
**Problem:** `phenotype_observations`/`phenotype_values` (legacy, trial+genotype+replication) and `plot_observations`/`plot_observation_values` (new, plot-based) both exist, both routed, both rendered on `/phenotype`. This doubles the surface area for bugs and confuses new contributors.
**Action:**
- Audit which trials/data actually use the legacy tables vs. the new plot-based ones.
- Write a migration to backfill legacy observations into `plot_observations` where a corresponding `trial_plot` can be inferred (via trial_id + genotype_id + replication → block/plot mapping).
- Mark legacy endpoints as deprecated, then remove once frontend fully migrates to plot-based observations.

### 6. Add automated tests
**Problem:** No test coverage found on either side — RBAC and phenotyping consolidation work above is risky without regression protection.
**Action:**
- Backend: PHPUnit feature tests for auth, the RBAC middleware once added, and the import pipeline (highest-risk area for data corruption).
- Frontend: at minimum, component tests for `DataTable`, `authStore`, and the axios interceptor (401 handling); consider Playwright for the login → dashboard → CRUD happy path.

### 7. Refactor large frontend pages
**Problem:** `storage/page.tsx` (~826 lines), `phenotype/page.tsx` (~681 lines), `genotypes/page.tsx` (~530 lines) mix list views, multiple modals, and inline Zod schemas.
**Action:** Extract each modal/form into its own component under e.g. `src/app/(dashboard)/storage/components/`, and move shared Zod schemas to `src/schemas/`. Do this incrementally, page by page, not as a big-bang refactor.

### 8. Centralize status/label/color maps
**Problem:** `STATUS_STYLES`/`STATUS_LABELS`-style objects are duplicated across `dashboard`, `trials`, `phenotype`, `audit`, `variety-candidates` pages.
**Action:** Create `src/lib/status-maps.ts` (or per-domain files) with shared enums/labels/colors; import everywhere instead of redefining.

### 9. Auth token lifecycle
**Problem:** Flat 7-day Sanctum token, stored in `localStorage`, no refresh.
**Action (incremental):**
- Short term: shorten token life and add a "session expiring soon" toast that prompts re-login.
- Medium term: evaluate Sanctum SPA (cookie) mode for the Vercel↔Railway pairing (requires shared-domain or `SANCTUM_STATEFUL_DOMAINS` + same-site cookie config across origins — needs design work since frontend/backend are on different domains).

---

## P2 — Quality of Life / Scaling

### 10. Finish or stub out incomplete modules
**Problem:** `/disease` page appears to be placeholder-level despite a complete backend (`DiseaseController`, `disease_evaluations`, `disease_scores`).
**Action:** Either build out the disease evaluation UI (entry form mirroring `plot_observations`, resistance summary view) or clearly mark it "Coming Soon" in the sidebar so users don't think it's broken.

### 11. File upload validation
**Action:** Add explicit `mimes:`/`max:` validation rules on `ResearchDocumentController` and any photo/voice-note upload endpoints (field activities, plot observations, disease evaluations); store with generated (non-user-controlled) filenames.

### 12. Debounce search inputs
**Action:** `DataTable`'s global filter currently updates on every keystroke — add a ~300ms debounce, especially relevant once seed inventory / audit logs grow large.

### 13. Error boundaries & 404 handling
**Action:** Add `error.tsx` and `not-found.tsx` to the `(dashboard)` route group; have `/trials/[id]` check for a 404 from the API and render a not-found state instead of an empty page.

### 14. JSONB + indexing for queryable JSON fields
**Action:** If/when filtering by `tags`, `materials_used`, or `disease_resistance_summary` becomes a real feature requirement, migrate those columns to `jsonb` (if not already) and add GIN indexes.

### 15. Soft-delete consistency pass
**Action:** Decide a data-retention policy and apply `SoftDeletes` consistently — currently `TrialPlot`, `PhenotypeVariable`, `ObservationSchedule` lack it while most sibling models have it. Particularly relevant given `trials` cascade-deletes `trial_plots` (hard delete) which could orphan or remove history referenced by soft-deleted `plot_observations`.

### 16. CI pipeline
**Action:** Add a GitHub Actions workflow running `composer install`, `php artisan test`, frontend `npm run lint` + `npm run build` on PRs — would have caught the recent string of "fix Vercel build" / "fix TypeScript errors" commits before merge.

---

## P3 — Future Features (from README roadmap, for context)

These are already tracked in `README.md` and not re-litigated here, but worth sequencing against the items above (e.g., do RBAC and phenotyping consolidation *before* adding IoT/drone integrations that will create more data flowing through the same unprotected/duplicated paths):

- Drone integration, GIS mapping (Leaflet/Mapbox), NASA POWER weather API integration (note: `environments.api_metadata` + `weather_records` table groundwork already exists)
- BLUP/BLUEs statistical analysis (the plot-based MET schema is well-suited for this — a strong reason to prioritize #5 first)
- IoT sensor integration for storage monitoring (`storage_readings.source = 'sensor'` already modeled)
- PWA / offline field data entry, WhatsApp notifications, mobile QR/barcode scanning, multi-institution collaboration

---

## Suggested Sequencing

1. **Week 1:** P0 items (RBAC matrix + middleware, env hygiene check, CORS tightening, login throttling) — these are security-critical and relatively contained.
2. **Weeks 2-4:** P1 #6 (basic test scaffolding) before #5 (phenotyping consolidation) so the consolidation has a safety net; #9 token lifecycle in parallel (frontend-only changes).
3. **Ongoing:** P1 #7/#8 (frontend refactors) and P2 items as time allows, prioritizing #10 (disease module) and #16 (CI) since they have outsized payoff for current effort.
