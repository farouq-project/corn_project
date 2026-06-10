# Project Audit — Corn Breed UNPAD 2026

**Date:** 2026-06-10
**Scope:** Full-stack repository at `c:\laragon\www\corn_project` (Laravel 13 API + Next.js 15 frontend + PostgreSQL 16)
**Method:** Static review of routes, models, controllers, services, migrations, frontend pages/components, config and deployment files. No runtime/dynamic testing performed.

---

## 1. Executive Summary

Corn Breed UNPAD 2026 is a fairly mature, domain-rich research management system covering the full corn breeding workflow: master data → multi-environment trials → plot-level phenotyping/disease scoring → seed inventory → field activities → finance → variety release pipeline → audit trail. The data model (49 migrations, ~30+ domain tables) reflects real agronomic research practice (RCBD/blocks/plots, environments as location×season, disease scoring, soil analysis).

**Overall maturity:** Backend domain modeling and API surface are extensive and well-structured. Frontend covers most modules with a consistent Indonesian-language UI. The system is currently mid-deployment (Vercel frontend + Railway/Supabase backend, per recent commit history).

**Top concerns (see details below):**
1. No server-side authorization (RBAC) enforcement — Spatie roles/permissions exist but aren't checked in controllers/routes.
2. `.env` with real-looking local DB credentials and `APP_DEBUG=true` is present in the repo tree (verify `.gitignore` covers it).
3. Auth token stored in `localStorage` (XSS exposure) with no refresh mechanism (flat 7-day Sanctum token).
4. No automated test coverage found for either backend or frontend.
5. Several large "kitchen sink" page components (700-800+ lines) mixing data, forms, and modals — maintainability risk as the system grows.
6. CORS allows broad `*.vercel.app` / `*.railway.app` origin patterns — fine during deployment iteration, but should be tightened to the actual production domains before go-live.

---

## 2. Module Inventory

| # | Module | Backend | Frontend | Status |
|---|--------|---------|----------|--------|
| 1 | Auth & Users | AuthController, UserController, Sanctum + Spatie | `/login`, `/users` | Functional |
| 2 | Master Data (Seasons, Locations, Trial Types) | MasterDataController | `/master-data` | Functional |
| 3 | Genotypes | GenotypeController (CRUD, bulk, Excel import) | `/genotypes` | Functional, feature-rich |
| 4 | Trials | TrialController, TrialPlotController (RCBD engine) | `/trials`, `/trials/[id]` | Functional |
| 5 | Environments (Location×Season) | EnvironmentController + SoilAnalysis | `/environments` | Functional |
| 6 | Plot Observations (new phenotyping) | PlotObservationController | `/phenotype` | Functional |
| 7 | Legacy Phenotyping | PhenotypeController | `/phenotype` (shared) | Parallel/legacy system still wired |
| 8 | Disease Evaluation | DiseaseController | `/disease` | Backend complete; frontend appears placeholder |
| 9 | Seed Inventory & Storage | StorageController | `/storage`, `/storage/import` | Functional, feature-rich (826-line page) |
| 10 | Field Activities | FieldActivityController | `/field-activities` | Functional |
| 11 | Finance (Budgets/Expenses) | ExpenseController | `/finance` | Functional |
| 12 | Variety Release Pipeline | VarietyCandidateController | `/variety-candidates` | Functional |
| 13 | Research Documents | ResearchDocumentController | `/documents` | Functional |
| 14 | Observation Scheduler | ObservationScheduleController | `/schedules` | Functional |
| 15 | Inventory Import Pipeline | InventoryImportController (4-step) | `/storage/import` | Functional |
| 16 | Dashboard & Analytics | DashboardController | `/dashboard` | Functional (KPIs, charts) |
| 17 | Audit Trail | AuditController + AuditService | `/audit` | Functional |

**Two parallel phenotyping systems** exist: the legacy `phenotype_observations`/`phenotype_values` (trial+genotype level) and the newer `plot_observations`/`plot_observation_values` (plot-level, tied to the Environment→Block→Plot hierarchy). Both are routed and modeled. This duplication is worth resolving (see Roadmap).

---

## 3. Backend Architecture (Laravel 13 / PHP 8.3)

- **API surface:** REST, versioned under `/api/v1/`, ~120 endpoints across 19 controllers in `app/Http/Controllers/Api/V1/`.
- **Auth:** Laravel Sanctum, bearer-token mode (not SPA cookie mode). `AuthController::login` issues a token via `createToken(...)->plainTextToken` with a hardcoded `now()->addDays(7)` expiry.
- **Authorization:** `spatie/laravel-permission` is installed, `User` has `HasRoles`, and `/auth/me` returns roles + permissions — but **no route or controller enforces `permission:` / `role:` middleware**. All `auth:sanctum` routes are accessible to any authenticated user regardless of role. The frontend (`authStore.hasRole/hasPermission`) is the only gate, which is trivially bypassable by calling the API directly.
- **Services layer:** `AuditService` (central audit logging), `RcbdService` (experimental design generation), `StorageService`, `InventoryImportService` + `NormalizationService` + `ValidationEngine` (4-step import pipeline), `FileUploadService`, `NotificationService`.
- **Domain modeling depth:** The Location → Season → Environment → Trial → TrialBlock → TrialPlot → PlotObservation hierarchy is a genuinely solid implementation of multi-environment trial (MET) design, including RCBD balance checking and auto-generation.
- **Audit logging:** `audit_logs` is append-only (no `updated_at`), captures old/new values, IP, user agent, URL — good baseline for traceability, but not enforced consistently across every model write path (would need to confirm `AuditService::log*` is called from every controller mutation).
- **Packages:** Laravel 13.8, Sanctum 4.3, Spatie Permission 7.4, Maatwebsite Excel 3.1 (genotype/inventory import), Intervention Image 4, DOMPDF 3.1, league/flysystem-aws-s3-v3 (S3-ready storage).
- **No test suite:** PHPUnit 12 is a dev dependency but no meaningful test files were found during exploration — confirm before relying on `php artisan test` in CI.

