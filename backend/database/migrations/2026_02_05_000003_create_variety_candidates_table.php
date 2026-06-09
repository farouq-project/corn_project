<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks genotypes going through the varietal release pipeline.
 * Aggregates multilocation performance for release submissions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('variety_candidates', function (Blueprint $table) {
            $table->id();
            $table->string('candidate_code', 30)->unique();
            $table->foreignId('genotype_id')->constrained('genotypes');
            $table->string('proposed_variety_name')->nullable();

            // Pipeline stage
            $table->enum('status', [
                'under_evaluation',     // Still in trial
                'proposed',             // Proposed for release
                'submitted_to_board',   // Submitted to release board
                'approved',             // Approved for release
                'released',             // Officially released
                'withdrawn',            // Withdrawn from process
                'rejected'
            ])->default('under_evaluation');

            // Performance summary (auto-calculated, stored for reporting)
            $table->year('evaluation_start_year')->nullable();
            $table->year('target_release_year')->nullable();
            $table->integer('num_trial_years')->default(0);
            $table->integer('num_trial_locations')->default(0);
            $table->decimal('avg_yield_t_ha', 6, 3)->nullable();
            $table->decimal('yield_superiority_percent', 6, 2)->nullable()
                ->comment('% superiority over best check');
            $table->string('best_environment')->nullable();

            // Disease resistance summary
            $table->json('disease_resistance_summary')->nullable()
                ->comment('{bulai: "tahan", hawar_daun: "agak_tahan", ...}');

            // Release documentation
            $table->string('submission_number')->nullable();
            $table->date('submission_date')->nullable();
            $table->date('release_date')->nullable();
            $table->string('release_decree_number')->nullable()
                ->comment('SK nomor pelepasan varietas');

            $table->text('adaptation_zones')->nullable()
                ->comment('recommended growing areas');
            $table->text('remarks')->nullable();

            $table->foreignId('principal_breeder_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'target_release_year']);
            $table->index('genotype_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('variety_candidates');
    }
};
