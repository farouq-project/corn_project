export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  employee_id?: string;
  phone?: string;
  institution?: string;
  avatar?: string;
  status: "active" | "inactive" | "suspended";
  last_login_at?: string;
  roles: string[];
  permissions: string[];
  pivot?: { role?: string; [key: string]: unknown };
}

export interface Environment {
  id: number;
  environment_code: string;
  name?: string;
  address?: string;
  luas_ha?: number;
  location_id?: number;
  season_id?: number;
  location?: { field_name: string };
  season?: { season_name: string };
  latitude?: number;
  longitude?: number;
  elevation_m?: number;
  avg_temperature_c?: number;
  total_rainfall_mm?: number;
  irrigation_type?: string;
  planting_date?: string;
  harvest_date?: string;
  notes?: string;
}

export interface Season {
  id: number;
  season_code: string;
  season_name: string;
  start_date: string;
  end_date: string;
  description?: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
}

export interface Location {
  id: number;
  field_code: string;
  field_name: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  area_hectares?: number;
  village?: string;
  district?: string;
  regency?: string;
  province: string;
  soil_type?: string;
  is_active: boolean;
}

export interface Genotype {
  id: number;
  genotype_code: string;
  old_code?: string;
  genotype_name: string;
  category: "inbred_line" | "hybrid" | "variety" | "population" | "germplasm";
  trial_type: "drought" | "shade" | "normal" | "feed" | "sweet_corn" | "multi";
  origin?: string;
  breeder?: string;
  release_year?: number;
  breeder_notes?: string;
  pedigree?: string;
  status: "active" | "inactive" | "archived";
  total_seed_weight?: number;
  pivot?: { is_check?: boolean; [key: string]: unknown };
}

export interface StorageUnit {
  id: number;
  unit_code: string;
  unit_name: string;
  unit_type: "refrigerator" | "freezer" | "cold_room" | "dry_room" | "cabinet" | "shelf";
  room_name?: string;
  building?: string;
  temperature_min?: number;
  temperature_max?: number;
  humidity_min?: number;
  humidity_max?: number;
  capacity_racks?: number;
  capacity_boxes_per_rack?: number;
  is_active: boolean;
  occupancy_rate?: number;
  active_inventory_count?: number;
  latest_reading?: StorageReading;
}

export interface SeedInventory {
  id: number;
  package_code: string;
  qr_code?: string;
  barcode?: string;
  genotype_id: number;
  genotype?: Genotype;
  storage_unit_id: number;
  storage_unit?: StorageUnit;
  rack_label?: string;
  box_number?: string;
  row_position?: string;
  column_position?: string;
  season?: Season;
  harvest_date?: string;
  storage_date: string;
  expiry_date?: string;
  initial_weight_g: number;
  remaining_weight_g: number;
  moisture_content?: number;
  germination_percentage?: number;
  germination_test_date?: string;
  vigor_index?: number;
  seed_count?: number;
  storage_status: "good" | "warning" | "critical" | "expired" | "depleted" | "discarded";
  notes?: string;
  usage_percentage?: number;
  storage_age?: number;
}

export interface SeedMovement {
  id: number;
  movement_code: string;
  seed_inventory_id: number;
  movement_type: string;
  quantity_g: number;
  balance_after_g: number;
  movement_date: string;
  reason?: string;
  notes?: string;
  performer?: User;
  related_trial?: Trial;
}

export interface StorageReading {
  id: number;
  storage_unit_id: number;
  temperature?: number;
  humidity?: number;
  reading_time: string;
  source: "manual" | "sensor" | "import";
  status: "normal" | "warning" | "critical";
}

export interface Trial {
  id: number;
  trial_code: string;
  trial_name: string;
  season_id: number;
  season?: Season;
  location_id: number;
  location?: Location;
  trial_type?: TrialType;
  objective?: string;
  layout_design: string;
  replications: number;
  plot_size_m2?: number;
  planting_date?: string;
  harvest_date?: string;
  status: "planned" | "active" | "harvested" | "completed" | "cancelled";
  notes?: string;
  principal_researcher?: User;
  genotypes?: Genotype[];
  researchers?: User[];
  environments?: Environment[];
  genotypes_count?: number;
  total_expense?: number;
  phenotype_completion_rate?: number;
}

export interface TrialType {
  id: number;
  type_code: string;
  type_name: string;
  description?: string;
}

