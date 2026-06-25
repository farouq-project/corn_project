<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('observation_values', function (Blueprint $table) {
            $table->unsignedTinyInteger('sample_number')->default(1)->after('characteristic_id')
                ->comment('1=Sample 1, 2=Sample 2, etc. for multiple measurements per characteristic');
            $table->dropUnique('unique_observation_value');
            $table->unique(['observation_record_id', 'characteristic_id', 'sample_number'], 'unique_observation_value_sample');
        });
    }

    public function down(): void
    {
        Schema::table('observation_values', function (Blueprint $table) {
            $table->dropUnique('unique_observation_value_sample');
            $table->dropColumn('sample_number');
            $table->unique(['observation_record_id', 'characteristic_id'], 'unique_observation_value');
        });
    }
};
