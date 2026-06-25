<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Imported observation records no longer require a Lokasi (environment_id).
 * The "Environment" column in the import template now maps to environment_condition_id
 * (treatment type), so environment_id must be nullable for imported rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('observation_records', function (Blueprint $table) {
            $table->foreignId('environment_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('observation_records', function (Blueprint $table) {
            $table->foreignId('environment_id')->nullable(false)->change();
        });
    }
};
