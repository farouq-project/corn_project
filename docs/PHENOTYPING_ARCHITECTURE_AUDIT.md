# Phenotyping Module — Complete Architecture Audit

**Date:** 2026-07-20  
**Status:** Audit only. No code changes.

---

## 1. Three Generations of Observation Systems

The database contains **three overlapping phenotyping generations**. All three exist simultaneously. Only Generation 3 is used by the current frontend.

| Generation | Tables | Controller | Frontend | Status |
|---|---|---|---|---|
| Gen 1 (Jan 2026) | `phenotype_variables`, `phenotype_observations`, `phenotype_values` | `PhenotypeController` | None active | **Abandoned** |
| Gen 2 (Feb 2026) | `trial_plots`, `trial_blocks`, `plot_observations`, `plot_observation_values` | `PlotObservationController`, `TrialPlotController` | None active | **Stranded** |
| Gen 3 (Jun 2026) | `characteristics`, `observation_records`, `observation_values` | `ObservationRecordController` | `data-pengamatan`, `data-rata-rata`, `import` | **Active** |

---

## 2. Data Model — Generation 3 (Active)

### Table: `characteristics`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `code` | varchar(20) UNIQUE | e.g. "TT", "DT50" |
| `name` | varchar | Display name |
| `unit` | varchar nullable | e.g. "cm", "hari" |
| `group` | varchar nullable | Grouping for display |
| `method_description` | text nullable | |
| `display_order` | int default 0 | Sort order in spreadsheet |
| `decimal_places` | int default 2 | Rounding for display + save |
| `is_active` | boolean default true | Only active shown in grid |

**Purpose:** Master list of observable traits. Each column in the spreadsheet corresponds to one `Characteristic`.  
**Used by:** `data-pengamatan` (grid columns), `import` (template headers), `data-rata-rata` (column headers).

---

### Table: `observation_records`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `record_code` | varchar | Auto-generated "OBS-XXXXXXXXXX" |
| `plot_no` | varchar(20) | **Free text. Not an FK. No standard format.** |
| `genotype_id` | bigint FK → `genotypes` | |
| `environment_id` | bigint FK → `environments` NULLABLE | **Null for imported records** |
| `environment_condition_id` | bigint FK → `environment_conditions` NULLABLE | Used by import only |
| `season_id` | bigint FK → `seasons` NULLABLE | Auto-resolved from environment |
| `replication` | int | 1-based |
| `recorded_by` | bigint FK → `users` | |
| `notes` | text nullable | |
| `deleted_at` | timestamp nullable | SoftDeletes |

**Unique constraint:** `(environment_id, season_id, plot_no, replication)`  
**Critical gap: NO `trial_id`.**  
**Used by:** Grid (`/v1/phenotyping/grid`), CRUD (`/v1/phenotyping/records`), aggregate.

---

### Table: `observation_values`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `observation_record_id` | bigint FK → `observation_records` | |
| `characteristic_id` | bigint FK → `characteristics` | |
| `sample_number` | tinyint default 1 | For multi-sample measurements |
| `value` | decimal(12,4) | |

**Unique constraint:** `(observation_record_id, characteristic_id, sample_number)`  
**Purpose:** EAV store — one row per (record × characteristic × sample).

---

### Table: `trial_genotypes`

| Column | Type | Notes |
|---|---|---|
| `trial_id` | bigint FK → `trials` | |
| `genotype_id` | bigint FK → `genotypes` | |
| `entry_number` | int nullable | Plot ordering |
| `treatment_label` | varchar nullable | |
| `is_check` | boolean | Check variety flag |

**Unique constraint:** `(trial_id, genotype_id)`  
**Purpose:** Many-to-many: which genotypes participate in which trial, in what order.  
**Used by:** `grid()` to generate virtual plot rows.

---

### Table: `trial_environments`

