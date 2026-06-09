<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soil_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('environment_id')->constrained('environments');
            $table->date('sample_date');
            $table->string('sample_depth_cm', 20)->nullable()->comment('e.g. 0-20, 20-40');
            $table->string('lab_name')->nullable();
            $table->string('lab_reference')->nullable();

            // Chemical properties
            $table->decimal('ph_h2o', 4, 2)->nullable();
            $table->decimal('ph_kcl', 4, 2)->nullable();
            $table->decimal('organic_c_percent', 6, 3)->nullable();
            $table->decimal('organic_matter_percent', 6, 3)->nullable();
            $table->decimal('total_n_percent', 6, 4)->nullable();
            $table->decimal('available_p_ppm', 8, 3)->nullable();
            $table->decimal('available_k_ppm', 8, 3)->nullable();
            $table->decimal('cation_exchange_capacity', 8, 3)->nullable()
                ->comment('CEC in cmol/kg');

            // Physical properties
            $table->decimal('sand_percent', 5, 2)->nullable();
            $table->decimal('silt_percent', 5, 2)->nullable();
            $table->decimal('clay_percent', 5, 2)->nullable();
            $table->string('texture_class', 50)->nullable()
                ->comment('sandy loam, clay loam, etc.');
            $table->decimal('bulk_density_g_cm3', 5, 3)->nullable();

            // Nutrient levels (can be expanded)
            $table->json('micronutrients')->nullable()
                ->comment('{Fe, Mn, Cu, Zn, B} in ppm');

            $table->string('document_path')->nullable()
                ->comment('uploaded lab report PDF');
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['environment_id', 'sample_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soil_analyses');
    }
};
