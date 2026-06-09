<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phenotype_variables', function (Blueprint $table) {
            $table->id();
            $table->string('variable_code', 30)->unique();
            $table->string('variable_name');
            $table->string('abbreviation', 20)->nullable();
            $table->enum('category', [
                'vegetative', 'reproductive', 'ear_characteristics',
                'yield_components', 'stress_response', 'seed_characteristics'
            ]);
            $table->enum('data_type', ['numeric', 'integer', 'text', 'boolean', 'scale', 'date'])->default('numeric');
            $table->string('unit')->nullable()->comment('cm, g, %, days, score, etc');
            $table->decimal('min_value', 10, 4)->nullable();
            $table->decimal('max_value', 10, 4)->nullable();
            $table->integer('decimal_places')->default(2);
            $table->text('description')->nullable();
            $table->text('measurement_guide')->nullable();
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['category', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phenotype_variables');
    }
};
