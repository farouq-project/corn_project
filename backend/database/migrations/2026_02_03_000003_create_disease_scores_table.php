<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-plot disease scores within an evaluation session.
 *
 * Key metrics:
 *  - incidence: % of plants showing symptoms
 *  - severity: score on the disease scale (1-9 or 1-5)
 *  - intensity: combined = incidence × severity (for AUDPC)
 *  - resistance_category: classification result
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disease_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')
                ->constrained('disease_evaluations')
                ->cascadeOnDelete();
            $table->foreignId('trial_plot_id')->constrained('trial_plots');

            // Denormalized for fast querying
            $table->foreignId('genotype_id')->constrained('genotypes');
            $table->foreignId('trial_block_id')->constrained('trial_blocks');

            // Disease metrics
            $table->decimal('incidence_percent', 5, 2)->nullable()
                ->comment('% plants with symptoms (0–100)');
            $table->decimal('severity_score', 5, 2)->nullable()
                ->comment('score on the defined scale (1-9, 1-5, or %)');
            $table->decimal('intensity_percent', 5, 2)->nullable()
                ->comment('disease intensity = incidence × severity / max_score');

            // Symptom tracking
            $table->date('symptom_first_seen')->nullable();
            $table->integer('plants_assessed')->nullable();
            $table->integer('plants_affected')->nullable();

            // Resistance classification
            $table->enum('resistance_category', [
                'tahan',        // Resistant
                'agak_tahan',   // Moderately Resistant
                'moderat',      // Moderate
                'rentan',       // Susceptible
                'sangat_rentan' // Highly Susceptible
            ])->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['evaluation_id', 'trial_plot_id'], 'unique_score_per_plot');
            $table->index(['evaluation_id', 'genotype_id']);
            $table->index('resistance_category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disease_scores');
    }
};
