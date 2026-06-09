<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phenotype_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('observation_id')->constrained('phenotype_observations')->cascadeOnDelete();
            $table->foreignId('variable_id')->constrained('phenotype_variables');
            $table->string('numeric_value')->nullable();
            $table->string('text_value')->nullable();
            $table->boolean('is_outlier')->default(false);
            $table->text('outlier_note')->nullable();
            $table->timestamps();

            $table->unique(['observation_id', 'variable_id']);
            $table->index('variable_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phenotype_values');
    }
};
