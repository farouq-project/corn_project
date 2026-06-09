<?php

namespace Database\Seeders;

use App\Models\Budget;
use App\Models\DiseaseEvaluation;
use App\Models\DiseaseScore;
use App\Models\Environment;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\FieldActivity;
use App\Models\Genotype;
use App\Models\Location;
use App\Models\ObservationSchedule;
use App\Models\PlotObservation;
use App\Models\PlotObservationValue;
use App\Models\PhenotypeVariable;
use App\Models\Season;
use App\Models\SeedInventory;
use App\Models\SeedMovement;
use App\Models\StorageUnit;
use App\Models\Trial;
use App\Models\TrialBlock;
use App\Models\TrialEnvironment;
use App\Models\TrialPlot;
use App\Models\User;
use App\Models\VarietyCandidate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoDataSeeder extends Seeder
{
    private User $admin;
    private User $researcher;
    private User $fieldStaff;
    private User $storageOfficer;
    private User $financeStaff;

    public function run(): void
    {
        $this->loadUsers();

        $this->command->info('→ Seeding Musim Tanam...');
        $seasons = $this->seedSeasons();

        $this->command->info('→ Seeding Unit Penyimpanan...');
        $storageUnits = $this->seedStorageUnits();

        $this->command->info('→ Seeding Trial...');
        $trials = $this->seedTrials($seasons);

        $this->command->info('→ Seeding Environments...');
        $environments = $this->seedEnvironments($seasons, $trials);

        $this->command->info('→ Seeding Pengamatan Fenotipe...');
        $this->seedPhenotypeObservations($trials, $environments);

        $this->command->info('→ Seeding Evaluasi Penyakit...');
        $this->seedDiseaseEvaluations($trials, $environments);

        $this->command->info('→ Seeding Jadwal Pengamatan...');
        $this->seedObservationSchedules($trials, $environments);

        $this->command->info('→ Seeding Kegiatan Lapang...');
        $this->seedFieldActivities($trials);

        $this->command->info('→ Seeding 50 Inventaris Benih (via import pipeline)...');
        $this->seedSeedInventories($storageUnits, $seasons, $trials);

        $this->command->info('→ Seeding Catatan Pengeluaran...');
        $this->seedExpenses($trials, $seasons);

        $this->command->info('→ Seeding Pelepasan Varietas...');
        $this->seedVarietyCandidates();

        $this->command->info('✓ Demo data seeding selesai.');
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    private function loadUsers(): void
    {
        $this->admin         = User::role('super_admin')->first();
        $this->researcher    = User::role('principal_researcher')->first();
        $this->fieldStaff    = User::role('field_researcher')->first();
        $this->storageOfficer= User::role('storage_officer')->first();
        $this->financeStaff  = User::role('finance_staff')->first();
    }

    private function genotypes(): array
    {
        return Genotype::where('status', 'active')
            ->limit(14)
            ->get()
            ->toArray();
    }

    private function loc(string $code): ?Location
    {
        return Location::where('field_code', $code)->first();
    }

    // ── 1. MUSIM TANAM ────────────────────────────────────────────────────────

    private function seedSeasons(): array
    {
        $rows = [
            ['season_code' => 'MH2024', 'season_name' => 'Musim Hujan 2024/2025',
             'start_date' => '2024-11-01', 'end_date' => '2025-04-30', 'status' => 'completed',
             'description' => 'Musim hujan periode pertama program pemuliaan jagung tahan kekeringan'],
            ['season_code' => 'MK2025', 'season_name' => 'Musim Kemarau 2025',
             'start_date' => '2025-05-01', 'end_date' => '2025-10-31', 'status' => 'completed',
             'description' => 'Musim kemarau untuk uji cekaman kekeringan tahap lanjut'],
            ['season_code' => 'MH2025', 'season_name' => 'Musim Hujan 2025/2026',
             'start_date' => '2025-11-01', 'end_date' => '2026-04-30', 'status' => 'active',
             'description' => 'Musim hujan utama uji multilokasi program jagung UNPAD 2026'],
            ['season_code' => 'MK2026', 'season_name' => 'Musim Kemarau 2026',
             'start_date' => '2026-05-01', 'end_date' => '2026-10-31', 'status' => 'upcoming',
             'description' => 'Musim kemarau untuk konfirmasi stabilitas genotipe harapan'],
            ['season_code' => 'MH2026', 'season_name' => 'Musim Hujan 2026/2027',
             'start_date' => '2026-11-01', 'end_date' => '2027-04-30', 'status' => 'upcoming',
             'description' => 'Musim hujan untuk uji adaptasi nasional kandidat varietas'],
        ];

        $created = [];
        foreach ($rows as $row) {
            $row['created_by'] = $this->admin->id;
            $s = \App\Models\Season::firstOrCreate(['season_code' => $row['season_code']], $row);
            $created[$row['season_code']] = $s;
        }
        return $created;
    }

    // ── 2. UNIT PENYIMPANAN ────────────────────────────────────────────────────

    private function seedStorageUnits(): array
    {
        $rows = [
            ['unit_code' => 'RF002', 'unit_name' => 'Kulkas Benih Lab Pemuliaan 2',
             'unit_type' => 'refrigerator', 'room_name' => 'Lab Pemuliaan Tanaman',
             'building' => 'Gedung B Faperta', 'temperature_min' => 4, 'temperature_max' => 8,
             'humidity_min' => 30, 'humidity_max' => 45, 'capacity_racks' => 5,
             'capacity_boxes_per_rack' => 25, 'description' => 'Kulkas khusus benih galur inbred jangka menengah'],
            ['unit_code' => 'RF003', 'unit_name' => 'Kulkas Benih Lab Teknologi Benih',
             'unit_type' => 'refrigerator', 'room_name' => 'Lab Teknologi Benih',
             'building' => 'Gedung C Faperta', 'temperature_min' => 2, 'temperature_max' => 6,
             'humidity_min' => 25, 'humidity_max' => 40, 'capacity_racks' => 4,
             'capacity_boxes_per_rack' => 20, 'description' => 'Kulkas untuk benih hibrida dan material seleksi'],
            ['unit_code' => 'FZ002', 'unit_name' => 'Freezer Konservasi Jangka Panjang 2',
             'unit_type' => 'freezer', 'room_name' => 'Ruang Penyimpanan Dingin',
             'building' => 'Gedung B Faperta', 'temperature_min' => -20, 'temperature_max' => -15,
             'humidity_min' => 15, 'humidity_max' => 35, 'capacity_racks' => 3,
             'capacity_boxes_per_rack' => 12, 'description' => 'Freezer untuk konservasi plasma nutfah jangka sangat panjang'],
            ['unit_code' => 'CB002', 'unit_name' => 'Kabinet Kering Anti Hama',
             'unit_type' => 'cabinet', 'room_name' => 'Ruang Akses Benih',
             'building' => 'Gedung B Faperta', 'temperature_min' => 18, 'temperature_max' => 25,
             'humidity_min' => 40, 'humidity_max' => 55, 'capacity_racks' => 6,
             'capacity_boxes_per_rack' => 30, 'description' => 'Kabinet untuk benih kerja yang sering diakses'],
            ['unit_code' => 'CB003', 'unit_name' => 'Kabinet Distribusi Benih',
             'unit_type' => 'cabinet', 'room_name' => 'Ruang Distribusi',
             'building' => 'Gedung A Faperta', 'temperature_min' => 20, 'temperature_max' => 28,
             'humidity_min' => 45, 'humidity_max' => 60, 'capacity_racks' => 4,
             'capacity_boxes_per_rack' => 20, 'description' => 'Kabinet untuk benih yang siap didistribusikan ke peneliti'],
        ];

        $created = [];
        foreach ($rows as $row) {
            $row['created_by'] = $this->storageOfficer->id;
            $u = StorageUnit::firstOrCreate(['unit_code' => $row['unit_code']], $row);
            $created[$row['unit_code']] = $u;
        }
        return $created;
    }

    // ── 3. TRIAL ───────────────────────────────────────────────────────────────

    private function seedTrials(array $seasons): array
    {
        $locJtic = $this->loc('JTIC001');
        $locArcm = $this->loc('ARCM001');
        $genotypes = $this->genotypes();
        $g14 = array_slice($genotypes, 0, 14);

        $mh2025 = $seasons['MH2025'] ?? Season::where('season_code', 'MH2025')->first();
        $mk2025 = $seasons['MK2025'] ?? Season::where('season_code', 'MK2025')->first();
        $mh2024 = $seasons['MH2024'] ?? Season::where('season_code', 'MH2024')->first();

        $rows = [
            [
                'trial_code' => 'T-MH2025-D01', 'trial_name' => 'Uji Daya Hasil Pendahuluan Jagung Tahan Kekeringan MH2025',
                'season_id' => $mh2025->id, 'location_id' => $locJtic->id,
                'trial_category' => 'preliminary', 'objective_category' => 'drought_tolerance',
                'objective' => 'Seleksi galur inbred toleran kekeringan untuk program pembentukan hibrida. Target identifikasi 5 galur terbaik dengan hasil >6 t/ha pada kondisi cekaman kekeringan.',
                'layout_design' => 'RCBD', 'replications' => 3, 'num_genotypes' => 14,
                'plot_size_m2' => 18.0, 'row_spacing_cm' => 75, 'plant_spacing_cm' => 20,
                'planting_date' => '2025-11-15', 'harvest_date' => '2026-03-20',
                'status' => 'active', 'target_release_year' => 2028,
                'notes' => 'Percobaan dilakukan pada kondisi tadah hujan tanpa irigasi tambahan. Cekaman kekeringan fase vegetatif akhir hingga pengisian biji.',
            ],
            [
                'trial_code' => 'T-MH2025-N01', 'trial_name' => 'Uji Multilokasi Jagung Hibrida Harapan MH2025',
                'season_id' => $mh2025->id, 'location_id' => $locJtic->id,
                'trial_category' => 'multilocation', 'objective_category' => 'yield_adaptation',
                'objective' => 'Evaluasi adaptasi dan stabilitas hasil 14 genotipe hibrida harapan di 3 lokasi berbeda ketinggian. Persiapan uji nasional.',
                'layout_design' => 'RCBD', 'replications' => 3, 'num_genotypes' => 14, 'num_locations' => 3,
                'plot_size_m2' => 18.0, 'row_spacing_cm' => 75, 'plant_spacing_cm' => 20,
                'planting_date' => '2025-11-20', 'harvest_date' => '2026-03-25',
                'status' => 'active', 'target_release_year' => 2027,
                'notes' => 'Uji multilokasi mencakup dataran rendah (Jatinangor), dataran menengah (Arjasari), dan dataran tinggi (Lembang).',
            ],
            [
                'trial_code' => 'T-MK2025-S01', 'trial_name' => 'Uji Toleransi Naungan Jagung Manis MK2025',
                'season_id' => $mk2025->id, 'location_id' => $locArcm->id,
                'trial_category' => 'single_location', 'objective_category' => 'shade_tolerance',
                'objective' => 'Seleksi genotipe jagung manis toleran naungan untuk sistem tanam tumpangsari dengan perkebunan.',
                'layout_design' => 'RCBD', 'replications' => 3, 'num_genotypes' => 10,
                'plot_size_m2' => 15.0, 'row_spacing_cm' => 80, 'plant_spacing_cm' => 25,
                'planting_date' => '2025-05-10', 'harvest_date' => '2025-09-15',
                'status' => 'completed', 'target_release_year' => null,
                'notes' => 'Naungan buatan 50% menggunakan paranet. Pembanding: varietas komersial jagung manis yang sudah dilepas.',
            ],
            [
                'trial_code' => 'T-MH2024-DR01', 'trial_name' => 'Uji Ketahanan Penyakit Bulai dan Hawar Daun MH2024',
                'season_id' => $mh2024->id, 'location_id' => $locJtic->id,
                'trial_category' => 'preliminary', 'objective_category' => 'disease_resistance',
                'objective' => 'Identifikasi galur murni tahan bulai (Peronosclerospora maydis) dan hawar daun (Exserohilum turcicum) sebagai tetua hibrida.',
                'layout_design' => 'RCBD', 'replications' => 3, 'num_genotypes' => 14,
                'plot_size_m2' => 12.0, 'row_spacing_cm' => 75, 'plant_spacing_cm' => 20,
                'planting_date' => '2024-12-01', 'harvest_date' => '2025-04-10',
                'status' => 'completed', 'target_release_year' => null,
                'notes' => 'Inokulasi buatan dengan suspensi spora pada 14 HST. Evaluasi pada stadia vegetatif dan reproduktif.',
            ],
            [
                'trial_code' => 'T-MH2025-ADV01', 'trial_name' => 'Uji Daya Hasil Lanjutan Hibrida Kandidat Pelepasan MH2025',
                'season_id' => $mh2025->id, 'location_id' => $locJtic->id,
                'trial_category' => 'advanced', 'objective_category' => 'combined',
                'objective' => 'Konfirmasi keunggulan hasil dan stabilitas 5 hibrida terbaik dari uji pendahuluan untuk persiapan pengajuan pelepasan varietas ke Kementan.',
                'layout_design' => 'RCBD', 'replications' => 4, 'num_genotypes' => 5,
                'plot_size_m2' => 25.0, 'row_spacing_cm' => 75, 'plant_spacing_cm' => 20,
                'planting_date' => '2025-11-25', 'harvest_date' => '2026-03-30',
                'status' => 'active', 'target_release_year' => 2027,
                'notes' => 'Percobaan skala lebih besar (plot 5×5m). Termasuk 3 varietas check komersial. Dikombinasikan dengan pengamatan ketahanan penyakit.',
            ],
        ];

        $created = [];
        foreach ($rows as $row) {
            $row['principal_researcher_id'] = $this->researcher->id;
            $row['created_by'] = $this->researcher->id;
            $trial = Trial::firstOrCreate(['trial_code' => $row['trial_code']], $row);

            // Assign genotypes
            if ($trial->genotypes()->count() === 0) {
                $count = $row['num_genotypes'] ?? 14;
                $slice = array_slice($g14, 0, $count);
                $syncData = [];
                foreach ($slice as $i => $g) {
                    $syncData[$g['id']] = [
                        'entry_number' => $i + 1,
                        'treatment_label' => 'G' . str_pad($i + 1, 2, '0', STR_PAD_LEFT),
                        'is_check' => $i >= ($count - 2),
                    ];
                }
                $trial->genotypes()->sync($syncData);
            }

            // Assign researchers
            if ($trial->researchers()->count() === 0) {
                $trial->researchers()->attach($this->fieldStaff->id, ['role' => 'field_observer']);
            }

            $created[$row['trial_code']] = $trial;
        }

        return $created;
    }

    // ── ENVIRONMENTS ───────────────────────────────────────────────────────────

    private function seedEnvironments(array $seasons, array $trials): array
    {
        $locJtic = $this->loc('JTIC001');
        $locArcm = $this->loc('ARCM001');
        $mh2025 = $seasons['MH2025'] ?? Season::where('season_code', 'MH2025')->first();
        $mk2025 = $seasons['MK2025'] ?? Season::where('season_code', 'MK2025')->first();
        $mh2024 = $seasons['MH2024'] ?? Season::where('season_code', 'MH2024')->first();

        $envDefs = [
            ['environment_code' => 'JTIC-MH2025', 'location_id' => $locJtic->id, 'season_id' => $mh2025->id,
             'elevation_m' => 750, 'irrigation_type' => 'rainfed', 'soil_type' => 'Latosol Coklat Kemerahan',
             'land_history' => 'Sebelumnya ditanam kedelai MK2025', 'total_rainfall_mm' => 1850.5,
             'avg_temperature_c' => 24.2, 'avg_humidity_percent' => 78.5,
             'planting_date' => '2025-11-15', 'harvest_date' => '2026-03-20'],
            ['environment_code' => 'ARCM-MH2025', 'location_id' => $locArcm->id, 'season_id' => $mh2025->id,
             'elevation_m' => 600, 'irrigation_type' => 'rainfed', 'soil_type' => 'Latosol Coklat',
             'land_history' => 'Bera 6 bulan', 'total_rainfall_mm' => 1620.0,
             'avg_temperature_c' => 25.8, 'avg_humidity_percent' => 75.0,
             'planting_date' => '2025-11-20', 'harvest_date' => '2026-03-25'],
            ['environment_code' => 'ARCM-MK2025', 'location_id' => $locArcm->id, 'season_id' => $mk2025->id,
             'elevation_m' => 600, 'irrigation_type' => 'supplemental', 'soil_type' => 'Latosol Coklat',
             'land_history' => 'Rotasi dengan padi sawah', 'total_rainfall_mm' => 420.0,
             'avg_temperature_c' => 27.5, 'avg_humidity_percent' => 65.0,
             'planting_date' => '2025-05-10', 'harvest_date' => '2025-09-15'],
            ['environment_code' => 'JTIC-MH2024', 'location_id' => $locJtic->id, 'season_id' => $mh2024->id,
             'elevation_m' => 750, 'irrigation_type' => 'rainfed', 'soil_type' => 'Latosol Coklat Kemerahan',
             'land_history' => 'Sebelumnya ditanam jagung MK2024', 'total_rainfall_mm' => 2050.0,
             'avg_temperature_c' => 23.8, 'avg_humidity_percent' => 82.0,
             'planting_date' => '2024-12-01', 'harvest_date' => '2025-04-10'],
            // ADV trial reuses JTIC-MH2025 environment (same loc+season); resolved via alias below
        ];

        $created = [];
        foreach ($envDefs as $def) {
            $def['created_by'] = $this->researcher->id;
            $env = Environment::firstOrCreate(['environment_code' => $def['environment_code']], $def);
            $created[$def['environment_code']] = $env;
        }

        // Link trials to environments
        $map = [
            'T-MH2025-D01'  => ['JTIC-MH2025'],
            'T-MH2025-N01'  => ['JTIC-MH2025', 'ARCM-MH2025'],
            'T-MK2025-S01'  => ['ARCM-MK2025'],
            'T-MH2024-DR01' => ['JTIC-MH2024'],
            'T-MH2025-ADV01'=> ['JTIC-MH2025'],  // shares environment with D01 (same loc+season)
        ];

        foreach ($map as $trialCode => $envCodes) {
            $trial = $trials[$trialCode] ?? null;
            if (!$trial) continue;
            foreach ($envCodes as $ec) {
                $env = $created[$ec] ?? null;
                if (!$env) continue;
                TrialEnvironment::firstOrCreate(
                    ['trial_id' => $trial->id, 'environment_id' => $env->id],
                    ['status' => in_array($trial->status, ['active', 'completed']) ? 'active' : 'planned',
                     'local_coordinator_id' => $this->fieldStaff->id]
                );
            }
        }

        return $created;
    }

    // ── 4. PENGAMATAN FENOTIPE ────────────────────────────────────────────────

    private function seedPhenotypeObservations(array $trials, array $environments): void
    {
        $trial = $trials['T-MH2025-D01'] ?? Trial::where('trial_code', 'T-MH2025-D01')->first();
        if (!$trial) return;

        $env    = $environments['JTIC-MH2025'] ?? Environment::where('environment_code', 'JTIC-MH2025')->first();
        $genotypes = $trial->genotypes()->get();
        if ($genotypes->isEmpty()) return;

        $variables = PhenotypeVariable::whereIn('variable_code', ['PH', 'DTA', 'DTS', 'ASI', 'EL', 'YIELD'])
            ->get()
            ->keyBy('variable_code');

        // Ensure we have blocks and plots
        $block = TrialBlock::firstOrCreate(
            ['trial_id' => $trial->id, 'environment_id' => $env->id, 'block_number' => 1],
            ['block_label' => 'R1']
        );

        $observationData = [
            ['genotype_idx' => 0, 'stage' => 'maturity_R6', 'date' => '2026-03-01', 'dap' => 106,
             'values' => ['PH' => 248.5, 'DTA' => 62, 'DTS' => 64, 'ASI' => 2, 'EL' => 19.2, 'YIELD' => 7.85],
             'notes' => 'Tanaman sehat, batang kokoh, tidak ada rebah. Panen pada masak fisiologis penuh.'],
            ['genotype_idx' => 1, 'stage' => 'maturity_R6', 'date' => '2026-03-02', 'dap' => 107,
             'values' => ['PH' => 235.0, 'DTA' => 64, 'DTS' => 67, 'ASI' => 3, 'EL' => 17.8, 'YIELD' => 6.92],
             'notes' => 'ASI lebih dari 3 hari menunjukkan stres ringan akibat kekeringan fase silking.'],
            ['genotype_idx' => 2, 'stage' => 'maturity_R6', 'date' => '2026-03-01', 'dap' => 106,
             'values' => ['PH' => 262.3, 'DTA' => 61, 'DTS' => 63, 'ASI' => 2, 'EL' => 20.5, 'YIELD' => 8.34],
             'notes' => 'Genotipe terbaik dalam uji ini. Hasil tinggi, ASI pendek, batang kuat.'],
            ['genotype_idx' => 3, 'stage' => 'maturity_R6', 'date' => '2026-03-03', 'dap' => 108,
             'values' => ['PH' => 225.8, 'DTA' => 65, 'DTS' => 69, 'ASI' => 4, 'EL' => 16.5, 'YIELD' => 5.78],
             'notes' => 'ASI panjang (4 hari), kemungkinan lebih rentan terhadap kekeringan fase reproduktif.'],
            ['genotype_idx' => 4, 'stage' => 'maturity_R6', 'date' => '2026-03-01', 'dap' => 106,
             'values' => ['PH' => 255.1, 'DTA' => 63, 'DTS' => 65, 'ASI' => 2, 'EL' => 18.9, 'YIELD' => 7.56],
             'notes' => 'Penampilan seragam antar plot, menunjukkan stabilitas yang baik di lokasi ini.'],
        ];

        foreach ($observationData as $idx => $obs) {
            $genotype = $genotypes[$obs['genotype_idx']] ?? $genotypes[0];

            $plot = TrialPlot::firstOrCreate(
                ['trial_id' => $trial->id, 'environment_id' => $env->id,
                 'trial_block_id' => $block->id, 'genotype_id' => $genotype->id],
                ['plot_code' => 'T-D01-JTIC-R1-E' . str_pad($idx + 1, 2, '0', STR_PAD_LEFT),
                 'entry_number' => $idx + 1, 'plot_number' => $idx + 1,
                 'row_position' => $idx + 1, 'column_position' => 1,
                 'randomization_order' => $idx + 1, 'plot_length_m' => 6, 'plot_width_m' => 3]
            );

            $obsCode = 'OBS-DEMO-' . str_pad($idx + 1, 3, '0', STR_PAD_LEFT);
            $observation = PlotObservation::firstOrCreate(
                ['observation_code' => $obsCode],
                [
                    'trial_plot_id' => $plot->id,
                    'trial_id' => $trial->id,
                    'environment_id' => $env->id,
                    'trial_block_id' => $block->id,
                    'genotype_id' => $genotype->id,
                    'observation_date' => $obs['date'],
                    'growth_stage' => $obs['stage'],
                    'days_after_planting' => $obs['dap'],
                    'status' => 'approved',
                    'general_notes' => $obs['notes'],
                    'total_variables_expected' => count($obs['values']),
                    'total_variables_filled' => count($obs['values']),
                    'recorded_by' => $this->fieldStaff->id,
                    'approved_by' => $this->researcher->id,
                    'approved_at' => now()->subDays(5),
                ]
            );

            if ($observation->wasRecentlyCreated) {
                foreach ($obs['values'] as $code => $value) {
                    $var = $variables[$code] ?? null;
                    if (!$var) continue;
                    PlotObservationValue::create([
                        'observation_id' => $observation->id,
                        'variable_id' => $var->id,
                        'numeric_value' => $value,
                    ]);
                }
            }
        }
    }

    // ── 5. EVALUASI PENYAKIT ──────────────────────────────────────────────────

    private function seedDiseaseEvaluations(array $trials, array $environments): void
    {
        $trial = $trials['T-MH2024-DR01'] ?? Trial::where('trial_code', 'T-MH2024-DR01')->first();
        if (!$trial) return;

        $env = $environments['JTIC-MH2024'] ?? Environment::where('environment_code', 'JTIC-MH2024')->first();
        if (!$env) return;

        $diseaseTypes = \App\Models\DiseaseType::all()->keyBy('disease_code');
        $genotypes = $trial->genotypes()->get();

        $evaluations = [
            ['code' => 'DE-DEMO-001', 'disease' => 'BULAI',
             'date' => '2025-01-15', 'stage' => 'vegetative_V7_V12', 'dap' => 45,
             'weather' => 'Cuaca lembab, hujan deras 2 hari sebelum evaluasi, kondisi ideal untuk perkembangan Bulai.',
             'notes' => 'Evaluasi pertama pasca inokulasi buatan. Gejala klorosis sistemik mulai terlihat jelas pada beberapa genotipe.',
             'scores' => [
                 [0, 5.2, 'Klorosis sistemik pada lebih dari separuh tanaman. Pertumbuhan sangat terhambat.', 'sangat_rentan'],
                 [1, 2.1, 'Gejala ringan, beberapa tanaman menunjukkan klorosis parsial pada daun muda.', 'agak_tahan'],
                 [2, 1.2, 'Hampir tidak ada gejala. Tanaman tumbuh normal.', 'tahan'],
                 [3, 4.8, 'Klorosis parah pada sebagian besar tanaman, beberapa tanaman mati.', 'sangat_rentan'],
                 [4, 3.5, 'Gejala sedang, pertumbuhan terhambat tetapi tanaman masih dapat berkembang.', 'moderat'],
             ]],
            ['code' => 'DE-DEMO-002', 'disease' => 'HAWAR_DAUN',
             'date' => '2025-02-10', 'stage' => 'tasseling_VT', 'dap' => 71,
             'weather' => 'Kelembaban tinggi (RH > 85%), angin sedang membantu penyebaran spora.',
             'notes' => 'Evaluasi hawar daun pada stadia tasseling. Lesi memanjang mulai terlihat pada daun bawah.',
             'scores' => [
                 [0, 6.5, 'Lesi besar menutupi > 50% luas daun, daun bawah sudah mengering.', 'rentan'],
                 [1, 3.2, 'Lesi kecil-sedang, sekitar 20-30% luas daun terpengaruh.', 'agak_tahan'],
                 [2, 1.8, 'Lesi minimal, hanya pada daun paling bawah. Tanaman sehat secara keseluruhan.', 'tahan'],
                 [3, 5.8, 'Lesi besar dan merata, beberapa daun tengah sudah terinfeksi.', 'rentan'],
                 [4, 2.9, 'Lesi sedang, daun bawah terpengaruh, daun tengah masih baik.', 'agak_tahan'],
             ]],
            ['code' => 'DE-DEMO-003', 'disease' => 'KARAT_DAUN',
             'date' => '2025-02-25', 'stage' => 'silking_R1', 'dap' => 86,
             'weather' => 'Suhu 20-24°C, kelembaban sedang, kondisi mendukung perkembangan karat.',
             'notes' => 'Pustul karat mulai terlihat pada stadia silking. Evaluasi dilakukan pada 3 daun tengah.',
             'scores' => [
                 [0, 4.5, 'Pustul sedang-banyak, tersebar merata pada permukaan daun bagian tengah.', 'moderat'],
                 [1, 2.3, 'Pustul sedikit, terutama pada daun bawah. Daun tengah masih bersih.', 'agak_tahan'],
                 [2, 1.5, 'Sangat sedikit pustul, terisolasi. Tidak mengganggu fotosintesis secara signifikan.', 'tahan'],
                 [3, 7.2, 'Pustul sangat banyak, daun mulai mengering prematur. Potensi kehilangan hasil tinggi.', 'sangat_rentan'],
                 [4, 3.8, 'Pustul cukup banyak pada daun tengah, mempengaruhi 30-40% luas daun.', 'moderat'],
             ]],
            ['code' => 'DE-DEMO-004', 'disease' => 'BUSUK_BATANG',
             'date' => '2025-03-15', 'stage' => 'dent_R5', 'dap' => 104,
             'weather' => 'Kondisi lembab pasca hujan, ideal untuk perkembangan Fusarium pada batang.',
             'notes' => 'Evaluasi busuk batang pada fase pengisian biji akhir. Batang dipotong untuk melihat jaringan dalam.',
             'scores' => [
                 [0, 12.5, 'Sekitar 12% tanaman menunjukkan gejala busuk batang, beberapa rebah.', 'agak_tahan'],
                 [1, 5.2, 'Gejala ringan, hanya 5% tanaman terinfeksi, tidak ada rebah.', 'tahan'],
                 [2, 3.1, 'Gejala minimal, kurang dari 3% tanaman, tidak berpengaruh signifikan.', 'tahan'],
                 [3, 28.5, 'Lebih dari 25% tanaman terinfeksi berat, banyak yang rebah sebelum panen.', 'rentan'],
                 [4, 18.2, 'Sekitar 18% tanaman busuk batang, perlu panen dini untuk meminimalisir kehilangan.', 'rentan'],
             ]],
            ['code' => 'DE-DEMO-005', 'disease' => 'BULAI',
             'date' => '2025-01-30', 'stage' => 'vegetative_V7_V12', 'dap' => 60,
             'weather' => 'Evaluasi lanjutan Bulai. Kondisi cuaca kering, gejala mulai stabil.',
             'notes' => 'Evaluasi lanjutan 2 minggu setelah DE-DEMO-001. Perkembangan penyakit sudah mencapai plateau.',
             'scores' => [
                 [0, 5.8, 'Gejala berkembang lebih lanjut, beberapa tanaman mati.', 'sangat_rentan'],
                 [1, 2.5, 'Gejala stabil, tidak ada perkembangan signifikan dari evaluasi sebelumnya.', 'agak_tahan'],
                 [2, 1.0, 'Tetap tahan, tidak ada gejala baru yang muncul.', 'tahan'],
                 [3, 5.5, 'Kondisi tetap sangat parah.', 'sangat_rentan'],
                 [4, 3.2, 'Gejala sedikit memburuk dari evaluasi pertama.', 'moderat'],
             ]],
        ];

        foreach ($evaluations as $evalDef) {
            $diseaseType = $diseaseTypes[$evalDef['disease']] ?? null;
            if (!$diseaseType) continue;

            $eval = DiseaseEvaluation::firstOrCreate(
                ['evaluation_code' => $evalDef['code']],
                [
                    'trial_id' => $trial->id,
                    'environment_id' => $env->id,
                    'disease_type_id' => $diseaseType->id,
                    'evaluation_date' => $evalDef['date'],
                    'growth_stage' => $evalDef['stage'],
                    'days_after_planting' => $evalDef['dap'],
                    'weather_notes' => $evalDef['weather'],
                    'general_observations' => $evalDef['notes'],
                    'status' => 'approved',
                    'evaluator_id' => $this->fieldStaff->id,
                    'approved_by' => $this->researcher->id,
                    'approved_at' => now()->subDays(10),
                ]
            );

            if (!$eval->wasRecentlyCreated) continue;

            // Create or get block
            $block = TrialBlock::firstOrCreate(
                ['trial_id' => $trial->id, 'environment_id' => $env->id, 'block_number' => 1],
                ['block_label' => 'R1']
            );

            foreach ($evalDef['scores'] as $i => [$genoIdx, $severity, $note, $category]) {
                $genotype = $genotypes[$genoIdx] ?? $genotypes[0];

                $plot = TrialPlot::firstOrCreate(
                    ['trial_id' => $trial->id, 'environment_id' => $env->id,
                     'trial_block_id' => $block->id, 'genotype_id' => $genotype->id],
                    ['plot_code' => 'T-DR01-JTIC-R1-E' . str_pad($genoIdx + 1, 2, '0', STR_PAD_LEFT),
                     'entry_number' => $genoIdx + 1, 'plot_number' => $genoIdx + 1,
                     'row_position' => $genoIdx + 1, 'column_position' => 1,
                     'randomization_order' => $genoIdx + 1]
                );

                // Incidence from severity (rough approximation)
                $incidence = min(100, round($severity / 9 * 100, 1));

                DiseaseScore::firstOrCreate(
                    ['evaluation_id' => $eval->id, 'trial_plot_id' => $plot->id],
                    [
                        'genotype_id' => $genotype->id,
                        'trial_block_id' => $block->id,
                        'incidence_percent' => $incidence,
                        'severity_score' => $severity,
                        'intensity_percent' => round($incidence * $severity / 9, 2),
                        'plants_assessed' => 20,
                        'plants_affected' => round(20 * $incidence / 100),
                        'resistance_category' => $category,
                        'notes' => $note,
                    ]
                );
            }
        }
    }

    // ── 6. JADWAL PENGAMATAN ──────────────────────────────────────────────────

    private function seedObservationSchedules(array $trials, array $environments): void
    {
        $trial1 = $trials['T-MH2025-D01'] ?? Trial::where('trial_code', 'T-MH2025-D01')->first();
        $trial2 = $trials['T-MH2025-N01'] ?? Trial::where('trial_code', 'T-MH2025-N01')->first();
        $env1   = $environments['JTIC-MH2025'] ?? Environment::where('environment_code', 'JTIC-MH2025')->first();

        $schedules = [
            [
                'trial_id' => $trial1->id, 'environment_id' => $env1->id,
                'schedule_title' => 'Pengamatan Stadia Tasseling T-MH2025-D01',
                'observation_type' => 'phenotype', 'variable_category' => 'reproductive',
                'scheduled_date' => '2026-01-15', 'deadline_date' => '2026-01-20',
                'growth_stage_target' => 'tasseling_VT',
                'status' => 'completed', 'completion_date' => '2026-01-16',
                'completion_rate_percent' => 100.0,
                'instructions' => "Catat DTA (hari berbunga jantan) untuk semua plot.\nHitung persentase tanaman sudah tasseling.\nFoto 3 tanaman representatif per plot.",
                'reminder_days_before' => 3, 'reminder_sent' => true,
            ],
            [
                'trial_id' => $trial1->id, 'environment_id' => $env1->id,
                'schedule_title' => 'Pengamatan Silking dan ASI T-MH2025-D01',
                'observation_type' => 'phenotype', 'variable_category' => 'reproductive',
                'scheduled_date' => '2026-01-20', 'deadline_date' => '2026-01-25',
                'growth_stage_target' => 'silking_R1',
                'status' => 'completed', 'completion_date' => '2026-01-21',
                'completion_rate_percent' => 95.2,
                'instructions' => "Catat DTS (hari berbunga betina).\nHitung ASI = DTS - DTA.\nCatat persentase tanaman sudah silking.",
                'reminder_days_before' => 3, 'reminder_sent' => true,
            ],
            [
                'trial_id' => $trial1->id, 'environment_id' => $env1->id,
                'schedule_title' => 'Pengamatan Panen dan Komponen Hasil T-MH2025-D01',
                'observation_type' => 'yield_harvest', 'variable_category' => 'yield_components',
                'scheduled_date' => '2026-03-15', 'deadline_date' => '2026-03-22',
                'growth_stage_target' => 'maturity_R6',
                'status' => 'in_progress', 'completion_rate_percent' => 60.0,
                'instructions' => "Timbang bobot tongkol segar per plot.\nKupas klobot, ukur panjang dan diameter tongkol.\nHitung baris biji dan biji per baris.\nSample 5 tongkol per plot untuk penimbangan kering.",
                'reminder_days_before' => 5, 'reminder_sent' => true,
            ],
            [
                'trial_id' => $trial2->id, 'environment_id' => $env1->id,
                'schedule_title' => 'Evaluasi Penyakit Bulai T-MH2025-N01 Jatinangor',
                'observation_type' => 'disease_evaluation', 'variable_category' => 'disease',
                'scheduled_date' => '2026-01-10', 'deadline_date' => '2026-01-15',
                'growth_stage_target' => 'vegetative_V7_V12',
                'status' => 'pending',
                'instructions' => "Hitung % tanaman bergejala bulai per plot.\nFoto gejala klorosis sistemik.\nCatat kondisi cuaca hari evaluasi.",
                'reminder_days_before' => 2, 'reminder_sent' => false,
            ],
            [
                'trial_id' => $trial2->id, 'environment_id' => $env1->id,
                'schedule_title' => 'Pengamatan Vegetatif Awal T-MH2025-N01 (20 HST)',
                'observation_type' => 'phenotype', 'variable_category' => 'vegetative',
                'scheduled_date' => '2025-12-10', 'deadline_date' => '2025-12-15',
                'growth_stage_target' => 'vegetative_V1_V6',
                'status' => 'missed',
                'instructions' => "Hitung jumlah daun dan ukur tinggi tanaman pada 20 HST.\nCatat persentase tumbuh (emergence rate).",
                'reminder_days_before' => 3, 'reminder_sent' => true,
            ],
        ];

        foreach ($schedules as $def) {
            $def['assigned_to'] = $this->fieldStaff->id;
            $def['created_by'] = $this->researcher->id;
            ObservationSchedule::firstOrCreate(
                ['trial_id' => $def['trial_id'], 'schedule_title' => $def['schedule_title']],
                $def
            );
        }
    }

    // ── 7. KEGIATAN LAPANG ────────────────────────────────────────────────────

    private function seedFieldActivities(array $trials): void
    {
        $trial1 = $trials['T-MH2025-D01'] ?? Trial::where('trial_code', 'T-MH2025-D01')->first();
        $trial2 = $trials['T-MH2025-N01'] ?? Trial::where('trial_code', 'T-MH2025-N01')->first();
        $locJtic = $this->loc('JTIC001');

        $activities = [
            [
                'activity_code' => 'ACT-DEMO-001',
                'activity_type' => 'soil_preparation',
                'activity_title' => 'Pengolahan Tanah dan Pembuatan Bedengan Percobaan MH2025',
                'description' => 'Pengolahan tanah dua kali menggunakan bajak putar. Pembuatan plot percobaan sesuai layout RCBD. Pembuatan saluran drainase antar blok. Pasang patok plot dan label genotipe.',
                'activity_date' => '2025-11-01', 'start_time' => '07:00', 'end_time' => '17:00',
                'latitude' => -6.9272, 'longitude' => 107.7705,
                'status' => 'approved',
                'materials_used' => [
                    ['item' => 'Kapur pertanian (dolomit)', 'quantity' => 200, 'unit' => 'kg'],
                    ['item' => 'Pupuk kandang sapi', 'quantity' => 500, 'unit' => 'kg'],
                    ['item' => 'Patok bambu', 'quantity' => 300, 'unit' => 'batang'],
                ],
                'weather_conditions' => ['temperature' => 26, 'humidity' => 72, 'condition' => 'cerah berawan'],
                'trial_id' => $trial1->id, 'location_id' => $locJtic->id,
            ],
            [
                'activity_code' => 'ACT-DEMO-002',
                'activity_type' => 'planting',
                'activity_title' => 'Penanaman Benih Percobaan T-MH2025-D01',
                'description' => 'Penanaman benih secara tugal, 2 biji per lubang. Jarak tanam 75×20 cm. Setiap plot terdiri dari 4 baris tanaman panjang 6 meter. Benih direndam fungisida 2 jam sebelum tanam. Distribusi benih dilakukan oleh petugas per genotipe untuk menghindari kontaminasi.',
                'activity_date' => '2025-11-15', 'start_time' => '06:30', 'end_time' => '16:00',
                'latitude' => -6.9272, 'longitude' => 107.7705,
                'status' => 'approved',
                'materials_used' => [
                    ['item' => 'Benih jagung (14 genotipe)', 'quantity' => 840, 'unit' => 'gram'],
                    ['item' => 'Fungisida Thiram', 'quantity' => 0.5, 'unit' => 'kg'],
                    ['item' => 'Pupuk NPK (15-15-15) starter', 'quantity' => 42, 'unit' => 'kg'],
                ],
                'weather_conditions' => ['temperature' => 27, 'humidity' => 68, 'rainfall' => 0, 'condition' => 'cerah'],
                'trial_id' => $trial1->id, 'location_id' => $locJtic->id,
            ],
            [
                'activity_code' => 'ACT-DEMO-003',
                'activity_type' => 'fertilizer_application',
                'activity_title' => 'Pemupukan Susulan I (30 HST) T-MH2025-D01 dan T-MH2025-N01',
                'description' => 'Aplikasi pupuk susulan pertama pada 30 HST. Pupuk diberikan secara larikan di samping tanaman, ditutup tanah. Sekaligus pembumbunan ringan. Dosis sesuai rekomendasi: Urea 100 kg/ha + KCl 50 kg/ha.',
                'activity_date' => '2025-12-15', 'start_time' => '07:30', 'end_time' => '15:30',
                'latitude' => -6.9272, 'longitude' => 107.7705,
                'status' => 'approved',
                'materials_used' => [
                    ['item' => 'Urea 46%', 'quantity' => 18, 'unit' => 'kg'],
                    ['item' => 'KCl 60%', 'quantity' => 9, 'unit' => 'kg'],
                ],
                'weather_conditions' => ['temperature' => 25, 'humidity' => 80, 'rainfall' => 5, 'condition' => 'mendung ringan'],
                'trial_id' => $trial1->id, 'location_id' => $locJtic->id,
            ],
            [
                'activity_code' => 'ACT-DEMO-004',
                'activity_type' => 'pollination',
                'activity_title' => 'Penyerbukan Buatan untuk Pembentukan Benih F1 Hibrida',
                'description' => 'Penyerbukan silang terkontrol untuk pembuatan benih F1 dari 3 kombinasi persilangan harapan. Metode kantong kertas (bagging) untuk isolasi. Pengumpulan tepung sari pagi hari (06:00-08:00), penyerbukan pukul 07:00-10:00. Total 120 tongkol betina diserbuki.',
                'activity_date' => '2026-01-18', 'start_time' => '06:00', 'end_time' => '11:00',
                'latitude' => -6.9272, 'longitude' => 107.7705,
                'status' => 'approved',
                'materials_used' => [
                    ['item' => 'Kantong kertas isolasi', 'quantity' => 240, 'unit' => 'buah'],
                    ['item' => 'Label plastik', 'quantity' => 120, 'unit' => 'buah'],
                    ['item' => 'Rubber band', 'quantity' => 500, 'unit' => 'buah'],
                ],
                'weather_conditions' => ['temperature' => 22, 'humidity' => 88, 'condition' => 'cerah pagi, mendung siang'],
                'trial_id' => $trial1->id, 'location_id' => $locJtic->id,
            ],
            [
                'activity_code' => 'ACT-DEMO-005',
                'activity_type' => 'harvesting',
                'activity_title' => 'Panen Percobaan T-MH2025-D01 Jatinangor — Blok R1 dan R2',
                'description' => 'Panen dilakukan secara manual pada tingkat masak fisiologis (black layer terbentuk). Seluruh tongkol per plot dipanen sekaligus, ditimbang bobot segar, lalu dikupas klobotnya. Sampling 5 tongkol per plot untuk pengukuran komponen hasil. Benih disimpan dalam kantong mesh berlabel untuk pengeringan lebih lanjut.',
                'activity_date' => '2026-03-18', 'start_time' => '07:00', 'end_time' => '17:00',
                'latitude' => -6.9272, 'longitude' => 107.7705,
                'status' => 'submitted',
                'materials_used' => [
                    ['item' => 'Kantong mesh plastik berlabel', 'quantity' => 84, 'unit' => 'buah'],
                    ['item' => 'Timbangan digital (2kg)', 'quantity' => 3, 'unit' => 'unit'],
                    ['item' => 'Tali rafia', 'quantity' => 2, 'unit' => 'gulung'],
                ],
                'weather_conditions' => ['temperature' => 28, 'humidity' => 65, 'condition' => 'cerah panas'],
                'trial_id' => $trial2->id, 'location_id' => $locJtic->id,
            ],
        ];

        foreach ($activities as $def) {
            $def['user_id'] = $this->fieldStaff->id;
            if ($def['status'] === 'approved') {
                $def['approved_by'] = $this->researcher->id;
                $def['approved_at'] = now()->subDays(rand(3, 20));
            }
            FieldActivity::firstOrCreate(
                ['activity_code' => $def['activity_code']],
                $def
            );
        }
    }

    // ── 8. INVENTARIS BENIH (50 items via import-style direct insert) ─────────

    private function seedSeedInventories(array $storageUnits, array $seasons, array $trials): void
    {
        if (SeedInventory::count() >= 30) {
            $this->command->warn('  Sudah ada inventaris benih, skip.');
            return;
        }

        $genotypes = Genotype::where('status', 'active')->inRandomOrder()->limit(20)->get();
        $units = StorageUnit::all();
        $mh2025 = $seasons['MH2025'] ?? Season::where('season_code', 'MH2025')->first();
        $trial  = $trials['T-MH2024-DR01'] ?? Trial::where('trial_code', 'T-MH2024-DR01')->first();

        $racks  = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2'];
        $boxes  = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
        $statuses = ['good', 'good', 'good', 'good', 'good', 'warning', 'good', 'good', 'good', 'critical'];

        $inventoryData = [];

        // Generate 50 sample entries
        for ($i = 1; $i <= 50; $i++) {
            $genotype = $genotypes[($i - 1) % $genotypes->count()];
            $unit     = $units[($i - 1) % $units->count()];
            $rack     = $racks[$i % count($racks)];
            $box      = $boxes[$i % count($boxes)];
            $status   = $statuses[$i % count($statuses)];

            // Realistic weight based on seed type
            $isInbred = $genotype->category === 'inbred_line';
            $baseWeight = $isInbred ? rand(80, 300) : rand(200, 800);
            $remaining  = rand((int)($baseWeight * 0.3), $baseWeight);
            $moisture   = round(rand(105, 145) / 10, 1); // 10.5 – 14.5%
            $germination = round(rand(780, 980) / 10, 1); // 78.0 – 98.0%

            $harvestDays = rand(90, 540); // 3–18 months ago
            $harvestDate = now()->subDays($harvestDays)->format('Y-m-d');
            $storageDate = now()->subDays($harvestDays - rand(1, 14))->format('Y-m-d');
            $expiryDate  = now()->addMonths(rand(6, 36))->format('Y-m-d');

            // Adjust status based on moisture
            if ($moisture > 14) $status = 'warning';
            if ($moisture > 15) $status = 'critical';
            if ($remaining <= 0) { $remaining = 0; $status = 'depleted'; }

            $pkgCode = 'PKG-' . date('Y') . '-' . str_pad($i, 4, '0', STR_PAD_LEFT);
            $qrCode  = 'QR-' . strtoupper(Str::random(10));
            $barcode = 'BC-' . str_pad($i + 1000, 8, '0', STR_PAD_LEFT);

            $inventoryData[] = [
                'package_code'          => $pkgCode,
                'qr_code'               => $qrCode,
                'barcode'               => $barcode,
                'genotype_id'           => $genotype->id,
                'storage_unit_id'       => $unit->id,
                'rack_label'            => $rack,
                'box_number'            => $box,
                'row_position'          => (string) rand(1, 5),
                'column_position'       => (string) rand(1, 5),
                'season_id'             => $mh2025->id,
                'source_trial_id'       => ($i % 3 === 0) ? $trial?->id : null,
                'harvest_date'          => $harvestDate,
                'storage_date'          => $storageDate,
                'expiry_date'           => $expiryDate,
                'initial_weight_g'      => $baseWeight,
                'remaining_weight_g'    => $remaining,
                'moisture_content'      => $moisture,
                'germination_percentage'=> $germination,
                'germination_test_date' => now()->subDays($harvestDays - 20)->format('Y-m-d'),
                'vigor_index'           => round(rand(60, 95) / 10, 1),
                'seed_count'            => round($remaining * rand(200, 350) / 100),
                'storage_status'        => $status,
                'notes'                 => $i % 5 === 0 ? 'Benih hasil pemurnian seleksi massa tahap ke-' . rand(2, 5) : null,
                'created_by'            => $this->storageOfficer->id,
            ];
        }

        foreach ($inventoryData as $inv) {
            $existing = SeedInventory::where('package_code', $inv['package_code'])->first();
            if ($existing) continue;

            $inventory = SeedInventory::create($inv);

            // Create mandatory in_initial movement (mirrors the import pipeline)
            SeedMovement::create([
                'movement_code'      => 'MOV-INIT-' . $inventory->package_code,
                'seed_inventory_id'  => $inventory->id,
                'movement_type'      => 'in_initial',
                'quantity_g'         => $inv['initial_weight_g'],
                'balance_after_g'    => $inv['remaining_weight_g'],
                'to_storage_unit_id' => $inv['storage_unit_id'],
                'movement_date'      => $inv['storage_date'],
                'reason'             => 'Import data historis inventaris benih MH2025',
                'notes'              => 'Diinput via seeder demo data',
                'performed_by'       => $this->storageOfficer->id,
                'approved_by'        => $this->researcher->id,
                'approved_at'        => now(),
            ]);

            // Add a sample withdrawal movement for some packages
            if ($inv['remaining_weight_g'] < $inv['initial_weight_g'] && rand(0, 1)) {
                $used = $inv['initial_weight_g'] - $inv['remaining_weight_g'];
                SeedMovement::create([
                    'movement_code'      => 'MOV-OUT-' . $inventory->package_code,
                    'seed_inventory_id'  => $inventory->id,
                    'movement_type'      => 'out_planting',
                    'quantity_g'         => $used,
                    'balance_after_g'    => $inv['remaining_weight_g'],
                    'from_storage_unit_id' => $inv['storage_unit_id'],
                    'movement_date'      => now()->subDays(rand(10, 60))->format('Y-m-d'),
                    'destination'        => 'Kebun Percobaan Jatinangor',
                    'reason'             => 'Penggunaan untuk penanaman percobaan musim hujan 2025/2026',
                    'performed_by'       => $this->storageOfficer->id,
                    'approved_by'        => $this->researcher->id,
                    'approved_at'        => now(),
                ]);
            }
        }
    }

    // ── 9. CATATAN PENGELUARAN ─────────────────────────────────────────────────

    private function seedExpenses(array $trials, array $seasons): void
    {
        $trial1 = $trials['T-MH2025-D01'] ?? Trial::where('trial_code', 'T-MH2025-D01')->first();
        $trial2 = $trials['T-MH2025-N01'] ?? Trial::where('trial_code', 'T-MH2025-N01')->first();
        $mh2025 = $seasons['MH2025'] ?? Season::where('season_code', 'MH2025')->first();
        $categories = ExpenseCategory::all()->keyBy('category_code');

        // Create budget first
        $budget = Budget::firstOrCreate(
            ['budget_code' => 'BDG-MH2025-01'],
            [
                'budget_name' => 'Anggaran Penelitian Pemuliaan Jagung MH2025',
                'season_id' => $mh2025->id,
                'funding_source' => 'DIPA UNPAD 2025 – Program Riset Unggulan',
                'total_amount' => 125000000,
                'allocated_amount' => 125000000,
                'start_date' => '2025-10-01',
                'end_date' => '2026-06-30',
                'status' => 'active',
                'notes' => 'Anggaran utama program pemuliaan jagung tahun anggaran 2025. Mencakup 2 trial utama di Jatinangor.',
                'created_by' => $this->researcher->id,
            ]
        );

        $expenses = [
            [
                'expense_code' => 'EXP-2025-001',
                'category_id' => $categories['FIELD_OPS']->id,
                'budget_id' => $budget->id,
                'trial_id' => $trial1->id,
                'season_id' => $mh2025->id,
                'title' => 'Pengolahan Lahan dan Pembuatan Plot Percobaan',
                'description' => 'Biaya sewa traktor roda dua untuk pengolahan tanah 2 kali. Upah tenaga kerja pembuatan plot, pemasangan patok, dan labeling genotipe selama 3 hari.',
                'amount' => 3500000,
                'payment_date' => '2025-11-05',
                'vendor' => 'Koperasi Tani Jatinangor',
                'vendor_contact' => '0812-3456-7890',
                'funding_source' => 'DIPA UNPAD 2025',
                'payment_method' => 'transfer',
                'reference_number' => 'TRF-2025-1105-001',
                'approval_status' => 'approved',
                'submitted_by' => $this->financeStaff->id,
                'approved_by' => $this->researcher->id,
                'approved_at' => now()->subDays(30),
            ],
            [
                'expense_code' => 'EXP-2025-002',
                'category_id' => $categories['FERTILIZER']->id,
                'budget_id' => $budget->id,
                'trial_id' => $trial1->id,
                'season_id' => $mh2025->id,
                'title' => 'Pupuk NPK, Urea, KCl dan Pupuk Organik untuk Percobaan MH2025',
                'description' => 'Pengadaan pupuk untuk dua kali pemupukan (basal dan susulan) untuk trial T-MH2025-D01 dan T-MH2025-N01. Pupuk organik untuk perbaikan kesuburan lahan.',
                'amount' => 8750000,
                'payment_date' => '2025-11-08',
                'vendor' => 'CV. Sarana Tani Mandiri',
                'vendor_contact' => '022-5678-9012',
                'funding_source' => 'DIPA UNPAD 2025',
                'payment_method' => 'transfer',
                'reference_number' => 'INV-STM-2025-0892',
                'approval_status' => 'approved',
                'submitted_by' => $this->financeStaff->id,
                'approved_by' => $this->researcher->id,
                'approved_at' => now()->subDays(28),
            ],
            [
                'expense_code' => 'EXP-2025-003',
                'category_id' => $categories['LABOR']->id,
                'budget_id' => $budget->id,
                'trial_id' => $trial1->id,
                'season_id' => $mh2025->id,
                'title' => 'Honorarium Teknisi dan Tenaga Harian Percobaan Lapang November-Desember 2025',
                'description' => 'Pembayaran honorarium 2 orang teknisi lapang dan 4 orang tenaga harian lepas untuk kegiatan penanaman, pemeliharaan, dan monitoring percobaan selama 2 bulan.',
                'amount' => 12000000,
                'payment_date' => '2026-01-05',
                'vendor' => 'Tenaga Harian Kontrak UNPAD',
                'payment_method' => 'transfer',
                'funding_source' => 'DIPA UNPAD 2025',
                'reference_number' => 'SK-HONOR-2025-112',
                'approval_status' => 'approved',
                'submitted_by' => $this->financeStaff->id,
                'approved_by' => $this->researcher->id,
                'approved_at' => now()->subDays(15),
            ],
            [
                'expense_code' => 'EXP-2025-004',
                'category_id' => $categories['LABORATORY']->id,
                'budget_id' => $budget->id,
                'trial_id' => $trial2->id,
                'season_id' => $mh2025->id,
                'title' => 'Biaya Analisis Tanah dan Kadar Air Benih – Lab Tanah Faperta',
                'description' => 'Analisis tanah lengkap (pH, N, P, K, C-organik, tekstur) dari 3 lokasi percobaan. Uji kadar air benih metode oven untuk 50 sampel paket benih. Biaya bahan kimia laboratorium.',
                'amount' => 4250000,
                'payment_date' => '2025-12-20',
                'vendor' => 'Laboratorium Tanah Faperta UNPAD',
                'funding_source' => 'DIPA UNPAD 2025',
                'payment_method' => 'transfer',
                'reference_number' => 'LABTAN-2025-1220-05',
                'approval_status' => 'pending',
                'submitted_by' => $this->financeStaff->id,
            ],
            [
                'expense_code' => 'EXP-2025-005',
                'category_id' => $categories['LOGISTICS']->id,
                'budget_id' => $budget->id,
                'trial_id' => $trial2->id,
                'season_id' => $mh2025->id,
                'title' => 'Transportasi dan Akomodasi Monitoring Lapang ke Arjasari dan Lembang',
                'description' => 'Biaya BBM kendaraan operasional dan sewa kendaraan untuk 3 kali kunjungan monitoring ke lokasi percobaan di Arjasari dan Lembang. Termasuk biaya makan lapang tim peneliti (8 orang × 3 hari).',
                'amount' => 5800000,
                'payment_date' => '2026-01-20',
                'vendor' => 'Unit Transportasi UNPAD',
                'funding_source' => 'DIPA UNPAD 2025',
                'payment_method' => 'cash',
                'reference_number' => 'KWITANSI-2026-0120-03',
                'approval_status' => 'revision_needed',
                'approval_notes' => 'Lampirkan bukti pembayaran BBM dan nota makan yang terperinci.',
                'submitted_by' => $this->financeStaff->id,
                'approved_by' => $this->researcher->id,
                'approved_at' => now()->subDays(5),
            ],
        ];

        foreach ($expenses as $def) {
            Expense::firstOrCreate(['expense_code' => $def['expense_code']], $def);
        }
    }

    // ── 10. PELEPASAN VARIETAS ─────────────────────────────────────────────────

    private function seedVarietyCandidates(): void
    {
        $genotypes = Genotype::where('status', 'active')->limit(10)->get();
        if ($genotypes->isEmpty()) return;

        $candidates = [
            [
                'candidate_code' => 'VC-DEMO-001',
                'genotype_id' => $genotypes[0]->id,
                'proposed_variety_name' => 'Hibrida Unpad Bernas-1',
                'status' => 'submitted_to_board',
                'evaluation_start_year' => 2023,
                'target_release_year' => 2026,
                'num_trial_years' => 3,
                'num_trial_locations' => 8,
                'avg_yield_t_ha' => 9.25,
                'yield_superiority_percent' => 18.5,
                'best_environment' => 'Jatinangor, dataran sedang 600-800 m dpl',
                'disease_resistance_summary' => [
                    ['disease_code' => 'BULAI', 'resistance_category' => 'tahan', 'avg_severity' => 1.8],
                    ['disease_code' => 'HAWAR_DAUN', 'resistance_category' => 'agak_tahan', 'avg_severity' => 3.2],
                    ['disease_code' => 'KARAT_DAUN', 'resistance_category' => 'moderat', 'avg_severity' => 4.5],
                ],
                'adaptation_zones' => 'Jawa Barat, Jawa Tengah, dataran sedang 400-900 m dpl, curah hujan 1500-2500 mm/tahun',
                'submission_number' => 'PPVTPP-2026-0234',
                'submission_date' => '2026-02-15',
                'remarks' => 'Kandidat terkuat program pemuliaan UNPAD. Unggul dalam hal hasil tinggi dan toleransi cekaman kekeringan.',
                'principal_breeder_id' => $this->researcher->id,
            ],
            [
                'candidate_code' => 'VC-DEMO-002',
                'genotype_id' => $genotypes[1]->id,
                'proposed_variety_name' => 'Hibrida Unpad Tegar-1',
                'status' => 'approved',
                'evaluation_start_year' => 2022,
                'target_release_year' => 2025,
                'num_trial_years' => 4,
                'num_trial_locations' => 12,
                'avg_yield_t_ha' => 8.75,
                'yield_superiority_percent' => 12.8,
                'best_environment' => 'Dataran rendah hingga menengah, kondisi tadah hujan',
                'disease_resistance_summary' => [
                    ['disease_code' => 'BULAI', 'resistance_category' => 'tahan', 'avg_severity' => 1.5],
                    ['disease_code' => 'BUSUK_BATANG', 'resistance_category' => 'tahan', 'avg_severity' => 3.0],
                ],
                'adaptation_zones' => 'Nasional — cocok untuk dataran rendah hingga menengah di seluruh Indonesia',
                'submission_number' => 'PPVTPP-2025-0512',
                'submission_date' => '2025-03-10',
                'release_date' => '2025-08-20',
                'release_decree_number' => 'SK Mentan No. 847/Kpts/SR.120/8/2025',
                'remarks' => 'SUDAH DILEPAS. Varietas pertama program pemuliaan jagung UNPAD yang resmi dilepas oleh Kementan.',
                'principal_breeder_id' => $this->researcher->id,
            ],
            [
                'candidate_code' => 'VC-DEMO-003',
                'genotype_id' => $genotypes[2]->id,
                'proposed_variety_name' => 'Hibrida Unpad Segar-1',
                'status' => 'under_evaluation',
                'evaluation_start_year' => 2024,
                'target_release_year' => 2028,
                'num_trial_years' => 2,
                'num_trial_locations' => 4,
                'avg_yield_t_ha' => null,
                'yield_superiority_percent' => null,
                'disease_resistance_summary' => [],
                'adaptation_zones' => 'Target: dataran rendah tropis, sistem tumpangsari',
                'remarks' => 'Kandidat jagung manis toleran naungan untuk sistem tumpangsari perkebunan. Masih dalam evaluasi awal.',
                'principal_breeder_id' => $this->researcher->id,
            ],
            [
                'candidate_code' => 'VC-DEMO-004',
                'genotype_id' => $genotypes[3]->id,
                'proposed_variety_name' => 'Hibrida Unpad Kuat-1',
                'status' => 'proposed',
                'evaluation_start_year' => 2023,
                'target_release_year' => 2027,
                'num_trial_years' => 3,
                'num_trial_locations' => 6,
                'avg_yield_t_ha' => 8.12,
                'yield_superiority_percent' => 9.5,
                'best_environment' => 'Dataran menengah, lahan kering',
                'disease_resistance_summary' => [
                    ['disease_code' => 'BULAI', 'resistance_category' => 'agak_tahan', 'avg_severity' => 2.8],
                    ['disease_code' => 'HAWAR_DAUN', 'resistance_category' => 'tahan', 'avg_severity' => 2.1],
                ],
                'adaptation_zones' => 'Jawa Barat dan Banten, lahan kering iklim kering',
                'remarks' => 'Diusulkan untuk uji nasional tahun 2026. Keunggulan utama: tahan Hawar Daun dan batang kuat.',
                'principal_breeder_id' => $this->researcher->id,
            ],
            [
                'candidate_code' => 'VC-DEMO-005',
                'genotype_id' => $genotypes[4]->id,
                'proposed_variety_name' => null,
                'status' => 'rejected',
                'evaluation_start_year' => 2021,
                'target_release_year' => 2024,
                'num_trial_years' => 3,
                'num_trial_locations' => 7,
                'avg_yield_t_ha' => 7.45,
                'yield_superiority_percent' => 4.2,
                'disease_resistance_summary' => [
                    ['disease_code' => 'BULAI', 'resistance_category' => 'rentan', 'avg_severity' => 5.8],
                ],
                'adaptation_zones' => 'Tidak direkomendasikan',
                'remarks' => 'Ditolak oleh Tim Penilai karena superioritas hasil tidak cukup signifikan (< 5%) dan rentan terhadap penyakit Bulai di dataran rendah lembab.',
                'principal_breeder_id' => $this->researcher->id,
            ],
        ];

        foreach ($candidates as $def) {
            VarietyCandidate::firstOrCreate(
                ['candidate_code' => $def['candidate_code']],
                $def
            );
        }
    }
}
