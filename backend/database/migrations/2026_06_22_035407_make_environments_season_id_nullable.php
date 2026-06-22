<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The EnvironmentForm no longer requires a season — users enter season_name
 * (free text) instead of selecting a season_id FK. Make season_id nullable
 * so environments can be created without linking to the seasons table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('environments', function (Blueprint $table) {
            $table->foreignId('season_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('environments', function (Blueprint $table) {
            $table->foreignId('season_id')->nullable(false)->change();
        });
    }
};
