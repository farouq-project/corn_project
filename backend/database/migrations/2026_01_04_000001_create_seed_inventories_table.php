<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seed_inventories', function (Blueprint $table) {
            $table->id();
            $table->string('package_code', 30)->unique();
            $table->string('qr_code', 100)->nullable()->unique();
            $table->string('barcode', 100)->nullable()->unique();
            $table->foreignId('genotype_id')->constrained('genotypes');
            $table->foreignId('storage_unit_id')->constrained('storage_units');
            $table->string('rack_label', 20)->nullable();
            $table->string('box_number', 20)->nullable();
            $table->string('row_position', 10)->nullable();
            $table->string('column_position', 10)->nullable();
            $table->foreignId('season_id')->nullable()->constrained('seasons')->nullOnDelete();
            $table->foreignId('source_trial_id')->nullable()->constrained('trials')->nullOnDelete();
            $table->date('harvest_date')->nullable();
            $table->date('storage_date');
            $table->date('expiry_date')->nullable();
            $table->decimal('initial_weight_g', 10, 2)->comment('grams');
            $table->decimal('remaining_weight_g', 10, 2);
            $table->decimal('moisture_content', 5, 2)->nullable()->comment('percent');
            $table->decimal('germination_percentage', 5, 2)->nullable();
            $table->date('germination_test_date')->nullable();
            $table->decimal('vigor_index', 5, 2)->nullable();
            $table->integer('seed_count')->nullable();
            $table->enum('storage_status', ['good', 'warning', 'critical', 'expired', 'depleted', 'discarded'])->default('good');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['genotype_id', 'storage_status']);
            $table->index(['storage_unit_id', 'rack_label', 'box_number']);
            $table->index('storage_date');
            $table->index('expiry_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seed_inventories');
    }
};
