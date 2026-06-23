<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_monitor_entries', function (Blueprint $table) {
            $table->id();
            $table->integer('entry_number')->comment('Display number, auto-assigned on creation');
            $table->string('prev_code', 50)->nullable()->comment('Kode Sebelumnya');
            $table->string('new_code', 50)->nullable()->comment('Kode Baru');
            $table->string('prev_box', 100)->nullable()->comment('Box Sebelumnya');
            $table->string('new_box', 100)->nullable()->comment('Box Baru');
            $table->text('genotype_name')->nullable()->comment('Nama Genotipe, supports cross notation e.g. SR4 x SR7 x Jambore');
            $table->string('prev_packaging', 100)->nullable()->comment('Kemasan Sebelumnya');
            $table->string('new_packaging', 100)->nullable()->comment('Kemasan Baru');
            $table->date('harvest_date')->nullable()->comment('Tanggal Panen');
            $table->decimal('seed_weight', 10, 2)->nullable()->comment('Berat Benih (gram)');
            $table->decimal('moisture_content', 5, 2)->nullable()->comment('Kadar Air (%)');
            $table->text('notes')->nullable()->comment('Keterangan');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('entry_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_monitor_entries');
    }
};
