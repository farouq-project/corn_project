<?php

namespace Database\Seeders;

use App\Models\DiseaseType;
use Illuminate\Database\Seeder;

class DiseaseTypesSeeder extends Seeder
{
    public function run(): void
    {
        $diseases = [
            [
                'disease_code' => 'BULAI',
                'disease_name' => 'Bulai',
                'disease_name_en' => 'Downy Mildew',
                'pathogen' => 'Peronosclerospora maydis',
                'disease_category' => 'fungal',
                'severity_scale' => '1_9',
                'scale_description' => [
                    ['score' => 1, 'label' => 'Tahan', 'description' => '0–5% tanaman terinfeksi'],
                    ['score' => 3, 'label' => 'Agak Tahan', 'description' => '6–25% tanaman terinfeksi'],
                    ['score' => 5, 'label' => 'Moderat', 'description' => '26–50% tanaman terinfeksi'],
                    ['score' => 7, 'label' => 'Rentan', 'description' => '51–75% tanaman terinfeksi'],
                    ['score' => 9, 'label' => 'Sangat Rentan', 'description' => '>75% tanaman terinfeksi'],
                ],
                'description' => 'Penyakit utama jagung di Indonesia, menyerang daun muda dan dapat membunuh tanaman.',
                'sort_order' => 1,
            ],
            [
                'disease_code' => 'HAWAR_DAUN',
                'disease_name' => 'Hawar Daun',
                'disease_name_en' => 'Northern Leaf Blight',
                'pathogen' => 'Exserohilum turcicum',
                'disease_category' => 'fungal',
                'severity_scale' => '1_9',
                'scale_description' => [
                    ['score' => 1, 'label' => 'Tahan', 'description' => 'Tidak ada lesi atau lesi sangat kecil'],
                    ['score' => 3, 'label' => 'Agak Tahan', 'description' => 'Lesi kecil-sedang, <25% luas daun'],
                    ['score' => 5, 'label' => 'Moderat', 'description' => 'Lesi sedang, 25-50% luas daun'],
                    ['score' => 7, 'label' => 'Rentan', 'description' => 'Lesi besar, 51-75% luas daun'],
                    ['score' => 9, 'label' => 'Sangat Rentan', 'description' => 'Lesi sangat besar, >75% luas daun'],
                ],
                'description' => 'Penyakit hawar daun utara, membentuk lesi memanjang berwarna cokelat keabu-abuan.',
                'sort_order' => 2,
            ],
            [
                'disease_code' => 'KARAT_DAUN',
                'disease_name' => 'Karat Daun',
                'disease_name_en' => 'Common Rust',
                'pathogen' => 'Puccinia sorghi',
                'disease_category' => 'fungal',
                'severity_scale' => '1_9',
                'scale_description' => [
                    ['score' => 1, 'label' => 'Tahan', 'description' => 'Pustul sangat sedikit/tidak ada'],
                    ['score' => 3, 'label' => 'Agak Tahan', 'description' => 'Pustul sedikit, tersebar'],
                    ['score' => 5, 'label' => 'Moderat', 'description' => 'Pustul sedang, merata'],
                    ['score' => 7, 'label' => 'Rentan', 'description' => 'Pustul banyak, menutup sebagian daun'],
                    ['score' => 9, 'label' => 'Sangat Rentan', 'description' => 'Pustul sangat banyak, daun mengering'],
                ],
                'description' => 'Penyakit karat daun umum, membentuk pustul berwarna cokelat kemerahan.',
                'sort_order' => 3,
            ],
            [
                'disease_code' => 'BUSUK_BATANG',
                'disease_name' => 'Busuk Batang',
                'disease_name_en' => 'Stalk Rot',
                'pathogen' => 'Fusarium moniliforme / Gibberella zeae',
                'disease_category' => 'fungal',
                'severity_scale' => 'percent',
                'scale_description' => [
                    ['score' => 0, 'label' => 'Tahan', 'description' => '0% tanaman terinfeksi'],
                    ['score' => 10, 'label' => 'Agak Tahan', 'description' => '1-10% tanaman terinfeksi'],
                    ['score' => 25, 'label' => 'Moderat', 'description' => '11-25% tanaman terinfeksi'],
                    ['score' => 50, 'label' => 'Rentan', 'description' => '26-50% tanaman terinfeksi'],
                    ['score' => 75, 'label' => 'Sangat Rentan', 'description' => '>50% tanaman terinfeksi'],
                ],
                'description' => 'Penyakit busuk batang oleh Fusarium/Gibberella, menyebabkan rebah dan kehilangan hasil.',
                'sort_order' => 4,
            ],
        ];

        foreach ($diseases as $disease) {
            DiseaseType::firstOrCreate(
                ['disease_code' => $disease['disease_code']],
                $disease
            );
        }
    }
}
