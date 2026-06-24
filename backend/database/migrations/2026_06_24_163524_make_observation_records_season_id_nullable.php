<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * observation_records.season_id was NOT NULL, but new Lokasi (environments)
 * can be created with only season_name (free text), leaving season_id = null.
 * This causes 500 errors when submitting manual observations for such Lokasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('observation_records', function (Blueprint $table) {
            $table->foreignId('season_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('observation_records', function (Blueprint $table) {
            $table->foreignId('season_id')->nullable(false)->change();
        });
    }
};
