# Implementation Plan — True Excel-Like Spreadsheet

**Date:** 2026-07-20  
**Status:** Plan only. No code changes yet.

---

## Objective

Transform Data Pengamatan from a CRUD table into a true spreadsheet where:
- Rows are pre-generated from the Research Plan (not from existing Observation Records)
- Researchers edit cells directly, no "Tambah Baris" required
- Observation Records are created automatically on first cell edit
- The connection between records and trials is reliable (not heuristic)

---

## Architectural Decision: Stay on Gen 3, Fix the Missing Link

Rather than migrating to the Gen 2 `trial_plots` system (which would require rewriting import, characteristics linkage, and frontend), the recommendation is to **extend Gen 3 with the minimum required changes**:

1. Add `trial_id` to `observation_records` (the missing link)
2. Fix the import environment mapping (optional but important)
3. Keep `grid()` endpoint, fix its match logic to use `trial_id`
4. Fix the auto-create to pass `trial_id`

This is the minimum change that makes the spreadsheet reliable.

---

## Step 1 — Database Migration (REQUIRED FIRST)

### 1a. Add `trial_id` to `observation_records`

```php
// New migration: 2026_07_XX_add_trial_id_to_observation_records
Schema::table('observation_records', function (Blueprint $table) {
    $table->foreignId('trial_id')->nullable()->after('id')
          ->constrained('trials')->nullOnDelete();
    $table->index('trial_id');
    // Compound index for the grid's primary lookup
    $table->index(['trial_id', 'genotype_id', 'environment_id', 'replication'],
                  'obs_rec_trial_grid_idx');
});
```

- **Nullable** so existing records without a trial are not broken
- `nullOnDelete` — if trial is deleted, records remain (orphaned but recoverable)

### 1b. Backfill existing records (best-effort)

For existing records, try to infer `trial_id` by matching `(genotype_id, environment_id)` to `trial_environments` + `trial_genotypes`. Where unambiguous, set `trial_id`. Where ambiguous (genotype appears in multiple trials for the same environment), leave as `null`.

This backfill is best-effort and non-blocking — records without `trial_id` continue to work via the heuristic fallback.

### 1c. (Optional) Fix import environment mapping

The import service currently maps "Environment" → `environment_conditions` (treatment type). For grid compatibility, it should also resolve `environment_id` (physical location). This requires:
- Adding an "Lokasi" column to the import template (physical environment code)
- OR renaming "Environment" to mean physical location (breaking change to existing templates)
- **Defer this to a separate batch.** It requires user communication.

---

## Step 2 — Backend: Fix `grid()` and `store()` Endpoints

### 2a. Update `grid()` to filter by `trial_id`

**Current (heuristic, fragile):**
```php
$records = ObservationRecord::with(['values.characteristic'])
    ->whereIn('genotype_id', $genotypeIds)
    ->whereIn('environment_id', $envIds)
    ->get();
```

**New (reliable):**
```php
$records = ObservationRecord::with(['values.characteristic'])
    ->where('trial_id', $trial->id)         // ← primary filter
    ->whereIn('genotype_id', $genotypeIds)  // ← secondary, for safety
    ->whereIn('environment_id', $envIds)
    ->get();
```

**Fallback for legacy records (no trial_id):** If `trial_id` filter returns 0 results but `trial_id`-less heuristic would return results, optionally fall back. This is a transitional measure; remove after backfill.

### 2b. Update `store()` to accept and save `trial_id`

```php
// In validation:
'trial_id' => ['nullable', 'exists:trials,id'],

// In record creation:
$data['trial_id'] = $request->trial_id;
```

Also update uniqueness check to include `trial_id` when provided:
```php
$existing = ObservationRecord::withTrashed()
    ->when($data['trial_id'] ?? null, fn($q, $tid) => $q->where('trial_id', $tid))
    ->where('environment_id', $data['environment_id'])
    ->where('plot_no', $data['plot_no'])
    ->where('replication', $data['replication'])
    ->first();
```

### 2c. Update `index()` to support `trial_id` filter

```php
->when($request->filled('trial_id'), fn($q) => $q->where('trial_id', $request->trial_id))
```

This allows `aggregate()` to also accept `trial_id` and produce per-trial aggregates.

---

## Step 3 — Frontend: Pass `trial_id` on Auto-Create

### 3a. `data-pengamatan/page.tsx` — `handleCellChange`

```tsx
const res = await phenotypingService.createRecord({
  trial_id:       Number(trialFilter),  // ← NEW
  plot_no:        row.plot_no,
  genotype_id:    row.genotype_id,
  environment_id: row.environment_id,
  replication:    row.replication,
  values: [{ characteristic_id: characteristic.id, value }],
});
```

### 3b. `data-pengamatan/page.tsx` — Wizard "Tambah Baris"

Pre-fill `trial_id` from `trialFilter` and pass it to the POST. The wizard now creates out-of-plan records (exceptional entries) that are still trial-scoped.

