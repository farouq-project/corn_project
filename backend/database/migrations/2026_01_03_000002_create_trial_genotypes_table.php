<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trial_genotypes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trial_id')->constrained('trials')->cascadeOnDelete();
            $table->foreignId('genotype_id')->constrained('genotypes')->cascadeOnDelete();
            $table->integer('entry_number')->nullable();
            $table->string('treatment_label')->nullable();
            $table->boolean('is_check')->default(false)->comment('check variety');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['trial_id', 'genotype_id']);
            $table->index('trial_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_genotypes');
    }
};
