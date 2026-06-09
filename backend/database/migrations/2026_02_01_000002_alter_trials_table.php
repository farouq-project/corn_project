<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Upgrade trials table for multilocation, multi-season scientific trials.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trials', function (Blueprint $table) {
            // Trial category
            $table->enum('trial_category', [
                'multilocation', 'single_location', 'preliminary', 'advanced', 'national'
            ])->default('single_location')->after('trial_type_id');

            $table->enum('objective_category', [
                'yield_adaptation', 'disease_resistance', 'drought_tolerance',
                'shade_tolerance', 'quality', 'combined'
            ])->default('yield_adaptation')->after('trial_category');

            // Variety release tracking
            $table->year('target_release_year')->nullable()->after('objective_category');

            // Experimental design detail
            $table->integer('num_genotypes')->nullable()->after('replications')
                ->comment('number of genotypes/entries');
            $table->integer('num_locations')->default(1)->after('num_genotypes');
            $table->integer('num_seasons')->default(1)->after('num_locations');

            // Remove deprecated columns that are now in trial_plots/environments
            // (We keep them nullable for backward compat rather than dropping)
            $table->decimal('row_spacing_cm', 6, 2)->nullable()->change();
            $table->decimal('plant_spacing_cm', 6, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('trials', function (Blueprint $table) {
            $table->dropColumn([
                'trial_category', 'objective_category', 'target_release_year',
                'num_genotypes', 'num_locations', 'num_seasons',
            ]);
        });
    }
};
