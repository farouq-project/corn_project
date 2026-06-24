<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Environment" as a treatment/condition type for Research Plans.
 * Examples: Normal, Shading, Drought, Flooding.
 * Separate from "Lokasi" (the physical field location, stored in environments table).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('environment_conditions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique()->comment('e.g. Normal, Shading, Drought');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('environment_conditions');
    }
};
