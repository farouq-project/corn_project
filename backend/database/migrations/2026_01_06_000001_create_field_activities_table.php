<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('field_activities', function (Blueprint $table) {
            $table->id();
            $table->string('activity_code', 30)->unique();
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('trial_id')->nullable()->constrained('trials')->nullOnDelete();
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('genotype_id')->nullable()->constrained('genotypes')->nullOnDelete();
            $table->enum('activity_type', [
                'planting', 'pollination', 'fertilizer_application',
                'irrigation', 'pesticide_application', 'harvesting',
                'drone_flight', 'disease_observation', 'sampling',
                'soil_preparation', 'thinning', 'weeding', 'monitoring', 'other'
            ]);
            $table->string('activity_title');
            $table->text('description')->nullable();
            $table->date('activity_date');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->json('photos')->nullable();
            $table->string('voice_note_path')->nullable();
            $table->json('materials_used')->nullable()->comment('JSON: [{item, quantity, unit}]');
            $table->json('weather_conditions')->nullable();
            $table->enum('status', ['draft', 'submitted', 'approved'])->default('submitted');
            $table->text('notes')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'activity_date']);
            $table->index(['trial_id', 'activity_type']);
            $table->index('activity_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('field_activities');
    }
};
