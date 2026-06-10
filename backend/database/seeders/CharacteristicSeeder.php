<?php

namespace Database\Seeders;

use App\Models\Characteristic;
use App\Models\PhenotypeVariable;
use Illuminate\Database\Seeder;

class CharacteristicSeeder extends Seeder
{
    public function run(): void
    {
        foreach (PhenotypeVariable::all() as $variable) {
            Characteristic::firstOrCreate(
                ['code' => $variable->variable_code],
                [
                    'name' => $variable->variable_name,
                    'unit' => $variable->unit,
                    'group' => $variable->category,
                    'display_order' => $variable->sort_order ?? 0,
                    'decimal_places' => $variable->decimal_places ?? 2,
                    'is_active' => $variable->is_active,
                ]
            );
        }
    }
}
