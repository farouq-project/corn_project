# Database Analysis — Corn Breed UNPAD 2026

**Engine:** PostgreSQL 16 (Supabase in production, Docker `postgres:16-alpine` locally)
**Migrations:** 49 files under `backend/database/migrations`
**Source:** Static review of migration files + model relationships (no live DB introspection performed)

---

## 1. Schema Overview by Domain Area

### 1.1 Identity & Access
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | App users (researchers, staff) | id, name, email, password, employee_id, phone, institution, avatar, status (active\|inactive\|suspended), last_login_at, soft-deletes |
| `personal_access_tokens` | Sanctum API tokens | tokenable, name, abilities, expires_at |
| `roles`, `permissions`, `model_has_roles`, `model_has_permissions`, `role_has_permissions` | Spatie Permission tables | standard package schema, teams disabled |
| `password_reset_tokens`, `sessions`, `cache`, `jobs` | Laravel framework tables | — |

### 1.2 Master Data
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `seasons` | Growing seasons | season_code (unique), season_name, start_date, end_date, status |
| `locations` | Physical fields | field_code (unique), field_name, lat/long, altitude, area_hectares, village/district/regency/province, soil_type, is_active |
| `trial_types` | Reference list | type_code, type_name |
| `genotypes` | Genetic material catalog | genotype_code (unique), old_code, genotype_name, category (inbred_line\|hybrid\|variety\|population\|germplasm), trial_type (drought\|shade\|normal\|feed\|sweet_corn\|multi), origin, breeder, release_year, pedigree, status, created_by → users |

### 1.3 Trial Design (Multi-Environment Trial hierarchy)
| Table | Purpose | Key Columns / Constraints |
|-------|---------|---------------------------|
| `environments` | Location × Season instance | environment_code (unique), location_id, season_id (**unique pair**), lat/long, elevation_m, irrigation_type, land_history, soil_type, total_rainfall_mm, avg_temperature_c, avg_humidity_percent, env_data_source (manual\|nasa_power\|meteostat\|bmkg\|mixed), api_metadata (JSON) |
| `trials` | Experiment definition | trial_code (unique), trial_name, season_id, location_id, trial_type_id, objective, layout_design (RCBD\|CRD\|split_plot\|factorial\|augmented\|alpha_lattice), replications, plot_size_m2, row/plant spacing, planting/harvest_date, status, principal_researcher_id, created_by |
| `trial_environments` | Trial ↔ Environment link | trial_id, environment_id, local_trial_code, status, local_coordinator_id → users |
| `trial_genotypes` | Trial ↔ Genotype (entries) | trial_id, genotype_id, entry_number, treatment_label, is_check (bool) |
| `trial_researchers` | Trial ↔ User (team) | trial_id, user_id, role |
| `trial_blocks` | Replication block | trial_id, environment_id, block_number, block_label, row/col start-end; **unique(trial_id, environment_id, block_number)** |
| `trial_plots` | Atomic observation unit | plot_code (unique, 40 char), trial_id, environment_id, trial_block_id, genotype_id, entry_number, treatment_label, is_check, plot_number, row/col_position, randomization_order, plot_length/width_m, plant/row_spacing, plants_per_plot, status (active\|damaged\|missing\|excluded); **unique(trial_id, environment_id, trial_block_id, genotype_id)** |
| `trial_layouts` | Stored/versioned layout designs | trial_id, layout metadata |

### 1.4 Phenotyping (two parallel systems)

**New, plot-based system:**
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `plot_observations` | Observation event per plot | observation_code (unique, 40 char), trial_plot_id, trial_id, environment_id, trial_block_id, genotype_id, observation_date, growth_stage (enum pre_emergence→harvest), days_after_planting, total_variables_expected/filled, status (draft\|submitted\|approved\|rejected), photos (JSON), recorded_by, approved_by/at |
| `plot_observation_values` | Trait value per observation | observation_id, variable_id, numeric_value/text_value, is_outlier |

**Legacy, trial+genotype-based system (still live):**
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `phenotype_variables` | Trait/variable catalog | variable_code, variable_name, abbreviation, category, data_type (numeric\|integer\|text\|boolean\|scale\|date), unit, min/max_value, decimal_places, is_required, is_active, sort_order |
| `phenotype_observations` | Observation per trial+genotype+replication | observation_code (unique), trial_id, genotype_id, season_id, replication, plot_number, row_label, observation_date, growth_stage, status, general_notes, photos (JSON), recorded_by, approved_by/at |
| `phenotype_values` | Trait value per legacy observation | observation_id, variable_id, numeric_value/text_value, is_outlier |

> **Recommendation:** `phenotype_variables` appears shared by both systems (referenced by `plot_observation_values.variable_id` and `phenotype_values.variable_id`). Confirm this and consider consolidating the two observation tables — see `IMPROVEMENT_ROADMAP.md`.

