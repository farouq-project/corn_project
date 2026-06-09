<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('genotypes', function (Blueprint $table) {
            $table->id();
            $table->string('genotype_code', 30)->unique();
            $table->string('old_code', 30)->nullable();
            $table->string('genotype_name');
            $table->enum('category', ['inbred_line', 'hybrid', 'variety', 'population', 'germplasm'])->default('inbred_line');
            $table->enum('trial_type', ['drought', 'shade', 'normal', 'feed', 'sweet_corn', 'multi'])->default('normal');
            $table->string('origin')->nullable();
            $table->string('breeder')->nullable();
            $table->year('release_year')->nullable();
            $table->text('breeder_notes')->nullable();
            $table->text('pedigree')->nullable();
            $table->enum('status', ['active', 'inactive', 'archived'])->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category', 'trial_type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('genotypes');
    }
};
