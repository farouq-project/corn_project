<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Field layout metadata for visualization.
 * Stores the spatial arrangement of plots for map rendering.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trial_layouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trial_id')->constrained('trials')->cascadeOnDelete();
            $table->foreignId('environment_id')->constrained('environments')->cascadeOnDelete();

            // Field dimensions
            $table->integer('total_rows')->nullable();
            $table->integer('total_columns')->nullable();
            $table->string('layout_direction', 20)->default('row_first')
                ->comment('row_first or column_first');
            $table->string('border_type', 50)->nullable()
                ->comment('border row/plot description');

            // JSON grid for visualization: [[plot_id, genotype_code, block], ...]
            $table->json('plot_grid')->nullable()
                ->comment('2D array mapping row×col to plot assignments');

            // Randomization
            $table->enum('randomization_method', ['manual', 'rcbd_random', 'latin_square'])
                ->default('rcbd_random');
            $table->integer('randomization_seed')->nullable();
            $table->timestamp('randomized_at')->nullable();
            $table->foreignId('randomized_by')->nullable()->constrained('users')->nullOnDelete();

            // Field sketch upload
            $table->string('field_sketch_path')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['trial_id', 'environment_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_layouts');
    }
};
