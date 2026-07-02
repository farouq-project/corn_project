<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop existing check constraint and replace with a varchar column that accepts any value
        // This allows adding new categories without future migrations
        DB::statement('ALTER TABLE research_documents DROP CONSTRAINT IF EXISTS research_documents_category_check');
        DB::statement("ALTER TABLE research_documents ALTER COLUMN category TYPE VARCHAR(50)");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE research_documents ALTER COLUMN category TYPE VARCHAR(50)");
    }
};
