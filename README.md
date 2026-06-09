# Corn Breed UNPAD 2026
## Integrated Corn Breeding Research Management System

> Sistem Manajemen Penelitian Pemuliaan Jagung Terintegrasi - Universitas Padjadjaran

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Laravel 13 + PHP 8.3 |
| Frontend | Next.js 15 + TypeScript |
| Database | PostgreSQL 16 |
| Auth | Laravel Sanctum + Spatie Permission |
| UI | TailwindCSS + Radix UI primitives |
| State | Zustand + TanStack Query |
| Cache/Queue | Redis |
| Container | Docker + Docker Compose |

---

## Modules

1. **Authentication & Role System** — Login, roles (5 levels), permissions
2. **Master Data** — Seasons, Locations, Storage Units, Trial Types
3. **Genotype Management** — Inbred lines, hybrids, germplasm tracking
4. **Trial Management** — RCBD/CRD/Split-plot, researcher assignment
5. **Storage Monitoring** — Seed inventory, movement logs, QR/barcode, alerts
6. **Phenotyping** — 25+ trait variables, observation approval workflow
7. **Field Activity Log** — Timeline, GPS, photo upload, activity types
8. **Expense Tracker** — Budget monitoring, approval workflow, reporting
9. **Dashboard & Analytics** — Charts, KPIs, storage alerts
10. **Audit Trail** — Complete change history with before/after values
11. **File Management** — Structured uploads, S3-ready

---

## Quick Start (Development)

### Prerequisites
- PHP 8.3+ with PostgreSQL extension
- Composer 2.x
- Node.js 22+
- PostgreSQL 16

### Backend Setup

```bash
cd backend

# Install dependencies
composer install

# Configure environment
cp .env.example .env
# Edit .env — set DB_DATABASE, DB_USERNAME, DB_PASSWORD

# Generate key
php artisan key:generate

# Publish Sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# Publish Spatie Permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"

# Run migrations
php artisan migrate

# Seed database
php artisan db:seed

# Start server
php artisan serve --port=8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit: NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Start development server
npm run dev
```

Open: http://localhost:3000

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@cornbreed-unpad.ac.id | password |
| Peneliti Utama | researcher@cornbreed-unpad.ac.id | password |
| Peneliti Lapang | field@cornbreed-unpad.ac.id | password |
| Petugas Gudang | storage@cornbreed-unpad.ac.id | password |
| Staf Keuangan | finance@cornbreed-unpad.ac.id | password |

---

## Docker Setup

```bash
# At project root
docker-compose up -d

# Run migrations inside container
docker exec cornbreed_backend php artisan migrate --seed
```

---

## API Structure

```
POST   /api/v1/auth/login
GET    /api/v1/auth/me
POST   /api/v1/auth/logout

GET    /api/v1/dashboard

GET    /api/v1/genotypes
POST   /api/v1/genotypes
PUT    /api/v1/genotypes/{id}
DELETE /api/v1/genotypes/{id}

GET    /api/v1/trials
POST   /api/v1/trials
POST   /api/v1/trials/{id}/genotypes
POST   /api/v1/trials/{id}/researchers

GET    /api/v1/storage/dashboard
GET    /api/v1/storage/inventory
POST   /api/v1/storage/inventory
POST   /api/v1/storage/inventory/{id}/movements
GET    /api/v1/storage/units
POST   /api/v1/storage/units/{id}/readings

GET    /api/v1/phenotype/observations
POST   /api/v1/phenotype/observations
POST   /api/v1/phenotype/observations/{id}/approve
GET    /api/v1/phenotype/variables

GET    /api/v1/field-activities
POST   /api/v1/field-activities

GET    /api/v1/finance/expenses
POST   /api/v1/finance/expenses
POST   /api/v1/finance/expenses/{id}/approve
GET    /api/v1/finance/budgets

GET    /api/v1/users
POST   /api/v1/users

GET    /api/v1/audit
```

---

## Database Schema

### Core Tables
- `users` + roles/permissions (Spatie)
- `seasons`, `locations`, `trial_types`
- `genotypes`
- `storage_units`, `seed_inventories`, `seed_movements`, `storage_readings`
- `trials`, `trial_genotypes`, `trial_researchers`
- `phenotype_variables`, `phenotype_observations`, `phenotype_values`
- `field_activities`
- `expense_categories`, `budgets`, `expenses`
- `audit_logs`, `system_notifications`
- `file_attachments`, `import_jobs`

---

## Future Roadmap

- [ ] Drone integration module
- [ ] GIS mapping with Leaflet/Mapbox
- [ ] NASA POWER API for weather data
- [ ] BLUP/BLUEs statistical analysis
- [ ] IoT sensor integration for storage monitoring
- [ ] PWA support (offline field data entry)
- [ ] WhatsApp notification integration
- [ ] AI-powered genotype performance recommendations
- [ ] Barcode/QR scanner (mobile camera)
- [ ] Multi-institution collaboration features
