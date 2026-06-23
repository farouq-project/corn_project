<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The activity_type column is an ENUM (PostgreSQL CHECK constraint) that
 * doesn't include 'logbook'. Drop the constraint and widen the column to a
 * plain string so any custom type (including logbook) can be stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Drop the old CHECK constraint enforced by Laravel's enum() helper
        DB::statement('ALTER TABLE field_activities DROP CONSTRAINT IF EXISTS field_activities_activity_type_check');

        Schema::table('field_activities', function (Blueprint $table) {
            $table->string('activity_type', 50)->change();
        });
    }

    public function down(): void
    {
        Schema::table('field_activities', function (Blueprint $table) {
            $table->string('activity_type', 50)->change();
        });
    }
};
