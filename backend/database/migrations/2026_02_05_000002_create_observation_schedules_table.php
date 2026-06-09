<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Observation scheduler — plan when field observations should happen.
 * Supports missing-data alerts and seasonal calendars.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('observation_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trial_id')->constrained('trials')->cascadeOnDelete();
            $table->foreignId('environment_id')->nullable()->constrained('environments')->nullOnDelete();

            $table->string('schedule_title');
            $table->enum('observation_type', [
                'phenotype', 'disease_evaluation', 'field_activity', 'yield_harvest', 'sampling'
            ]);
            $table->enum('variable_category', [
                'vegetative', 'reproductive', 'ear_characteristics',
                'yield_components', 'stress_response', 'disease', 'all'
            ])->nullable();

            $table->date('scheduled_date');
            $table->date('deadline_date')->nullable();
            $table->enum('growth_stage_target', [
                'pre_emergence', 'emergence_vE', 'vegetative_V1_V6',
                'vegetative_V7_V12', 'tasseling_VT', 'silking_R1',
                'blister_R2', 'milk_R3', 'dough_R4', 'dent_R5',
                'maturity_R6', 'harvest'
            ])->nullable();

            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();

            $table->enum('status', ['pending', 'in_progress', 'completed', 'missed', 'cancelled'])
                ->default('pending');
            $table->date('completion_date')->nullable();
            $table->decimal('completion_rate_percent', 5, 2)->nullable()
                ->comment('% of plots observed when completed');

            // Reminder tracking
            $table->boolean('reminder_sent')->default(false);
            $table->timestamp('reminder_sent_at')->nullable();
            $table->integer('reminder_days_before')->default(3);

            $table->text('instructions')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['trial_id', 'scheduled_date']);
            $table->index(['assigned_to', 'status']);
            $table->index('scheduled_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('observation_schedules');
    }
};
