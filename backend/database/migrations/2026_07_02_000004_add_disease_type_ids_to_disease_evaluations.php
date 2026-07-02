<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('disease_evaluations', function (Blueprint $table) {
            $table->jsonb('disease_type_ids')->nullable()->after('disease_type_id');
        });
    }

    public function down(): void
    {
        Schema::table('disease_evaluations', function (Blueprint $table) {
            $table->dropColumn('disease_type_ids');
        });
    }
};
