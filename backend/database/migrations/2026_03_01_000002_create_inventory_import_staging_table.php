<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Staging buffer for seed inventory import rows.
 *
 * Raw data from Excel is loaded here first.
 * Normalization and validation results are written back here.
 * ONLY validated rows are promoted to seed_inventories.
 *
 * This table is the core of the import pipeline integrity.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_import_staging', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')
                ->constrained('inventory_import_batches')
                ->cascadeOnDelete();
            $table->integer('row_number')->comment('1-based row index in the original Excel');

            // ── RAW FIELDS (exactly as read from Excel, not yet validated) ─────
            $table->string('raw_package_code')->nullable();
            $table->string('raw_genotype_code')->nullable();
            $table->string('raw_storage_unit_code')->nullable();
            $table->string('raw_rack_label')->nullable();
            $table->string('raw_box_number')->nullable();
            $table->string('raw_row_position')->nullable();
            $table->string('raw_column_position')->nullable();
            $table->string('raw_season_code')->nullable();
            $table->string('raw_source_trial_code')->nullable();
            $table->string('raw_harvest_date')->nullable();
            $table->string('raw_storage_date')->nullable();
            $table->string('raw_expiry_date')->nullable();
            $table->string('raw_initial_weight_g')->nullable();
            $table->string('raw_remaining_weight_g')->nullable();
            $table->string('raw_moisture_content')->nullable();
            $table->string('raw_germination_percentage')->nullable();
            $table->string('raw_germination_test_date')->nullable();
            $table->string('raw_vigor_index')->nullable();
            $table->string('raw_seed_count')->nullable();
            $table->string('raw_storage_status')->nullable();
            $table->text('raw_notes')->nullable();

            // ── NORMALIZED FIELDS (after normalization engine runs) ────────────
            $table->string('norm_package_code')->nullable();
            $table->unsignedBigInteger('norm_genotype_id')->nullable()
                ->comment('resolved FK after lookup');
            $table->string('norm_genotype_code')->nullable()
                ->comment('normalized code used for lookup');
            $table->unsignedBigInteger('norm_storage_unit_id')->nullable();
            $table->string('norm_rack_label')->nullable();
            $table->string('norm_box_number')->nullable();
            $table->string('norm_row_position')->nullable();
            $table->string('norm_column_position')->nullable();
            $table->unsignedBigInteger('norm_season_id')->nullable();
            $table->unsignedBigInteger('norm_source_trial_id')->nullable();
            $table->date('norm_harvest_date')->nullable();
            $table->date('norm_storage_date')->nullable();
            $table->date('norm_expiry_date')->nullable();
            $table->decimal('norm_initial_weight_g', 10, 2)->nullable();
            $table->decimal('norm_remaining_weight_g', 10, 2)->nullable();
            $table->decimal('norm_moisture_content', 5, 2)->nullable();
            $table->decimal('norm_germination_percentage', 5, 2)->nullable();
            $table->date('norm_germination_test_date')->nullable();
            $table->decimal('norm_vigor_index', 5, 2)->nullable();
            $table->integer('norm_seed_count')->nullable();
            $table->string('norm_storage_status', 20)->nullable();

            // ── VALIDATION RESULTS ────────────────────────────────────────────
            $table->enum('validation_status', [
                'pending',      // not yet validated
                'valid',        // passes all rules
                'warning',      // valid but has non-critical issues
                'invalid',      // fails validation, cannot import
                'duplicate',    // duplicate detected (within file or in DB)
            ])->default('pending');

            $table->json('validation_errors')->nullable()
                ->comment('array of {field, rule, message} objects');
            $table->json('validation_warnings')->nullable()
                ->comment('non-blocking issues');

            // Duplicate detection
            $table->boolean('is_duplicate_in_file')->default(false);
            $table->boolean('is_duplicate_in_db')->default(false);
            $table->unsignedBigInteger('duplicate_of_inventory_id')->nullable()
                ->comment('existing seed_inventories.id if duplicate');
            $table->integer('duplicate_of_row')->nullable()
                ->comment('row number within same file if duplicate');

            // QR/barcode generation (after confirmed import)
            $table->string('generated_qr_code')->nullable();
            $table->string('generated_barcode')->nullable();

            // Production insert tracking
            $table->enum('import_status', [
                'pending',      // not yet processed
                'imported',     // successfully inserted to production
                'skipped',      // user chose to skip this row
                'failed',       // insert failed
            ])->default('pending');
            $table->unsignedBigInteger('imported_inventory_id')->nullable()
                ->comment('seed_inventories.id after successful insert');
            $table->unsignedBigInteger('imported_movement_id')->nullable()
                ->comment('seed_movements.id of initial in_initial movement');
            $table->text('import_error')->nullable();

            $table->timestamps();

            $table->index(['import_batch_id', 'validation_status']);
            $table->index(['import_batch_id', 'import_status']);
            $table->index(['import_batch_id', 'row_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_import_staging');
    }
};