| Column | Type | Notes |
|---|---|---|
| `trial_id` | bigint FK → `trials` | |
| `environment_id` | bigint FK → `environments` | |
| `local_trial_code` | varchar nullable | |
| `status` | enum | planned/active/harvested/completed/failed/cancelled |
| `local_coordinator_id` | bigint FK → `users` nullable | |

**Unique constraint:** `(trial_id, environment_id)`  
**Purpose:** Many-to-many: which environments (physical locations) a trial is conducted in.  
**Used by:** `grid()` to determine which environments to generate rows for.

---

### Table: `trials`

| Column | Type | Relevant to phenotyping |
|---|---|---|
| `id` | bigint PK | |
| `trial_name` | varchar | Displayed in filter |
| `replications` | int | **Used by grid() to know how many R rows to generate** |
| `num_genotypes` | int nullable | Denormalized count |
| `status` | enum | |

**Relationships used:**  
- `Trial` → `Genotype[]` via `trial_genotypes` (ordered by `entry_number`)  
- `Trial` → `Environment[]` via `trial_environments`

---

## 3. Current Observation Flow — Manual Entry ("Tambah Baris")

```
User opens "Tambah Baris" wizard
  │
  ├─ Step 1: Input plot_no, genotype_id, environment_id, replication (+ optional trial)
  │
  ├─ Step 2: Select which Characteristics to observe (from active characteristics list)
  │
  ├─ Step 3: Enter values per characteristic (with optional multi-sample via "+ Sampel")
  │
  └─ Submit → POST /v1/phenotyping/records
       │
       ├─ Validate: plot_no required, genotype_id exists, environment_id exists, replication int
       │
       ├─ Check for soft-deleted duplicate: WHERE environment_id + season_id + plot_no + replication
       │   └─ If found (trashed): restore it, update fields
       │   └─ If found (active): return 422 "plot sudah ada"
       │   └─ If not found: INSERT observation_records
       │
       ├─ For each value: ObservationValue::updateOrCreate(
       │     [record_id, characteristic_id, sample_number], [value]
       │   )
       │
       └─ AuditService::logCreated($record)
```

**Key observation:** The `plot_no` is **typed by the user** with no validation against any master list. Nothing enforces that it matches a genotype's entry_number or any pre-defined plot layout.

---

## 4. Current Spreadsheet Data Source

### What the grid currently does:

```
Frontend: trialFilter selected
  │
  └─ GET /v1/phenotyping/grid?trial_id=X[&environment_id=Y]
       │
       ├─ Load Trial with:
       │   ├─ genotypes ordered by entry_number  (from trial_genotypes)
       │   └─ environments                        (from trial_environments)
       │
       ├─ Filter environments if environment_id param provided
       │
       ├─ Load all ObservationRecord WHERE:
       │   genotype_id IN [trial genotype ids]
       │   AND environment_id IN [trial environment ids]
       │
       ├─ Build index: key = "{genotype_id}:{environment_id}:{replication}"
       │
       └─ Generate rows: for each genotype × environment × replication (1..R):
            key = "{geno_id}:{env_id}:{rep}"
            record = index[key] OR null
            yield {
              entry_number, plot_no (from record or entry_number),
              genotype, environment, replication,
              record_id: record?.id ?? null,
              values: record?.values ?? {}
            }
```

**Frontend (data-pengamatan/page.tsx):**

```tsx
// Query only fires when trialFilter is set
const { data: gridData } = useQuery({
  queryKey: ["obs-grid", trialFilter, environmentFilter],
  queryFn: () => phenotypingService.getGrid({ trial_id: trialFilter, ... }),
  enabled: !!trialFilter,
  staleTime: 30_000,
});
```

**If no trial is selected:** Grid shows "Pilih Research Plan" empty state.  
**If trial has no genotypes assigned:** Grid returns 0 rows.  
**If trial has no environments linked:** Grid returns 0 rows.

---

## 5. Import System

