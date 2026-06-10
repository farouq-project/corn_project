<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * EAV-style value storage — one row per characteristic per observation record.
 * Avoids C1, C2, C3... columns; new characteristics need no migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('observation_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('observation_record_id')
                ->constrained('observation_records')
                ->cascadeOnDelete();
            $table->foreignId('characteristic_id')->constrained('characteristics');

            $table->decimal('value', 12, 4)->nullable();

            $table->timestamps();

            $table->unique(['observation_record_id', 'characteristic_id'], 'unique_observation_value');
            $table->index('characteristic_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('observation_values');
    }
};
