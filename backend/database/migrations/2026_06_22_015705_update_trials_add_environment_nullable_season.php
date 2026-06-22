<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trials', function (Blueprint $table) {
            // Add direct environment link (Lingkungan)
            $table->foreignId('environment_id')->nullable()->after('location_id')
                ->constrained('environments')->nullOnDelete();
            // season_id is now optional (derived from environment or left blank)
            $table->foreignId('season_id')->nullable()->change();
            // location_id is also now optional (derived from environment)
            $table->foreignId('location_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('trials', function (Blueprint $table) {
            $table->dropConstrainedForeignId('environment_id');
            $table->foreignId('season_id')->nullable(false)->change();
            $table->foreignId('location_id')->nullable(false)->change();
        });
    }
};
