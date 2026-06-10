<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per plot/replication, matching the researcher observation
 * spreadsheet: No Plot | Kode Gen | Gen | Environment | R | <characteristics...>
 *
 * Replaces the trial/plot-based phenotyping workflow for daily data entry.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('observation_records', function (Blueprint $table) {
            $table->id();
            $table->string('record_code', 40)->unique();

            $table->string('plot_no', 20)->comment('No Plot, free text from spreadsheet');
            $table->foreignId('genotype_id')->constrained('genotypes');
            $table->foreignId('environment_id')->constrained('environments');

            // Denormalized from environment.season_id for season-scoped queries
            // and to keep plot numbering disambiguated across seasons.
            $table->foreignId('season_id')->constrained('seasons');

            $table->integer('replication')->comment('R: 1, 2, 3...');

            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique(['environment_id', 'season_id', 'plot_no', 'replication'], 'unique_observation_record');
            $table->index(['genotype_id', 'environment_id', 'season_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('observation_records');
    }
};
