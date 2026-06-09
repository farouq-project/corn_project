<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks each import session end-to-end.
 * One batch = one uploaded file = one import attempt.
 * Supports full rollback by batch_code.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('batch_code', 30)->unique()->comment('e.g. IMP-20260514-A3F7');

            $table->enum('import_type', ['seed_inventory', 'storage_unit'])
                ->comment('which entity is being imported');

            // Source file metadata
            $table->string('original_filename');
            $table->string('file_path')->nullable()->comment('stored file for audit reference');
            $table->string('file_hash', 64)->nullable()->comment('SHA-256 of uploaded file, detects re-uploads');

            // Row statistics
            $table->integer('total_rows')->default(0);
            $table->integer('valid_rows')->default(0);
            $table->integer('invalid_rows')->default(0);
            $table->integer('warning_rows')->default(0);
            $table->integer('duplicate_rows')->default(0);
            $table->integer('imported_rows')->default(0);

            // Pipeline state machine
            $table->enum('status', [
                'uploaded',     // file received, not yet parsed
                'parsing',      // currently parsing Excel
                'parsed',       // raw rows loaded into staging
                'validating',   // validation engine running
                'validated',    // validation complete, ready for review
                'confirmed',    // user confirmed import
                'importing',    // inserting into production tables
                'completed',    // import done successfully
                'partial',      // some rows failed during insert
                'failed',       // catastrophic failure
                'rolled_back',  // batch was reversed
            ])->default('uploaded');

            $table->text('status_message')->nullable()->comment('human-readable status or error');

            // Rollback support
            $table->boolean('is_rolled_back')->default(false);
            $table->timestamp('rolled_back_at')->nullable();
            $table->foreignId('rolled_back_by')->nullable()->constrained('users')->nullOnDelete();

            // Who/when
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('import_completed_at')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['import_type', 'status']);
            $table->index('uploaded_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_import_batches');
    }
};