### 1.5 Disease Evaluation
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `disease_types` | Disease catalog | code, name |
| `disease_evaluations` | Evaluation event | evaluation_code (unique), trial_id, environment_id, disease_type_id, evaluation_date, growth_stage, days_after_planting, weather_notes, status (draft\|submitted\|approved), evaluator_id, approved_by/at |
| `disease_scores` | Score per plot | evaluation_id, trial_plot_id, genotype_id, trial_block_id, incidence_percent, severity_score, intensity_percent, symptom_first_seen, plants_assessed/affected, resistance_category |

### 1.6 Environmental Data
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `soil_analyses` | Soil lab results per environment | environment_id, sample_date, sample_depth_cm, lab_name/reference, ph_h2o, ph_kcl, organic_c/matter_percent, total_n_percent, available_p/k_ppm, cation_exchange_capacity, sand/silt/clay_percent, texture_class, bulk_density_g_cm3, micronutrients (JSON), document_path |
| `weather_records` | Meteorological data per environment | source/timestamps (NASA POWER / Meteostat / BMKG per `env_data_source`) |

### 1.7 Seed Inventory & Storage
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `storage_units` | Physical storage (fridge/freezer/etc) | unit_code, unit_name, unit_type (refrigerator\|freezer\|cold_room\|dry_room\|cabinet\|shelf), room_name, building, temperature/humidity min/max, capacity_racks, capacity_boxes_per_rack, is_active |
| `storage_readings` | Sensor/manual temp/humidity logs | storage_unit_id, temperature, humidity, reading_time, source (manual\|sensor\|import), status (normal\|warning\|critical) |
| `seed_inventories` | Seed lot/package tracking | package_code/qr_code/barcode (all unique), genotype_id, storage_unit_id, rack/box/row/col position, season_id, source_trial_id, harvest/storage/expiry_date, initial/remaining_weight_g, moisture_content, germination_percentage, vigor_index, seed_count, storage_status (good\|warning\|critical\|expired\|depleted\|discarded) |
| `seed_movements` | Inventory transaction log | seed_inventory_id, movement_type, quantity_g, balance_after_g, movement_date, reason, performed_by, related_trial |

### 1.8 Field Operations
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `field_activities` | Field activity log | activity_code (unique), user_id, trial_id, location_id, genotype_id, activity_type (enum: planting\|pollination\|fertilizer_application\|irrigation\|pesticide_application\|harvesting\|drone_flight\|disease_observation\|sampling\|soil_preparation\|thinning\|weeding\|monitoring\|other), activity_date, start/end_time, lat/long, photos (JSON), voice_note_path, materials_used (JSON), weather_conditions (JSON), status (draft\|submitted\|approved) |

### 1.9 Finance
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `expense_categories` | Expense type catalog | category_code, category_name, color |
| `budgets` | Budget allocations | budget_code, budget_name, season_id, trial_id, funding_source, total_amount, allocated_amount, start/end_date, status (active\|exhausted\|closed) |
| `expenses` | Expense records | expense_code (unique), category_id, budget_id, trial_id, season_id, title, amount (decimal 15,2), payment_date, vendor, funding_source, payment_method, reference_number, attachments (JSON), approval_status (pending\|approved\|rejected\|revision_needed), submitted_by, approved_by/at |

### 1.10 Variety Release Pipeline
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `variety_candidates` | Candidate tracking | candidate_code (unique), genotype_id, proposed_variety_name, status (under_evaluation\|proposed\|submitted_to_board\|approved\|released\|withdrawn\|rejected), evaluation_start_year, target_release_year, num_trial_years/locations, avg_yield_t_ha, yield_superiority_percent, best_environment, disease_resistance_summary (JSON), submission_number/date, release_date/decree_number, adaptation_zones, principal_breeder_id |

### 1.11 Documents, Scheduling, Notifications, Imports
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `research_documents` | Document store | document_code, title, category, trial_id/environment_id/season_id, disk, file_path, original_filename, mime_type, file_size_bytes, version, parent_document_id, is_latest_version, document_date, is_public, tags (array), uploaded_by |
| `observation_schedules` | Planning/reminders | trial_id, environment_id, schedule_title, observation_type, variable_category, scheduled_date, deadline_date, growth_stage_target, assigned_to, status, completion_date/rate_percent, reminder_sent/at/days_before |
| `file_attachments` | Polymorphic attachments | attachable_type/id, file metadata — used by Expense, FieldActivity, etc. |
| `notifications` / `system_notifications` | In-app notifications | polymorphic, per-user |
| `import_jobs`, `inventory_import_batches`, `inventory_import_staging`, `storage_unit_import_staging` | Multi-step bulk import pipeline | batch status, staged rows pending validation/confirmation |

