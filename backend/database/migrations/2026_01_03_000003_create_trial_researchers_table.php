<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trial_researchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trial_id')->constrained('trials')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('role', ['principal', 'co_researcher', 'field_observer', 'data_entry'])->default('field_observer');
            $table->timestamps();

            $table->unique(['trial_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_researchers');
    }
};
