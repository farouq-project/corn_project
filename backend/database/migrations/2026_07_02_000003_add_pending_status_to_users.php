<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // PostgreSQL: extend the status enum to allow 'pending'
        // The existing enum check is dropped and replaced with a broader one
        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active','inactive','suspended','pending'))");
    }

    public function down(): void
    {
        DB::statement("UPDATE users SET status = 'inactive' WHERE status = 'pending'");
        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active','inactive','suspended'))");
    }
};
