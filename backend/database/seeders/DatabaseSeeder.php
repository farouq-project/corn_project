<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            UsersSeeder::class,
            MasterDataSeeder::class,
            PhenotypeVariablesSeeder::class,
            DiseaseTypesSeeder::class,
            DemoDataSeeder::class,
        ]);
    }
}
