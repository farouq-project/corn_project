<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A disease evaluation session — one evaluator scores all plots in an environment
 * for one disease type on one date.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disease_evaluations', function (Blueprint $table) {
            $table->id();
            $table->string('evaluation_code', 30)->unique();
            $table->foreignId('trial_id')->constrained('trials');
            $table->foreignId('environment_id')->constrained('environments');
            $table->foreignId('disease_type_id')->constrained('disease_types');
            $table->date('evaluation_date');
            $table->enum('growth_stage', [
                'vegetative_V1_V6', 'vegetative_V7_V12', 'tasseling_VT',
                'silking_R1', 'blister_R2', 'milk_R3', 'dough_R4',
                'dent_R5', 'maturity_R6'
            ])->nullable();
            $table->integer('days_after_planting')->nullable();

            // Evaluation context
            $table->text('weather_notes')->nullable()
                ->comment('weather conditions during evaluation');
            $table->text('general_observations')->nullable();
            $table->json('photos')->nullable();

            $table->enum('status', ['draft', 'submitted', 'approved'])->default('draft');
            $table->foreignId('evaluator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['trial_id', 'environment_id', 'disease_type_id']);
            $table->index('evaluation_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disease_evaluations');
    }
};