### 1.12 Audit
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `audit_logs` | Append-only change log | user_id, user_name, event, auditable_type, auditable_id, old_values (JSON), new_values (JSON), tags (JSON), ip_address, user_agent, url, created_at only (no updated_at) |

---

## 2. Entity Relationship Summary (Core Hierarchy)

```
locations 1───* environments *───1 seasons
                    │
                    ├──* trial_environments *──┐
                    │                           │
trials 1────────────┴───────────────────────────┘
  │  │  │
  │  │  └──* trial_genotypes *── genotypes
  │  └─────* trial_researchers *── users
  └──* trial_blocks
         └──* trial_plots ── genotypes / trial_blocks / environments / trials
                ├──* plot_observations ──* plot_observation_values ── phenotype_variables
                └──* disease_scores ── disease_evaluations ── disease_types

genotypes 1──* seed_inventories ── storage_units
                  └──* seed_movements

seasons/trials 1──* budgets 1──* expenses ── expense_categories
genotypes 1──* variety_candidates
users 1──* field_activities ── trials/locations/genotypes
* ── audit_logs (polymorphic via auditable_type/auditable_id)
```

---

## 3. Indexing & Performance Notes

Composite indexes already in place on hot paths:
- `trials`: (season_id, status), (location_id, status)
- `genotypes`: (category, trial_type, status)
- `seed_inventories`: (genotype_id, storage_status), (storage_unit_id, rack_label, box_number), storage_date, expiry_date
- `field_activities`: (user_id, activity_date), (trial_id, activity_type), activity_date
- `expenses`: (category_id, payment_date), (trial_id, approval_status), payment_date
- `plot_observations`: (trial_id, environment_id, genotype_id), (trial_plot_id, observation_date), (trial_id, growth_stage), status
- `audit_logs`: (auditable_type, auditable_id), (user_id, created_at), event

**Foreign key delete behavior:**
- `trial_blocks` and `trial_plots` cascade on delete from `trials` (deleting a trial removes its plot/block structure).
- Most `*_by`/`*_id` references to `users` use `nullOnDelete()` — preserves historical records when a user account is removed.

**Unique constraints worth noting:**
- `environments`: unique(location_id, season_id) — at most one environment per location per season.
- `trial_blocks`: unique(trial_id, environment_id, block_number).
- `trial_plots`: unique(trial_id, environment_id, trial_block_id, genotype_id) — prevents duplicate plot assignment.
- `seed_inventories`: package_code, qr_code, barcode all unique — supports physical scanning workflows.

---

## 4. Data Integrity / Modeling Observations

1. **Two phenotyping systems coexist** (`phenotype_observations`/`phenotype_values` vs `plot_observations`/`plot_observation_values`). Both reference `phenotype_variables`. This is the single biggest schema-level consolidation opportunity — see roadmap.
2. **Soft deletes are inconsistently applied.** Models like `PhenotypeVariable`, `ObservationSchedule`, and `TrialPlot` do not use `SoftDeletes` while most others do. If `trials` cascade-deletes `trial_plots` (hard delete) but `trial_plots` itself isn't soft-deletable, deleting a trial permanently removes plot history — worth confirming this is intentional given `plot_observations` (which IS soft-deletable) reference those plots.
3. **JSON columns** are used extensively for semi-structured data (photos, materials_used, weather_conditions, api_metadata, micronutrients, disease_resistance_summary, attachments, tags). This is reasonable for this domain but means these fields aren't queryable via indexes/joins — fine for current scale, worth revisiting if filtering on JSON fields becomes common (Postgres JSONB + GIN index would help).
4. **`environments.api_metadata`** suggests caching of external weather API responses (NASA POWER, Meteostat, BMKG) directly in the row — consider a separate `weather_records` table is already present for this; check for redundancy between the two.
5. **`corn_export.sql`** (2.3MB) at repo root is a full database dump — useful for onboarding/demo data, but should be reviewed for any real personal data before being treated as a permanent artifact, and ideally regenerated/anonymized periodically rather than manually maintained.

---

## 5. Suggested Schema Follow-ups (see Roadmap for prioritization)

- Decide and document the fate of the legacy phenotyping tables (migrate data into `plot_observations` + deprecate, or formally document why both remain).
- Apply `SoftDeletes` consistently to `trial_plots`, `phenotype_variables`, `observation_schedules` if data retention matters for audit/compliance.
- Consider JSONB + GIN indexes for `photos`, `tags`, `attachments` if these are ever filtered/searched.
- Add a migration to enforce `roles`/`permissions` seed data documentation (which roles map to which permissions) since this isn't currently enforced in code — the seed data IS the authorization policy today.
