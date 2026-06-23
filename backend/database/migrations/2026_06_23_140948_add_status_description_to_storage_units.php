<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storage_units', function (Blueprint $table) {
            $table->string('status', 30)->default('active')->after('is_active')
                ->comment('active, maintenance, inactive, or custom value');
        });
    }

    public function down(): void
    {
        Schema::table('storage_units', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
