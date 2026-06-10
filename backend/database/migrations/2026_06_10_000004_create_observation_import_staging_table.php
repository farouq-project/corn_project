<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 scaffolding: staging buffer for bulk-importing observation
 * spreadsheets into observation_records / observation_values.
 *
 * Mirrors the inventory_import_staging pattern, but stores raw and
 * normalized row data as JSON since the column set is dynamic
 * (one column per active characteristic, defined at runtime by the
 * characteristics table rather than fixed migration columns).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phenotyping_import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('batch_code', 30)->unique()->comment('e.g. PIMP-20260610-A3F7');

            $table->string('original_filename');
            $table->string('file_path')->nullable();
            $table->string('file_hash', 64)->nullable();

            $table->integer('total_rows')->default(0);
            $table->integer('valid_rows')->default(0);
            $table->integer('invalid_rows')->default(0);
            $table->integer('warning_rows')->default(0);
            $table->integer('imported_rows')->default(0);

            $table->enum('status', [
                'uploaded', 'parsing', 'parsed', 'validating',
                'validated', 'confirmed', 'importing', 'completed',
                'partial', 'failed', 'rolled_back',
            ])->default('uploaded');

            $table->text('status_message')->nullable();

            $table->boolean('is_rolled_back')->default(false);
            $table->timestamp('rolled_back_at')->nullable();
            $table->foreignId('rolled_back_by')->nullable()->constrained('users')->nullOnDelete();

            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('import_completed_at')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('uploaded_by');
        });

        Schema::create('observation_import_staging', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')
                ->constrained('phenotyping_import_batches')
                ->cascadeOnDelete();
            $table->integer('row_number')->comment('1-based row index in the original Excel');

            $table->json('raw_data')->comment('row as read from Excel: {"No Plot": "1", "Kode Gen": "G-01", ..., "TT": "120", ...}');
            $table->json('normalized_data')->nullable()->comment('resolved plot_no/genotype_id/environment_id/replication + characteristic_code => value map');

            $table->enum('status', ['pending', 'valid', 'warning', 'invalid'])->default('pending');
            $table->json('errors')->nullable();
            $table->json('warnings')->nullable();

            $table->unsignedBigInteger('imported_observation_record_id')->nullable();

            $table->timestamps();

            $table->index(['import_batch_id', 'status']);
            $table->index(['import_batch_id', 'row_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('observation_import_staging');
        Schema::dropIfExists('phenotyping_import_batches');
    }
};
