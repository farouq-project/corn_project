<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Daily weather records per location.
 * Can be populated manually, or via NASA POWER / Meteostat API.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weather_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained('locations');
            $table->date('record_date');
            $table->enum('source', ['manual', 'nasa_power', 'meteostat', 'bmkg', 'station'])
                ->default('manual');

            // Temperature (°C)
            $table->decimal('temp_max_c', 5, 2)->nullable();
            $table->decimal('temp_min_c', 5, 2)->nullable();
            $table->decimal('temp_avg_c', 5, 2)->nullable();

            // Precipitation
            $table->decimal('rainfall_mm', 7, 2)->nullable();

            // Humidity & solar
            $table->decimal('humidity_avg_percent', 5, 2)->nullable();
            $table->decimal('solar_radiation_mj_m2', 7, 3)->nullable();
            $table->decimal('wind_speed_m_s', 6, 3)->nullable();
            $table->decimal('wind_direction_deg', 5, 1)->nullable();
            $table->decimal('evapotranspiration_mm', 7, 3)->nullable()
                ->comment('ETo reference evapotranspiration');

            // Raw API payload for traceability
            $table->json('raw_data')->nullable();
            $table->string('api_request_id')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['location_id', 'record_date', 'source']);
            $table->index(['location_id', 'record_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weather_records');
    }
};
