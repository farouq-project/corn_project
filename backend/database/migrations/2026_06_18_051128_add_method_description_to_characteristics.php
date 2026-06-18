<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characteristics', function (Blueprint $table) {
            $table->text('method_description')->nullable()->after('group')
                ->comment('How to measure this characteristic (method / protocol)');
        });
    }

    public function down(): void
    {
        Schema::table('characteristics', function (Blueprint $table) {
            $table->dropColumn('method_description');
        });
    }
};
