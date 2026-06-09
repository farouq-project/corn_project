<?php

namespace Database\Seeders;

use App\Models\ExpenseCategory;
use App\Models\Location;
use App\Models\Season;
use App\Models\StorageUnit;
use App\Models\TrialType;
use Illuminate\Database\Seeder;

class MasterDataSeeder extends Seeder
{
    public function run(): void
    {
        // Seasons
        Season::firstOrCreate(['season_code' => 'MH2025'], [
            'season_name' => 'Musim Hujan 2025/2026',
            'start_date' => '2025-11-01',
            'end_date' => '2026-04-30',
            'status' => 'active',
        ]);
        Season::firstOrCreate(['season_code' => 'MK2026'], [
            'season_name' => 'Musim Kemarau 2026',
            'start_date' => '2026-05-01',
            'end_date' => '2026-10-31',
            'status' => 'upcoming',
        ]);

        // Locations
        Location::firstOrCreate(['field_code' => 'JTIC001'], [
            'field_name' => 'Kebun Percobaan Jatinangor',
            'latitude' => -6.9272,
            'longitude' => 107.7705,
            'altitude' => 750,
            'area_hectares' => 2.5,
            'village' => 'Cikeruh',
            'district' => 'Jatinangor',
            'regency' => 'Sumedang',
            'province' => 'Jawa Barat',
            'soil_type' => 'Latosol',
        ]);
        Location::firstOrCreate(['field_code' => 'ARCM001'], [
            'field_name' => 'Kebun Percobaan Arjasari - Cicalengka',
            'latitude' => -7.0854,
            'longitude' => 107.7223,
            'altitude' => 600,
            'area_hectares' => 1.8,
            'village' => 'Arjasari',
            'district' => 'Arjasari',
            'regency' => 'Bandung',
            'province' => 'Jawa Barat',
        ]);

        // Storage Units
        StorageUnit::firstOrCreate(['unit_code' => 'RF001'], [
            'unit_name' => 'Refrigerator Utama Lab 1',
            'unit_type' => 'refrigerator',
            'room_name' => 'Laboratorium Benih',
            'building' => 'Gedung Pemuliaan',
            'temperature_min' => 2,
            'temperature_max' => 8,
            'humidity_min' => 30,
            'humidity_max' => 50,
            'capacity_racks' => 6,
            'capacity_boxes_per_rack' => 20,
        ]);
        StorageUnit::firstOrCreate(['unit_code' => 'FZ001'], [
            'unit_name' => 'Freezer Penyimpanan Jangka Panjang',
            'unit_type' => 'freezer',
            'room_name' => 'Laboratorium Benih',
            'building' => 'Gedung Pemuliaan',
            'temperature_min' => -20,
            'temperature_max' => -18,
            'humidity_min' => 20,
            'humidity_max' => 40,
            'capacity_racks' => 4,
            'capacity_boxes_per_rack' => 15,
        ]);

        // Trial Types
        $trialTypes = [
            ['type_code' => 'DROUGHT', 'type_name' => 'Cekaman Kekeringan', 'description' => 'Uji toleransi kekeringan'],
            ['type_code' => 'SHADE', 'type_name' => 'Cekaman Naungan', 'description' => 'Uji toleransi naungan'],
            ['type_code' => 'NORMAL', 'type_name' => 'Kondisi Normal', 'description' => 'Uji kondisi optimum'],
            ['type_code' => 'FEED', 'type_name' => 'Jagung Pakan', 'description' => 'Uji untuk jagung pakan ternak'],
            ['type_code' => 'SWEET', 'type_name' => 'Jagung Manis', 'description' => 'Uji untuk jagung manis konsumsi'],
        ];

        foreach ($trialTypes as $type) {
            TrialType::firstOrCreate(['type_code' => $type['type_code']], $type);
        }

        // Expense Categories
        $categories = [
            ['category_code' => 'FIELD_OPS', 'category_name' => 'Operasi Lapang', 'color' => '#22c55e'],
            ['category_code' => 'LOGISTICS', 'category_name' => 'Logistik & Transportasi', 'color' => '#3b82f6'],
            ['category_code' => 'LABORATORY', 'category_name' => 'Laboratorium', 'color' => '#a855f7'],
            ['category_code' => 'EQUIPMENT', 'category_name' => 'Peralatan', 'color' => '#f59e0b'],
            ['category_code' => 'LABOR', 'category_name' => 'Tenaga Kerja', 'color' => '#ef4444'],
            ['category_code' => 'FERTILIZER', 'category_name' => 'Pupuk & Pestisida', 'color' => '#84cc16'],
            ['category_code' => 'IRRIGATION', 'category_name' => 'Irigasi', 'color' => '#06b6d4'],
            ['category_code' => 'ADMIN', 'category_name' => 'Administrasi', 'color' => '#6b7280'],
        ];

        foreach ($categories as $cat) {
            ExpenseCategory::firstOrCreate(['category_code' => $cat['category_code']], $cat);
        }
    }
}
