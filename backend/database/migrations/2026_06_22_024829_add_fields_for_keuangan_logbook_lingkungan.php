<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Environments: manual season name + treatment (perlakuan)
        Schema::table('environments', function (Blueprint $table) {
            $table->string('season_name', 100)->nullable()->after('season_id')
                ->comment('Manual season name — used when season_id is null');
            $table->string('perlakuan', 255)->nullable()->after('season_name')
                ->comment('Treatment description, e.g. Normal, Naungan, Kekeringan');
        });

        // Expenses: optional category_name + receipt via existing attachments
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('category_name_custom', 100)->nullable()->after('category_id')
                ->comment('Free-text category when category_id is null');
            $table->foreignId('category_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('environments', function (Blueprint $table) {
            $table->dropColumn(['season_name', 'perlakuan']);
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('category_name_custom');
            $table->foreignId('category_id')->nullable(false)->change();
        });
    }
};