export interface PhenotypeVariable {
  id: number;
  variable_code: string;
  variable_name: string;
  abbreviation?: string;
  category: string;
  data_type: "numeric" | "integer" | "text" | "boolean" | "scale" | "date";
  unit?: string;
  min_value?: number;
  max_value?: number;
  decimal_places: number;
  description?: string;
  measurement_guide?: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface PhenotypeObservation {
  id: number;
  observation_code: string;
  trial_id: number;
  trial?: Trial;
  genotype_id: number;
  genotype?: Genotype;
  season_id: number;
  season?: Season;
  replication: number;
  plot_number?: number;
  row_label?: string;
  observation_date: string;
  growth_stage?: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  general_notes?: string;
  photos?: string[];
  values?: PhenotypeValue[];
  recorder?: User;
}

export interface PhenotypeValue {
  id: number;
  observation_id: number;
  variable_id: number;
  variable?: PhenotypeVariable;
  numeric_value?: string;
  text_value?: string;
  is_outlier: boolean;
}

export interface FieldActivity {
  id: number;
  activity_code: string;
  user_id: number;
  user?: User;
  trial_id?: number;
  trial?: Trial;
  location_id?: number;
  location?: Location;
  genotype_id?: number;
  genotype?: Genotype;
  activity_type: string;
  activity_title: string;
  description?: string;
  activity_date: string;
  start_time?: string;
  end_time?: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
  materials_used?: MaterialItem[];
  weather_conditions?: WeatherCondition;
  status: "draft" | "submitted" | "approved";
  notes?: string;
}

export interface MaterialItem {
  item: string;
  quantity: number;
  unit: string;
}

export interface WeatherCondition {
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  wind_speed?: number;
  condition?: string;
}

export interface ExpenseCategory {
  id: number;
  category_code: string;
  category_name: string;
  color?: string;
  description?: string;
}

export interface Budget {
  id: number;
  budget_code: string;
  budget_name: string;
  season?: Season;
  trial?: Trial;
  funding_source: string;
  total_amount: number;
  allocated_amount: number;
  start_date: string;
  end_date: string;
  status: "active" | "exhausted" | "closed";
  spent_amount?: number;
  remaining_amount?: number;
  utilization_rate?: number;
}

export interface Expense {
  id: number;
  expense_code: string;
  category_id: number;
  category?: ExpenseCategory;
  budget?: Budget;
  trial?: Trial;
  title: string;
  description?: string;
  amount: number;
  payment_date: string;
  vendor?: string;
  funding_source?: string;
  payment_method?: string;
  reference_number?: string;
  attachments?: string[];
  approval_status: "pending" | "approved" | "rejected" | "revision_needed";
  approval_notes?: string;
  submitter?: User;
  approver?: User;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user?: User;
  event: string;
  auditable_type: string;
  auditable_id?: number;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface DashboardStats {
  total_genotypes: number;
  total_environments: number;
  total_observation_records: number;
  total_characteristics: number;
}

// ── Phenotyping (Data Pengamatan / Data Rata-Rata) ──────────────────────────

export interface Characteristic {
  id: number;
  code: string;
  name: string;
  unit?: string;
  group?: string;
  method_description?: string;
  display_order: number;
  decimal_places: number;
  is_active: boolean;
}

export interface ObservationRecord {
  id: number;
  record_code: string;
  plot_no: string;
  genotype_id: number;
  genotype?: Genotype;
  environment_id: number;
  environment?: Environment;
  season_id: number;
  replication: number;
  notes?: string;
  recorded_by?: number;
  recorder?: User;
  values: Record<string, number | null>;
  created_at: string;
  updated_at: string;
}

/**
 * A virtual row in the Data Pengamatan spreadsheet.
 * Generated from Trial.genotypes × Trial.environments × replications.
 * record_id is null when no ObservationRecord has been saved for this slot yet.
 */
export interface GridRow {
  entry_number: number;
  plot_no: string;
  genotype_id: number;
  genotype: Pick<Genotype, 'id' | 'genotype_code' | 'genotype_name'>;
  environment_id: number;
  environment: Pick<Environment, 'id' | 'environment_code'> & { name?: string };
  replication: number;
  record_id: number | null;
  values: Record<string, number | null>;
}

export interface AggregatedCharacteristicData {
  values: Record<string, number | null>;
  imputed: Record<string, boolean>;
  average: number | null;
}

export interface AggregatedRow {
  genotype_id: number;
  genotype_code: string;
  genotype_name: string;
  environment_id: number;
  environment_code: string;
  characteristics: Record<string, AggregatedCharacteristicData>;
}