---

## Step 4 — Prerequisites Check for Empty Trials

When a trial is selected but `grid()` returns 0 rows because no genotypes or environments are assigned:

**Current behavior:** Grid shows "Tidak ada data. Pastikan Research Plan sudah memiliki genotipe dan lokasi."

**Improved:** Add a clear diagnostic panel:
```
Research Plan: [Trial Name]
✗ Belum ada genotipe ditetapkan  → [Tambah Genotipe]
✗ Belum ada lokasi ditetapkan    → [Tambah Lokasi]
Setelah genotipe dan lokasi ditetapkan, baris akan muncul otomatis.
```

This is a frontend-only change, no migration needed.

---

## Step 5 — Fix Import to Set `environment_id` and `trial_id`

This is the most complex step. Options:

**Option A (Recommended): Add "Kode Lokasi" column to template**
- Import template adds column "Kode Lokasi" (environment_code) alongside "Environment" (environment_condition)
- Import service resolves `environment_id` from "Kode Lokasi" → `environments.environment_code`
- Imported records get both `environment_id` AND `environment_condition_id`
- They appear correctly in the grid

**Option B: Rename "Environment" to mean physical location**
- Breaking change to existing templates
- Not recommended without user communication

**Option C: Post-import linkage step**
- After import confirm, user maps each imported environment_condition to a physical environment
- Complex UX, not recommended

Recommendation: **Option A**, implemented as a separate batch with template version bump and user notification.

---

## Step 6 — `aggregate()` Trial Filter

```php
Route: GET /v1/phenotyping/aggregate?trial_id=X

// In aggregate():
$records = ObservationRecord::with(['genotype', 'environment', 'values'])
    ->when($request->filled('trial_id'), fn($q) => $q->where('trial_id', $request->trial_id))
    ->when($request->filled('environment_id'), ...)
    ->when($request->filled('genotype_id'), ...)
    ->get();
```

Frontend: `data-rata-rata/page.tsx` adds `trial_id` to the aggregate query params, driven by a trial filter select (same as data-pengamatan).

---

## Implementation Order

| Step | Change | Type | Risk | Priority |
|---|---|---|---|---|
| 1a | Add `trial_id` to `observation_records` | Migration | Low (nullable) | **CRITICAL** |
| 2a | Fix `grid()` to filter by `trial_id` | Backend | Low | **CRITICAL** |
| 2b | Fix `store()` to accept `trial_id` | Backend | Low | **CRITICAL** |
| 3a | Pass `trial_id` on auto-create | Frontend | Low | **CRITICAL** |
| 3b | Pass `trial_id` from wizard | Frontend | Low | High |
| 2c | `index()` + `aggregate()` trial filter | Backend | Low | High |
| 4 | Prerequisites empty state | Frontend | None | Medium |
| 6 | aggregate trial filter in frontend | Frontend | Low | Medium |
| 5 | Fix import environment mapping | Backend + Frontend | Medium | Low (separate batch) |
| 1b | Backfill existing records' trial_id | Data migration | Medium | Low (after step 1a) |

---

## What Does NOT Need to Change

- `ObservationGrid.tsx` — the component is correct; it receives `GridRow[]` and renders them. No changes needed.
- `grid()` endpoint shape — the response shape (`{ trial, rows }`) and virtual row generation logic are correct. Only the match query changes (heuristic → `trial_id`).
- `characteristics` system — correct as-is.
- Gen 2 system (`trial_plots`, `plot_observations`) — leave stranded; do not migrate to it.
- Import UI — no frontend changes for import in this batch; only backend logic in Step 5.

---

## Summary of Minimum Required Changes

To make the spreadsheet work correctly for in-plan data entry (no Tambah Baris required):

1. **Migration:** Add `trial_id` nullable FK to `observation_records`
2. **Backend:** `grid()` filters by `trial_id`; `store()` accepts `trial_id`
3. **Frontend:** `handleCellChange` passes `trial_id` on auto-create

These three changes are the **minimum viable fix**. Everything else is improvement.

---

## Files That Will Be Modified

### Backend
- `database/migrations/2026_07_XX_add_trial_id_to_observation_records.php` — new
- `app/Http/Controllers/Api/V1/ObservationRecordController.php` — `grid()`, `store()`, `index()`, `aggregate()`

### Frontend
- `src/app/(dashboard)/phenotyping/data-pengamatan/page.tsx` — `handleCellChange`, wizard submit, empty state
- `src/services/phenotyping.service.ts` — update `createRecord` type to include `trial_id`
- `src/types/index.ts` — update `ObservationRecord` type to include `trial_id?: number`

### No Changes
- `ObservationGrid.tsx` ← do not touch
- `phenotyping.service.getGrid` ← do not touch
- `types/GridRow` ← do not touch
- Any import files (Step 5 is a separate batch)
- Any Gen 2 files
