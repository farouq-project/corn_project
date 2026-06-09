<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('storage_unit_id')->constrained('storage_units');
            $table->decimal('temperature', 6, 2)->nullable()->comment('celsius');
            $table->decimal('humidity', 5, 2)->nullable()->comment('percent');
            $table->timestamp('reading_time');
            $table->enum('source', ['manual', 'sensor', 'import'])->default('manual');
            $table->enum('status', ['normal', 'warning', 'critical'])->default('normal');
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['storage_unit_id', 'reading_time']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_readings');
    }
};
