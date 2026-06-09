<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * EAV-style trait values per plot observation.
 * Normalized — one row per variable per observation.
 * Supports ANOVA queries: SELECT variable, genotype, environment, value.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plot_observation_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('observation_id')
                ->constrained('plot_observations')
                ->cascadeOnDelete();
            $table->foreignId('variable_id')
                ->constrained('phenotype_variables');

            // Value storage — numeric covers most; text for categorical/qualitative
            $table->decimal('numeric_value', 12, 4)->nullable();
            $table->string('text_value', 255)->nullable();

            // Statistical quality flags
            $table->boolean('is_outlier')->default(false);
            $table->text('outlier_note')->nullable();
            $table->boolean('is_missing')->default(false);
            $table->string('missing_reason', 100)->nullable()
                ->comment('plant_death, damage, measurement_error');

            $table->timestamps();

            $table->unique(['observation_id', 'variable_id'], 'unique_obs_variable');
            $table->index('variable_id');
            $table->index(['observation_id', 'is_outlier']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plot_observation_values');
    }
};
