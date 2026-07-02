<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE budgets ALTER COLUMN end_date DROP NOT NULL');
        DB::statement('ALTER TABLE budgets ALTER COLUMN funding_source DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('UPDATE budgets SET end_date = start_date WHERE end_date IS NULL');
        DB::statement('ALTER TABLE budgets ALTER COLUMN end_date SET NOT NULL');
        DB::statement("UPDATE budgets SET funding_source = '' WHERE funding_source IS NULL");
        DB::statement('ALTER TABLE budgets ALTER COLUMN funding_source SET NOT NULL');
    }
};
