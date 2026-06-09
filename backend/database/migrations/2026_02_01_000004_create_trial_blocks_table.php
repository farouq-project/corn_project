<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RCBD blocks (replications) within a trial × environment.
 * Each block contains one plot per genotype/treatment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trial_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trial_id')->constrained('trials')->cascadeOnDelete();
            $table->foreignId('environment_id')->constrained('environments')->cascadeOnDelete();
            $table->integer('block_number')->comment('replication number: 1, 2, 3...');
            $table->string('block_label', 20)->nullable()->comment('R1, R2, Block A...');

            // Spatial layout (rows × columns in the field)
            $table->integer('row_start')->nullable();
            $table->integer('row_end')->nullable();
            $table->integer('col_start')->nullable();
            $table->integer('col_end')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['trial_id', 'environment_id', 'block_number']);
            $table->index(['trial_id', 'environment_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_blocks');
    }
};
