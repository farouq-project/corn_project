<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('observation_records', function (Blueprint $table) {
            $table->foreignId('trial_id')->nullable()->after('id')
                  ->constrained('trials')->nullOnDelete();
            $table->index('trial_id');
        });
    }

    public function down(): void
    {
        Schema::table('observation_records', function (Blueprint $table) {
            $table->dropConstrainedForeignId('trial_id');
        });
    }
};
