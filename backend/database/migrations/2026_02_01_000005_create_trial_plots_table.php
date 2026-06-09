<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * THE FUNDAMENTAL OBSERVATION UNIT.
 *
 * A plot is one genotype in one block in one environment.
 * For 14 genotypes × 3 replications × N locations:
 *   N × 14 × 3 = N×42 plots per trial.
 *
 * All observations (phenotype, disease, yield) link to a plot.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trial_plots', function (Blueprint $table) {
            $table->id();
            $table->string('plot_code', 40)->unique()
                ->comment('e.g. T001-JTIC-R1-E05 (trial-location-rep-entry)');

            // Experimental structure
            $table->foreignId('trial_id')->constrained('trials')->cascadeOnDelete();
            $table->foreignId('environment_id')->constrained('environments');
            $table->foreignId('trial_block_id')->constrained('trial_blocks');
            $table->foreignId('genotype_id')->constrained('genotypes');

            // Entry/treatment metadata
            $table->integer('entry_number')->comment('entry no. in the trial genotype list');
            $table->string('treatment_label', 30)->nullable();
            $table->boolean('is_check')->default(false)->comment('check/standard variety');

            // Spatial position
            $table->integer('plot_number')->comment('sequential plot number in the field');
            $table->integer('row_position')->nullable();
            $table->integer('column_position')->nullable();
            $table->integer('randomization_order')->nullable()
                ->comment('randomized field order for RCBD');

            // Plot dimensions
            $table->decimal('plot_length_m', 6, 2)->nullable();
            $table->decimal('plot_width_m', 6, 2)->nullable();
            $table->decimal('plant_spacing_cm', 5, 2)->nullable();
            $table->decimal('row_spacing_cm', 5, 2)->nullable();
            $table->integer('plants_per_plot')->nullable();

            // Status
            $table->enum('status', ['active', 'damaged', 'missing', 'excluded'])->default('active');
            $table->text('exclusion_reason')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            // Composite uniqueness: one genotype per block per environment
            $table->unique(['trial_id', 'environment_id', 'trial_block_id', 'genotype_id'],
                'unique_plot_assignment');

            $table->index(['trial_id', 'environment_id']);
            $table->index(['trial_id', 'genotype_id']);
            $table->index('trial_block_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_plots');
    }
};
