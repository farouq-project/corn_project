<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Plot-level observations — replaces the old phenotype_observations.
 *
 * Every observation is anchored to:
 *   trial → environment → block → plot → genotype
 *
 * This structure is required for ANOVA, AMMI, GGE biplot, BLUP.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plot_observations', function (Blueprint $table) {
            $table->id();
            $table->string('observation_code', 40)->unique();

            // Full experimental context (denormalized for query performance)
            $table->foreignId('trial_plot_id')->constrained('trial_plots')->cascadeOnDelete();
            $table->foreignId('trial_id')->constrained('trials');
            $table->foreignId('environment_id')->constrained('environments');
            $table->foreignId('trial_block_id')->constrained('trial_blocks');
            $table->foreignId('genotype_id')->constrained('genotypes');

            // Observation metadata
            $table->date('observation_date');
            $table->enum('growth_stage', [
                'pre_emergence', 'emergence_vE', 'vegetative_V1_V6',
                'vegetative_V7_V12', 'tasseling_VT', 'silking_R1',
                'blister_R2', 'milk_R3', 'dough_R4', 'dent_R5',
                'maturity_R6', 'harvest'
            ])->nullable();
            $table->integer('days_after_planting')->nullable();

            // Data completeness tracking (for missing data alerts)
            $table->integer('total_variables_expected')->default(0);
            $table->integer('total_variables_filled')->default(0);

            // Workflow
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected'])->default('draft');
            $table->text('general_notes')->nullable();
            $table->json('photos')->nullable();

            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // One observation set per plot per growth stage per date
            $table->index(['trial_id', 'environment_id', 'genotype_id']);
            $table->index(['trial_plot_id', 'observation_date']);
            $table->index(['trial_id', 'growth_stage']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plot_observations');
    }
};
