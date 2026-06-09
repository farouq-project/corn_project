<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phenotype_observations', function (Blueprint $table) {
            $table->id();
            $table->string('observation_code', 30)->unique();
            $table->foreignId('trial_id')->constrained('trials');
            $table->foreignId('genotype_id')->constrained('genotypes');
            $table->foreignId('season_id')->constrained('seasons');
            $table->integer('replication')->default(1);
            $table->integer('plot_number')->nullable();
            $table->string('row_label')->nullable();
            $table->date('observation_date');
            $table->enum('growth_stage', [
                'emergence', 'vegetative', 'tasseling', 'silking',
                'grain_fill', 'maturity', 'harvest'
            ])->nullable();
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected'])->default('draft');
            $table->text('general_notes')->nullable();
            $table->json('photos')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['trial_id', 'genotype_id']);
            $table->index(['season_id', 'observation_date']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phenotype_observations');
    }
};
