<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Logbook "Lokasi" now references environments (Master Data → Lokasi)
 * instead of the legacy locations table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('field_activities', function (Blueprint $table) {
            $table->foreignId('environment_id')
                ->nullable()
                ->after('location_id')
                ->constrained('environments')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('field_activities', function (Blueprint $table) {
            $table->dropForeign(['environment_id']);
            $table->dropColumn('environment_id');
        });
    }
};
