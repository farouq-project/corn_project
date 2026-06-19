<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('environments', function (Blueprint $table) {
            // User-defined display name (replaces auto-generated code as primary label)
            $table->string('name')->nullable()->after('environment_code');
            // Full text address from geocoding
            $table->text('address')->nullable()->after('name');
            // Area in hectares
            $table->decimal('luas_ha', 8, 2)->nullable()->after('address');
            // Make location_id optional — new environments use GPS/address directly
            $table->foreignId('location_id')->nullable()->change();
        });

        // Drop the old unique constraint so nullable location_id doesn't conflict
        Schema::table('environments', function (Blueprint $table) {
            $table->dropUnique(['location_id', 'season_id']);
        });
    }

    public function down(): void
    {
        Schema::table('environments', function (Blueprint $table) {
            $table->dropColumn(['name', 'address', 'luas_ha']);
            $table->foreignId('location_id')->nullable(false)->change();
        });
    }
};
