<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('research_documents', function (Blueprint $table) {
            $table->id();
            $table->string('document_code', 30)->unique();
            $table->string('title');
            $table->enum('category', [
                'sop',                  // Standard Operating Procedures
                'rainfall_data',        // Rainfall/weather reports
                'soil_analysis',        // Soil lab reports
                'genotype_list',        // List of entries/genotypes
                'field_documentation',  // Field notes, maps, photos
                'harvest_report',       // Yield/harvest reports
                'statistical_output',   // ANOVA, biplot outputs
                'variety_release',      // Release documents, descriptors
                'financial',            // Receipts, budget reports
                'protocol',             // Trial protocols
                'other'
            ]);

            // Flexible linkage (can link to trial, environment, season, or none)
            $table->foreignId('trial_id')->nullable()->constrained('trials')->nullOnDelete();
            $table->foreignId('environment_id')->nullable()->constrained('environments')->nullOnDelete();
            $table->foreignId('season_id')->nullable()->constrained('seasons')->nullOnDelete();

            // File storage
            $table->string('disk', 20)->default('local');
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size_bytes')->nullable();

            // Versioning
            $table->integer('version')->default(1);
            $table->foreignId('parent_document_id')->nullable()
                ->constrained('research_documents')->nullOnDelete();
            $table->boolean('is_latest_version')->default(true);

            $table->text('description')->nullable();
            $table->date('document_date')->nullable();
            $table->boolean('is_public')->default(false);
            $table->json('tags')->nullable();

            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category', 'trial_id']);
            $table->index(['trial_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('research_documents');
    }
};
