<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links trials to environments (location × season combinations).
 * A multilocation trial can have many environments.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trial_environments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trial_id')->constrained('trials')->cascadeOnDelete();
            $table->foreignId('environment_id')->constrained('environments')->cascadeOnDelete();
            $table->string('local_trial_code', 30)->nullable()
                ->comment('local code at this location');
            $table->enum('status', ['planned', 'active', 'harvested', 'completed', 'failed', 'cancelled'])
                ->default('planned');
            $table->foreignId('local_coordinator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['trial_id', 'environment_id']);
            $table->index('trial_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_environments');
    }
};
