# System Architecture — Corn Breed UNPAD 2026

## 1. High-Level Topology

```
                          ┌─────────────────────────────┐
                          │        Browser (User)        │
                          │  Researchers / Admin Staff   │
                          └───────────────┬───────────────┘
                                           │ HTTPS
                                           ▼
                          ┌─────────────────────────────┐
                          │   Frontend — Next.js 15       │
                          │   (React 19, App Router)      │
                          │   Hosted on Vercel             │
                          │                                │
                          │  - (auth) route group          │
                          │  - (dashboard) route group     │
                          │  - Zustand (auth/session)      │
                          │  - TanStack Query (server data)│
                          └───────────────┬───────────────┘
                                           │ REST/JSON over HTTPS
                                           │ Authorization: Bearer <token>
                                           ▼
                          ┌─────────────────────────────┐
                          │   Backend — Laravel 13 API     │
                          │   (PHP 8.3-FPM, Nginx,         │
                          │    Supervisor in Docker)       │
                          │   Hosted on Railway             │
                          │                                │
                          │  - routes/api.php (/api/v1/*)  │
                          │  - Sanctum (bearer tokens)      │
                          │  - Spatie Permission (roles)    │
                          │  - 19 V1 Controllers            │
                          │  - Service layer (Audit, RCBD,  │
                          │    Storage, Import, Notify)     │
                          └───────────────┬───────────────┘
                                           │ pgsql (pooler)
                                           ▼
                          ┌─────────────────────────────┐
                          │   PostgreSQL 16 — Supabase     │
                          │   (aws-1-ap-southeast-1         │
                          │    pooler.supabase.com:5432)    │
                          │   ~30 domain tables              │
                          └─────────────────────────────┘

   Local Development (docker-compose.yml):
   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
   │  postgres  │  │   redis    │  │  backend   │  │ frontend  │
   │ (16-alpine)│  │ (7-alpine) │  │ (Dockerfile)│  │(Dockerfile)│
   │   :5432    │  │   :6379    │  │   :8000    │  │   :3000   │
   └───────────┘  └───────────┘  └───────────┘  └───────────┘
   Cache/Queue driver = redis locally; database driver in some envs.
```

---

