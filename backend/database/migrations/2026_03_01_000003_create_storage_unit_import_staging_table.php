<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Staging table for storage unit imports.
 * Simpler than inventory — fewer fields, no FK resolution needed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_unit_import_staging', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')
                ->constrained('inventory_import_batches')
                ->cascadeOnDelete();
            $table->integer('row_number');

            // Raw fields
            $table->string('raw_unit_code')->nullable();
            $table->string('raw_unit_name')->nullable();
            $table->string('raw_unit_type')->nullable();
            $table->string('raw_room_name')->nullable();
            $table->string('raw_building')->nullable();
            $table->string('raw_temperature_min')->nullable();
            $table->string('raw_temperature_max')->nullable();
            $table->string('raw_humidity_min')->nullable();
            $table->string('raw_humidity_max')->nullable();
            $table->string('raw_capacity_racks')->nullable();
            $table->string('raw_capacity_boxes_per_rack')->nullable();
            $table->string('raw_is_active')->nullable();
            $table->text('raw_description')->nullable();

            // Normalized fields
            $table->string('norm_unit_code')->nullable();
            $table->string('norm_unit_name')->nullable();
            $table->string('norm_unit_type')->nullable();
            $table->decimal('norm_temperature_min', 6, 2)->nullable();
            $table->decimal('norm_temperature_max', 6, 2)->nullable();
            $table->decimal('norm_humidity_min', 5, 2)->nullable();
            $table->decimal('norm_humidity_max', 5, 2)->nullable();
            $table->integer('norm_capacity_racks')->nullable();
            $table->integer('norm_capacity_boxes_per_rack')->nullable();
            $table->boolean('norm_is_active')->nullable();

            // Validation
            $table->enum('validation_status', ['pending', 'valid', 'warning', 'invalid', 'duplicate'])
                ->default('pending');
            $table->json('validation_errors')->nullable();
            $table->json('validation_warnings')->nullable();
            $table->boolean('is_duplicate_in_file')->default(false);
            $table->boolean('is_duplicate_in_db')->default(false);

            // Import tracking
            $table->enum('import_status', ['pending', 'imported', 'skipped', 'failed'])->default('pending');
            $table->unsignedBigInteger('imported_unit_id')->nullable();
            $table->text('import_error')->nullable();

            $table->timestamps();

            $table->index(['import_batch_id', 'validation_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_unit_import_staging');
    }
};
