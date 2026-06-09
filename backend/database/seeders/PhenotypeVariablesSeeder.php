<?php

namespace Database\Seeders;

use App\Models\PhenotypeVariable;
use Illuminate\Database\Seeder;

class PhenotypeVariablesSeeder extends Seeder
{
    public function run(): void
    {
        $variables = [
            // Vegetative Traits
            ['variable_code' => 'PH', 'variable_name' => 'Tinggi Tanaman', 'abbreviation' => 'PH', 'category' => 'vegetative', 'data_type' => 'numeric', 'unit' => 'cm', 'min_value' => 50, 'max_value' => 400, 'decimal_places' => 1, 'sort_order' => 1],
            ['variable_code' => 'LN', 'variable_name' => 'Jumlah Daun', 'abbreviation' => 'LN', 'category' => 'vegetative', 'data_type' => 'integer', 'unit' => 'helai', 'min_value' => 5, 'max_value' => 25, 'decimal_places' => 0, 'sort_order' => 2],
            ['variable_code' => 'SD', 'variable_name' => 'Diameter Batang', 'abbreviation' => 'SD', 'category' => 'vegetative', 'data_type' => 'numeric', 'unit' => 'cm', 'min_value' => 1, 'max_value' => 6, 'decimal_places' => 2, 'sort_order' => 3],
            ['variable_code' => 'CCI', 'variable_name' => 'Indeks Klorofil (SPAD)', 'abbreviation' => 'CCI', 'category' => 'vegetative', 'data_type' => 'numeric', 'unit' => 'SPAD', 'min_value' => 20, 'max_value' => 80, 'decimal_places' => 1, 'sort_order' => 4],
            ['variable_code' => 'LS', 'variable_name' => 'Skor Rebah Batang', 'abbreviation' => 'LS', 'category' => 'vegetative', 'data_type' => 'scale', 'unit' => '1-5', 'min_value' => 1, 'max_value' => 5, 'decimal_places' => 0, 'sort_order' => 5],

            // Reproductive Traits
            ['variable_code' => 'DTA', 'variable_name' => 'Umur Berbunga Jantan (Tasseling)', 'abbreviation' => 'DTA', 'category' => 'reproductive', 'data_type' => 'integer', 'unit' => 'HST', 'min_value' => 45, 'max_value' => 90, 'decimal_places' => 0, 'sort_order' => 10],
            ['variable_code' => 'DTS', 'variable_name' => 'Umur Berbunga Betina (Silking)', 'abbreviation' => 'DTS', 'category' => 'reproductive', 'data_type' => 'integer', 'unit' => 'HST', 'min_value' => 45, 'max_value' => 95, 'decimal_places' => 0, 'sort_order' => 11],
            ['variable_code' => 'ASI', 'variable_name' => 'Selang Anthesis-Silking', 'abbreviation' => 'ASI', 'category' => 'reproductive', 'data_type' => 'integer', 'unit' => 'hari', 'min_value' => -5, 'max_value' => 15, 'decimal_places' => 0, 'sort_order' => 12],

            // Ear Characteristics
            ['variable_code' => 'EL', 'variable_name' => 'Panjang Tongkol', 'abbreviation' => 'EL', 'category' => 'ear_characteristics', 'data_type' => 'numeric', 'unit' => 'cm', 'min_value' => 5, 'max_value' => 35, 'decimal_places' => 1, 'sort_order' => 20],
            ['variable_code' => 'ED', 'variable_name' => 'Diameter Tongkol', 'abbreviation' => 'ED', 'category' => 'ear_characteristics', 'data_type' => 'numeric', 'unit' => 'cm', 'min_value' => 2, 'max_value' => 8, 'decimal_places' => 2, 'sort_order' => 21],
            ['variable_code' => 'KRN', 'variable_name' => 'Jumlah Baris Biji', 'abbreviation' => 'KRN', 'category' => 'ear_characteristics', 'data_type' => 'integer', 'unit' => 'baris', 'min_value' => 8, 'max_value' => 22, 'decimal_places' => 0, 'sort_order' => 22],
            ['variable_code' => 'KPR', 'variable_name' => 'Biji per Baris', 'abbreviation' => 'KPR', 'category' => 'ear_characteristics', 'data_type' => 'integer', 'unit' => 'biji', 'min_value' => 15, 'max_value' => 50, 'decimal_places' => 0, 'sort_order' => 23],
            ['variable_code' => 'HC', 'variable_name' => 'Skor Penutupan Klobot', 'abbreviation' => 'HC', 'category' => 'ear_characteristics', 'data_type' => 'scale', 'unit' => '1-5', 'min_value' => 1, 'max_value' => 5, 'decimal_places' => 0, 'sort_order' => 24],

            // Yield Components
            ['variable_code' => 'FEWE', 'variable_name' => 'Bobot Tongkol Segar', 'abbreviation' => 'FEWE', 'category' => 'yield_components', 'data_type' => 'numeric', 'unit' => 'g', 'min_value' => 50, 'max_value' => 500, 'decimal_places' => 1, 'sort_order' => 30],
            ['variable_code' => 'DSW', 'variable_name' => 'Bobot Biji Kering', 'abbreviation' => 'DSW', 'category' => 'yield_components', 'data_type' => 'numeric', 'unit' => 'g', 'min_value' => 50, 'max_value' => 400, 'decimal_places' => 2, 'sort_order' => 31],
            ['variable_code' => 'BM', 'variable_name' => 'Biomassa Total', 'abbreviation' => 'BM', 'category' => 'yield_components', 'data_type' => 'numeric', 'unit' => 'g', 'min_value' => 100, 'max_value' => 2000, 'decimal_places' => 1, 'sort_order' => 32],
            ['variable_code' => 'HI', 'variable_name' => 'Indeks Panen', 'abbreviation' => 'HI', 'category' => 'yield_components', 'data_type' => 'numeric', 'unit' => '', 'min_value' => 0.1, 'max_value' => 0.7, 'decimal_places' => 3, 'sort_order' => 33],
            ['variable_code' => 'YIELD', 'variable_name' => 'Hasil (t/ha)', 'abbreviation' => 'YIELD', 'category' => 'yield_components', 'data_type' => 'numeric', 'unit' => 't/ha', 'min_value' => 1, 'max_value' => 15, 'decimal_places' => 2, 'is_required' => true, 'sort_order' => 34],

            // Stress Response
            ['variable_code' => 'DTS_S', 'variable_name' => 'Skor Toleransi Kekeringan', 'abbreviation' => 'DTS', 'category' => 'stress_response', 'data_type' => 'scale', 'unit' => '1-9', 'min_value' => 1, 'max_value' => 9, 'decimal_places' => 0, 'sort_order' => 40],
            ['variable_code' => 'STS', 'variable_name' => 'Skor Toleransi Naungan', 'abbreviation' => 'STS', 'category' => 'stress_response', 'data_type' => 'scale', 'unit' => '1-9', 'min_value' => 1, 'max_value' => 9, 'decimal_places' => 0, 'sort_order' => 41],
            ['variable_code' => 'DS', 'variable_name' => 'Skor Penyakit', 'abbreviation' => 'DS', 'category' => 'stress_response', 'data_type' => 'scale', 'unit' => '1-9', 'min_value' => 1, 'max_value' => 9, 'decimal_places' => 0, 'sort_order' => 42],
            ['variable_code' => 'PS', 'variable_name' => 'Skor Serangan Hama', 'abbreviation' => 'PS', 'category' => 'stress_response', 'data_type' => 'scale', 'unit' => '1-9', 'min_value' => 1, 'max_value' => 9, 'decimal_places' => 0, 'sort_order' => 43],

            // Seed Characteristics
            ['variable_code' => 'SMC', 'variable_name' => 'Kadar Air Benih', 'abbreviation' => 'SMC', 'category' => 'seed_characteristics', 'data_type' => 'numeric', 'unit' => '%', 'min_value' => 8, 'max_value' => 30, 'decimal_places' => 2, 'sort_order' => 50],
            ['variable_code' => 'SV', 'variable_name' => 'Vigor Benih', 'abbreviation' => 'SV', 'category' => 'seed_characteristics', 'data_type' => 'numeric', 'unit' => '%', 'min_value' => 0, 'max_value' => 100, 'decimal_places' => 1, 'sort_order' => 51],
            ['variable_code' => 'GP', 'variable_name' => 'Daya Kecambah (%)', 'abbreviation' => 'GP', 'category' => 'seed_characteristics', 'data_type' => 'numeric', 'unit' => '%', 'min_value' => 0, 'max_value' => 100, 'decimal_places' => 1, 'sort_order' => 52],
        ];

        foreach ($variables as $var) {
            PhenotypeVariable::firstOrCreate(['variable_code' => $var['variable_code']], $var);
        }
    }
}