---

## 4. Frontend Architecture (Next.js 15 / React 19)

- **Routing:** App Router with `(auth)` and `(dashboard)` route groups; 17 pages total. Dashboard layout enforces auth client-side (no `middleware.ts`).
- **State:** Zustand (`authStore`, persisted to `localStorage` under `corn-auth`) for auth/session; TanStack Query v5 for all server state with sensible defaults (5 min stale time, no refetch-on-focus).
- **API client:** `src/lib/axios.ts` — base URL from `NEXT_PUBLIC_API_URL`, request interceptor attaches `Authorization: Bearer <token>` from localStorage, response interceptor handles 401 by clearing auth and redirecting to `/login`.
- **UI stack:** Tailwind v4, Radix UI primitives, lucide-react icons, Recharts for dashboard charts, react-hook-form + Zod for forms, Sonner for toasts.
- **Localization:** UI text is consistently in Indonesian (Bahasa Indonesia) — appropriate for the target users (UNPAD researchers).
- **Largest files:** `storage/page.tsx` (~826 lines), `phenotype/page.tsx` (~681 lines), `genotypes/page.tsx` (~530 lines), `trials/page.tsx` (~367 lines) — these combine list views, multiple modals, and forms in single files.
- **No automated frontend tests** found (no Jest/Vitest/Playwright config detected).

---

## 5. Database

49 migrations, ~30 domain tables. See `DATABASE_ANALYSIS.md` for the full schema breakdown. Highlights:
- Strong use of composite indexes on hot query paths (trials by season/status, seed inventory by genotype/status, plot observations by trial/environment/genotype, audit logs by auditable type+id).
- Mixed soft-delete usage — most domain tables use `SoftDeletes`, but some (e.g. `PhenotypeVariable`, `ObservationSchedule`, `TrialPlot`) do not. Worth a deliberate retention-policy decision.
- `corn_export.sql` (2.3MB) sits at repo root — likely a full DB dump. Confirm it doesn't contain real researcher PII/credentials before it stays in version control long-term.

---

## 6. Security Findings

| Severity | Finding | Location | Recommendation |
|----------|---------|----------|-----------------|
| High | No server-side RBAC enforcement on API routes | `routes/api.php`, all V1 controllers | Add Spatie `permission:`/`role:` middleware or policy checks per route group (especially approve/delete/finance actions) |
| High | `.env` present with `APP_DEBUG=true` and DB credentials | `backend/.env` | Confirm `.gitignore` excludes `.env`; rotate any credentials that were ever committed; ensure production uses `.env.production` template only |
| Medium | Auth token in `localStorage`, no refresh flow | `frontend/src/lib/axios.ts`, `authStore.ts` | Consider httpOnly cookie + Sanctum SPA mode, or shorter-lived tokens with refresh |
| Medium | CORS allows `*.vercel.app` and `*.railway.app` wildcards | `backend/config/cors.php` | Narrow to the actual production frontend origin once deployment domains are final |
| Medium | No rate limiting on `/auth/login` | `routes/api.php` | Add `throttle:` middleware to auth routes |
| Low | `corn_export.sql` (DB dump) committed to repo | repo root | Verify no sensitive data; consider moving to a private artifact store |
| Low | File uploads (research documents, photos) — no explicit MIME/extension allowlist confirmed | `ResearchDocumentController` and related | Add validation rules (`mimes:`, max size) and store with generated filenames |
| Info | Two parallel phenotyping systems (legacy + plot-based) | models/routes | Plan migration/deprecation of the legacy system to reduce surface area |

---

## 7. Code Quality Observations

- Controllers are reasonably thin and consistently structured per resource.
- Frontend pages mix concerns (data fetching, forms, modals, presentation) in single large files — extracting modals/forms into co-located components would improve readability as features grow.
- Status/color-mapping objects (e.g. `STATUS_STYLES`, `STATUS_LABELS`) are duplicated per page rather than centralized — minor DRY opportunity.
- Inline Zod schemas per page; some `as never` casts used to work around a Zod v4 / `zodResolver` type mismatch (per recent commit `d7a774b`) — a known, already-patched issue, but worth tracking if Zod/react-hook-form versions change again.
- No CI pipeline files (e.g. GitHub Actions) found — build/test/lint currently run manually before deploy (consistent with the recent string of "fix Vercel/Railway build" commits).

---

## 8. Deployment Snapshot (as of latest commits)

- **Frontend:** Vercel (recent commits fixing TypeScript build errors, CORS, env vars, forced rebuilds).
- **Backend:** Railway (Docker-based, `backend/Dockerfile` — PHP 8.3 FPM Alpine + Nginx + Supervisor, builds with `composer install --no-dev`, serves via `php artisan serve`).
- **Database:** Supabase Postgres (pooler host referenced in recent work), separate from the local Docker Compose setup (`postgres:16-alpine` + Redis for local dev).
- **Local dev:** `docker-compose.yml` provides Postgres 16, Redis 7, backend, and frontend containers — a good parity baseline vs. the cloud deployment, though cloud uses Supabase/Railway/Vercel rather than the Compose stack directly.

This is a snapshot for planning purposes — see `SYSTEM_ARCHITECTURE.md` for the full topology and `IMPROVEMENT_ROADMAP.md` for prioritized next steps.
