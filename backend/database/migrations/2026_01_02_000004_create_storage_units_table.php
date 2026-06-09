<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_units', function (Blueprint $table) {
            $table->id();
            $table->string('unit_code', 20)->unique();
            $table->string('unit_name');
            $table->enum('unit_type', ['refrigerator', 'freezer', 'cold_room', 'dry_room', 'cabinet', 'shelf'])->default('refrigerator');
            $table->string('room_name')->nullable();
            $table->string('building')->nullable();
            $table->decimal('temperature_min', 6, 2)->nullable()->comment('celsius');
            $table->decimal('temperature_max', 6, 2)->nullable()->comment('celsius');
            $table->decimal('humidity_min', 5, 2)->nullable()->comment('percent');
            $table->decimal('humidity_max', 5, 2)->nullable()->comment('percent');
            $table->integer('capacity_racks')->nullable();
            $table->integer('capacity_boxes_per_rack')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_units');
    }
};
