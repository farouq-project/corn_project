<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trials', function (Blueprint $table) {
            $table->id();
            $table->string('trial_code', 30)->unique();
            $table->string('trial_name');
            $table->foreignId('season_id')->constrained('seasons');
            $table->foreignId('location_id')->constrained('locations');
            $table->foreignId('trial_type_id')->nullable()->constrained('trial_types')->nullOnDelete();
            $table->text('objective')->nullable();
            $table->enum('layout_design', ['RCBD', 'CRD', 'split_plot', 'factorial', 'augmented', 'alpha_lattice'])->default('RCBD');
            $table->integer('replications')->default(3);
            $table->decimal('plot_size_m2', 8, 2)->nullable();
            $table->decimal('row_spacing_cm', 6, 2)->nullable();
            $table->decimal('plant_spacing_cm', 6, 2)->nullable();
            $table->date('planting_date')->nullable();
            $table->date('harvest_date')->nullable();
            $table->enum('status', ['planned', 'active', 'harvested', 'completed', 'cancelled'])->default('planned');
            $table->text('notes')->nullable();
            $table->foreignId('principal_researcher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['season_id', 'status']);
            $table->index(['location_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trials');
    }
};
