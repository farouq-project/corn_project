# Spreadsheet Gap Analysis — Current vs Target

**Date:** 2026-07-20  
**Status:** Audit only. No code changes.

---

## Summary

The grid endpoint (`GET /v1/phenotyping/grid`) was implemented in Batch 5 and is the correct direction. However, **it will return an empty or incorrect grid for most real trials** due to the gaps listed below. The architecture is partially in place but the data that feeds it is missing or mismatched.

---

## Gap Table

| # | Dimension | Current | Target | Gap |
|---|---|---|---|---|
| 1 | Row source | `ObservationRecord` rows (existing only) | Generated matrix: Trial × Environments × Replications | **Partially fixed** — `grid()` endpoint now generates virtual rows, but only works when trial has genotypes + environments assigned |
| 2 | Plot number | Free text typed by user in "Tambah Baris" | Authoritative plot number from trial layout | `observation_records.plot_no` is uncontrolled; no master plot list |
| 3 | Trial linkage | `observation_records` has no `trial_id` | Each record knows which trial it belongs to | **Root cause of most failures** — records matched to grid by heuristic (genotype+env+rep), not by FK |
| 4 | Empty row creation | User must click "Tambah Baris" | First cell edit auto-creates record | **Partially fixed** — `handleCellChange` in page does auto-create, but only after trial selected and grid query succeeds |
| 5 | Import → grid | Imported records have `environment_id = NULL` | Imported records appear in grid | **Broken** — import never sets `environment_id`; grid filters by `environment_id IN [trial env ids]`; imported rows invisible |
| 6 | Trial has no genotypes | Grid returns 0 rows | All plots visible even if no records exist | **Gap** — trial must have genotypes in `trial_genotypes` or grid is empty |
| 7 | Trial has no environments | Grid returns 0 rows | All plots visible (at least one environment) | **Gap** — trial must be linked in `trial_environments` |
| 8 | Duplicate record risk | Two records with same `(genotype, env, rep)` but different `plot_no` can exist | One record per grid cell | Grid lookup by `genotype:env:rep` picks arbitrarily if duplicates exist |
| 9 | Import environment | Import maps "Environment" column → `environment_conditions` (treatment type) | Import maps → `environments` (physical location) | **Semantic mismatch** — causes `environment_id = NULL` on imported records |
| 10 | "Tambah Baris" after grid | Wizard creates record but grid may already show empty row for that slot | Wizard unnecessary for in-plan plots | Wizard still needed for out-of-plan exceptional entries |
| 11 | Data Rata-Rata | Aggregation query matches records by `genotype_id + environment_id` (no trial filter) | Per-trial aggregation | Missing trial context on records means aggregate can mix records from different trials |
| 12 | Column chooser persistence | Column visibility stored in `localStorage` with key `obs-grid-col-visibility-v3` | Per-trial column preferences | All trials share the same column preference — not per-trial |

---

## Current Architecture (Actual State)

```
┌─────────────────────────────────────────────────────┐
│               DATA PENGAMATAN PAGE                  │
│                                                     │
│  trialFilter (required) ──► GET /v1/phenotyping/grid │
│                                                     │
│  Grid source:                                       │
│    Trial.genotypes × Trial.environments × R         │
│    ⚠ Only works if BOTH are populated               │
│                                                     │
│  Cell edit:                                         │
│    row.record_id = null → POST /records (auto-create)│
│    row.record_id = N    → PATCH /records/N          │
│                                                     │
│  Match logic (FRAGILE):                             │
│    observation_records WHERE                        │
│      genotype_id IN [trial genotype ids]            │
│      AND environment_id IN [trial env ids]          │
│    Key: "{genotype_id}:{env_id}:{replication}"      │
│    ⚠ No trial_id — records from OTHER trials match  │
└─────────────────────────────────────────────────────┘
```

### Problems with the current match logic

1. Trial A (Drought) has Genotype G1 in Environment E1, Replication 1 → creates record #100  
   Trial B (Normal) has Genotype G1 in Environment E1, Replication 1 → grid query for Trial B matches record #100 from Trial A  
   **Result: Trial B shows Trial A's data**

2. If a researcher typed `plot_no = "A1"` via Tambah Baris, but the grid auto-creates with `plot_no = "1"` (from entry_number), then there are two records for the same slot — the grid shows one arbitrarily.

---

## Target Architecture

```
┌─────────────────────────────────────────────────────┐
│               DATA PENGAMATAN PAGE                  │
│                                                     │
│  trialFilter (required) ──► GET /v1/phenotyping/grid │
│                                                     │
│  Grid source:                                       │
│    Trial.genotypes × Trial.environments × R         │
│                                                     │
│  Cell edit:                                         │
│    row.record_id = null → POST /records (auto-create)│
│      with trial_id = trialFilter  ←── NEW           │
│    row.record_id = N → PATCH /records/N             │
│                                                     │
│  Match logic (RELIABLE):                            │
│    observation_records WHERE                        │
│      trial_id = X          ←── NEW (FK, not heuristic)
│      genotype_id = G                               │
│      environment_id = E                             │
│      replication = R                                │
└─────────────────────────────────────────────────────┘
```

---

## Per-Gap Resolution Summary

### Gap 1 — Row source (partially fixed)
Current `grid()` endpoint is the right shape. Works when trial data is complete. **No change needed to the endpoint logic** once Gap 6 and Gap 7 are resolved.

### Gap 2 — Plot number
`plot_no` on auto-created records uses `entry_number` as a string. This is reasonable but needs to be consistent. The wizard ("Tambah Baris") should also use `entry_number` as the plot_no when adding an in-plan row, or be constrained to out-of-plan use.

### Gap 3 — No `trial_id` on records (ROOT CAUSE)
This is the most important fix. Add `trial_id` (nullable FK) to `observation_records`. The grid endpoint should filter by `trial_id` instead of using the genotype-set heuristic. Auto-created records must receive `trial_id`.

### Gap 5 — Import produces `environment_id = NULL`
The import service maps the "Environment" column to `environment_conditions` (treatment type). It should instead map to `environments` (physical location). This requires a migration change to import logic and the staging normalization step.

### Gaps 6 & 7 — Trial prerequisites
Trials must have genotypes and environments assigned before the grid works. This is a workflow problem, not a code problem. A clear empty-state message guiding the user is sufficient ("Assign genotypes and environments to this Research Plan first").

### Gap 8 — Duplicate records
Once `trial_id` is added and the unique constraint updated to include it, duplicates within a trial become impossible.

### Gap 11 — Aggregate lacks trial context
`GET /v1/phenotyping/aggregate` should accept `trial_id` as an optional filter and pass it to the query.
