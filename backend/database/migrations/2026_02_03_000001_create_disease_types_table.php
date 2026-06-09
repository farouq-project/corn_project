<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disease_types', function (Blueprint $table) {
            $table->id();
            $table->string('disease_code', 20)->unique();
            $table->string('disease_name');
            $table->string('disease_name_en')->nullable();
            $table->string('pathogen')->nullable()->comment('scientific name of pathogen');
            $table->enum('disease_category', [
                'fungal', 'bacterial', 'viral', 'pest', 'physiological'
            ])->default('fungal');
            $table->enum('severity_scale', ['1_5', '1_9', 'percent', 'custom'])
                ->default('1_9');
            $table->json('scale_description')->nullable()
                ->comment('[{"score":1,"label":"Tahan","description":"..."}]');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disease_types');
    }
};
