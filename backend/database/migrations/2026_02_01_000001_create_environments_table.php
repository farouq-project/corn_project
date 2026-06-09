<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An Environment is the unique combination of Location × Season.
 * This is the fundamental experimental unit for multilocation trials.
 * Environmental covariates (rainfall, soil, temp) attach here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('environments', function (Blueprint $table) {
            $table->id();
            $table->string('environment_code', 30)->unique();
            $table->foreignId('location_id')->constrained('locations');
            $table->foreignId('season_id')->constrained('seasons');

            // Physical/geographic metadata
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->integer('elevation_m')->nullable()->comment('meters above sea level');

            // Agronomic metadata
            $table->string('irrigation_type', 50)->nullable()->comment('rainfed,irrigated,supplemental');
            $table->text('land_history')->nullable()->comment('previous crop, years of use');
            $table->string('soil_type', 100)->nullable();

            // Summary environmental data (can be populated from APIs)
            $table->decimal('total_rainfall_mm', 8, 2)->nullable();
            $table->decimal('avg_temperature_c', 5, 2)->nullable();
            $table->decimal('avg_humidity_percent', 5, 2)->nullable();
            $table->date('planting_date')->nullable();
            $table->date('harvest_date')->nullable();

            // Data source tracking
            $table->enum('env_data_source', ['manual', 'nasa_power', 'meteostat', 'bmkg', 'mixed'])
                ->default('manual');
            $table->json('api_metadata')->nullable()->comment('raw API response cache');

            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['location_id', 'season_id']);
            $table->index(['season_id', 'location_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('environments');
    }
};
