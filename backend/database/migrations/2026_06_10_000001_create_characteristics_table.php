<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Researcher-editable master list of phenotyping characteristics
 * (e.g. TT = Tinggi Tanaman, PD = Panjang Daun).
 *
 * Drives the dynamic columns on the "Data Pengamatan" spreadsheet grid —
 * adding/removing a characteristic here requires no migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('characteristics', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique()->comment('e.g. TT, PD, LD');
            $table->string('name')->comment('e.g. Tinggi Tanaman');
            $table->string('unit', 20)->nullable()->comment('cm, g, %, days, score, etc');
            $table->string('group', 50)->nullable()->comment('column grouping, e.g. Pertumbuhan, Hasil');
            $table->integer('display_order')->default(0);
            $table->integer('decimal_places')->default(2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'display_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('characteristics');
    }
};
