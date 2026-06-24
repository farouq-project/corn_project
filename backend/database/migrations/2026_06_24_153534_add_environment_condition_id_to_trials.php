<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trials', function (Blueprint $table) {
            $table->foreignId('environment_condition_id')
                ->nullable()
                ->after('environment_id')
                ->constrained('environment_conditions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('trials', function (Blueprint $table) {
            $table->dropForeign(['environment_condition_id']);
            $table->dropColumn('environment_condition_id');
        });
    }
};