## 2. Backend Layered Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Routes (routes/api.php)                                    │
│   /api/v1/* — grouped by domain, auth:sanctum protected     │
└───────────────────────┬──────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Controllers (app/Http/Controllers/Api/V1/*)                │
│   AuthController, UserController, GenotypeController,      │
│   TrialController, TrialPlotController,                    │
│   PlotObservationController, PhenotypeController,          │
│   DiseaseController, EnvironmentController,                │
│   StorageController, FieldActivityController,              │
│   ExpenseController, VarietyCandidateController,           │
│   ResearchDocumentController, ObservationScheduleController,│
│   InventoryImportController, MasterDataController,         │
│   DashboardController, AuditController                     │
└───────────────────────┬──────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Services (app/Services/*)                                   │
│   AuditService          — central change logging            │
│   RcbdService            — RCBD layout generation/validation │
│   StorageService         — inventory/storage logic           │
│   InventoryImportService │
│   NormalizationService   ├─ 4-step import pipeline           │
│   ValidationEngine       │  (upload → validate → preview →   │
│                           │   confirm/rollback)               │
│   FileUploadService      — file storage abstraction          │
│   NotificationService    — system notifications              │
└───────────────────────┬──────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Eloquent Models (app/Models/*) — ~30 models                 │
│   SoftDeletes on most domain models; HasRoles on User;       │
│   computed attributes (total_expense, occupancy_rate, etc.)  │
└───────────────────────┬──────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────┐
│ PostgreSQL 16 (49 migrations)                                │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Core Domain Hierarchy (Trial Design)

This is the central scientific data model and the most architecturally significant part of the system:

```
Location ──┐
           ├──► Environment (location_id + season_id, unique pair)
Season ────┘         │
                      ├──► TrialEnvironment (links Trial ↔ Environment, local code/coordinator)
                      │
Trial ────────────────┘
  │
  ├──► TrialBlock (replication within trial × environment)
  │       │
  │       └──► TrialPlot (1 genotype × 1 block × 1 environment)
  │               │
  │               ├──► PlotObservation ──► PlotObservationValue (per phenotype variable)
  │               └──► DiseaseScore (per DiseaseEvaluation)
  │
  ├──► TrialGenotype (pivot: entry_number, treatment_label, is_check)
  └──► TrialResearcher (pivot: role)
```

Supporting domain modules hang off this core: SeedInventory/StorageUnit (genetics ↔ physical seed stock), Expense/Budget (financed against Season/Trial), FieldActivity (logged per user/trial/location/genotype), VarietyCandidate (release pipeline referencing a Genotype + aggregated trial performance), ResearchDocument (polymorphic-ish document store per trial/environment/season), ObservationSchedule (planning/reminders per trial/environment).

A **legacy parallel path** also exists: `PhenotypeObservation`/`PhenotypeValue` operate at Trial+Genotype+Replication granularity (pre-dating the Environment/Block/Plot model). Both are live in routes and the frontend `/phenotype` page.

---

## 4. Authentication & Authorization Flow

```
1. POST /api/v1/auth/login {email, password}
2. AuthController validates credentials + user.status === 'active'
3. Sanctum: $user->createToken('name', expiresAt: now()->addDays(7))
4. Response: { token: "id|plaintext", user: {..., roles: [...], permissions: [...]} }
5. Frontend: authStore.setAuth(user, token)
     - Zustand persists { user, token, isAuthenticated } to localStorage["corn-auth"]
     - axios request interceptor reads token → Authorization: Bearer <token>
6. Every subsequent request → Sanctum middleware (auth:sanctum) validates
   token against personal_access_tokens table → $request->user()
7. authStore.hasRole()/hasPermission() gate UI elements client-side only
   (NOT enforced again on the backend per-route)
8. 401 response → axios response interceptor clears auth, redirects to /login
```

**Gap:** Step 7's role/permission gating exists only in the frontend. The backend has the data (`spatie/laravel-permission` tables: roles, permissions, model_has_roles, model_has_permissions, role_has_permissions) but no controller/route applies `->middleware('permission:...')` or policy `authorize()` calls. See `PROJECT_AUDIT.md` §6 and `IMPROVEMENT_ROADMAP.md`.

---

## 5. Frontend Architecture

```
src/app/
├── layout.tsx                  — Root layout: QueryProvider, Toaster (Sonner)
├── (auth)/login/page.tsx       — Login form (Zod + react-hook-form)
└── (dashboard)/
    ├── layout.tsx              — Sidebar + TopBar, client-side auth guard
    ├── dashboard/               — KPIs, charts (Recharts), alerts
    ├── genotypes/               — CRUD + bulk/Excel import
    ├── trials/  trials/[id]/    — Trial CRUD + detail
    ├── phenotype/               — Plot observations + variables (legacy + new)
    ├── disease/                 — Disease evaluation (placeholder-level)
    ├── schedules/               — Observation scheduler/calendar
    ├── field-activities/        — Field activity timeline
    ├── storage/  storage/import/— Seed inventory, units, import pipeline
    ├── finance/                 — Budgets & expenses
    ├── documents/               — Research documents
    ├── environments/            — Environment/soil data
    ├── master-data/             — Seasons, locations, trial types, variables
    ├── variety-candidates/      — Release pipeline tracker
    ├── users/                   — User management
    └── audit/                   — Audit trail viewer

src/components/
├── layout/Sidebar.tsx, TopBar.tsx
├── shared/DataTable.tsx, StatusBadge.tsx, PageHeader.tsx
└── providers/QueryProvider.tsx

src/lib/axios.ts   — API client (interceptors for auth + error normalization)
src/store/authStore.ts — Zustand auth/session store (persisted)
src/types/index.ts — Shared TypeScript domain types (mirrors backend models)
```

**Data flow for a typical page:**
```
Page component
  → useQuery(["resource"], () => api.get("/v1/resource"))
  → axios (attaches Bearer token)
  → Laravel controller → Eloquent → PostgreSQL
  → JSON response → TanStack Query cache
  → render (DataTable / cards) + mutations (useMutation) with cache invalidation
```

---

## 6. Deployment Architecture

| Component | Local Dev | Production |
|-----------|-----------|-------------|
| Frontend | `npm run dev` (port 3000) or Docker `frontend` service | Vercel (Next.js) |
| Backend | `php artisan serve` (port 8000) or Docker `backend` service (Nginx+PHP-FPM+Supervisor) | Railway (Docker image from `backend/Dockerfile`) |
| Database | Docker `postgres:16-alpine` (port 5432) | Supabase PostgreSQL (pooler endpoint, `aws-1-ap-southeast-1.pooler.supabase.com:5432`) |
| Cache/Queue | Redis (Docker) or `database` driver | Likely `database` driver on Railway (confirm Redis add-on if needed) |
| File Storage | Local disk (`storage/app`) | S3-compatible (league/flysystem-aws-s3-v3 installed, "S3-ready") |
| CORS | `localhost:3000` | `FRONTEND_URL` + `*.vercel.app` / `*.railway.app` patterns |

**Recent deployment-hardening commits** (most recent first): config cache rebuilt with correct DB driver at build time, forced Vercel rebuild for env var changes, CORS opened for `*.vercel.app`/`*.railway.app`, TypeScript build errors fixed for Vercel, Zod v4 resolver type fixes — indicates the project is in active "first production deploy" stabilization.

---

## 7. Notable Architectural Strengths

- Realistic, normalized representation of multi-environment trial (MET) design — Location × Season → Environment → Block → Plot is the right shape for a breeding program and supports future statistical analysis (BLUEs/BLUPs per the README roadmap).
- Centralized audit logging service with a dedicated, indexed `audit_logs` table.
- Structured 4-step import pipeline (upload → validate/normalize → preview → confirm/rollback) for bulk seed inventory and genotype data — reduces risk of bad bulk imports.
- Clear versioned API namespace (`/api/v1`) leaves room for future versioning.
- S3-ready file storage abstraction already wired via Flysystem.

## 8. Notable Architectural Risks

- RBAC defined but not enforced server-side (cross-cutting risk across all 19 controllers).
- Two parallel phenotyping data models increase long-term maintenance cost and risk of divergent business logic.
- No automated tests (backend or frontend) — refactors (e.g., consolidating phenotyping systems, adding RBAC middleware) carry regression risk without a safety net.
- Token-in-localStorage auth model is simple but has known XSS exposure; acceptable for an internal research tool but worth revisiting if the user base grows or sensitive data increases.