```
Upload xlsx
  │
  └─ POST /v1/phenotyping/import/upload
       │
       ├─ PhenotypingImportService::uploadAndParse()
       │   ├─ PhpSpreadsheet reads file
       │   ├─ Chunked INSERT into observation_import_staging (500 rows/chunk)
       │   └─ status = 'parsed'
       │
       └─ Status: parsed

POST /v1/phenotyping/import/batches/{id}/validate
  │
  └─ PhenotypingImportService::normalizeAndValidate()
       ├─ Key-alias normalization (handles Indonesian aliases, asterisk markers, unit suffixes)
       │   "TT (cm)" → looks for characteristic with code "TT"
       │   empty cells → stored as 0.0 (NOT null)
       ├─ Maps "Environment" column → environment_conditions table (NOT environments!)
       └─ status = 'validated'

POST /v1/phenotyping/import/batches/{id}/confirm
  │
  └─ PhenotypingImportService::confirmImport()
       ├─ DB::transaction
       ├─ For each valid staging row:
       │   ├─ Find or create ObservationRecord WHERE:
       │   │   environment_condition_id = resolved_env_condition_id
       │   │   plot_no = row['No Plot']
       │   │   replication = row['R']
       │   │   genotype_id = resolved from 'Kode Gen'
       │   │   environment_id = NULL  ← ⚠ CRITICAL: always null for imports
       │   └─ Upsert ObservationValue for each characteristic column
       └─ status = 'completed'
```

**Critical import problem:** Imported records have `environment_id = NULL`. The `grid()` endpoint matches records by `environment_id IN [trial env ids]`. Therefore, **imported records will never appear in the grid**.

---

## 6. Generation 2 System (Stranded — `trial_plots`)

The Gen 2 system exists in the database and has a complete controller (`TrialPlotController`, `PlotObservationController`) but **no active frontend page**. It represents a more rigorous approach:

```
Trial → TrialEnvironment → TrialBlock → TrialPlot
                                             │
                                       PlotObservation
                                             │
                                      PlotObservationValue
                                      (references phenotype_variables, not characteristics)
```

`TrialPlot` contains the authoritative plot layout:
- `plot_code` (unique, e.g. "T1-E1-B1-001")
- `trial_id`, `environment_id`, `genotype_id`, `entry_number`
- `plot_number` — physical sequential number in the field
- `randomization_order` — RCBD randomization position
- `status` — active/damaged/missing/excluded

The `generateRcbd()` endpoint in `TrialPlotController` can populate `trial_plots` from a trial's assigned genotypes.

**This system is completely disconnected from Gen 3 (`observation_records`).** There is no FK linking `TrialPlot` to `ObservationRecord`.

---

## 7. Characteristic Column Generation

```
Frontend: ObservationGrid mount
  │
  └─ GET /v1/phenotyping/characteristics?active_only=true
       │
       └─ Returns Characteristic[] ordered by (display_order ASC, name ASC)

ObservationGrid maps characteristics → ColumnDef[]
  │
  ├─ Each column: id = characteristic.code, header = code + unit
  ├─ Data accessor: (row) => row.values[c.code] ?? null
  └─ Column chooser: visibility toggled per code, persisted to localStorage
       key: "obs-grid-col-visibility-v3"
```

---

## 8. Role Access

| Role | Read Grid | Edit Cells | Add Row | Delete Row |
|---|---|---|---|---|
| `super_admin` | ✓ | ✓ | ✓ | ✓ |
| `researcher` | ✓ | ✓ | ✓ | ✓ |
| `principal_researcher` | ✓ | ✓ | ✓ | ✓ |
| `field_team` | ✓ | ✓ | ✓ | ✓ |
| `colaborator` | ✓ | ✗ | ✗ | ✗ |

Guard: `canEdit = !user?.roles?.includes("colaborator")`

---

## 9. AuditLog

Every `store`, `update`, `destroy` on `ObservationRecord` logs to `audit_logs` via `AuditService`. History is viewable per-record via `GET /v1/phenotyping/records/{id}/history`.
