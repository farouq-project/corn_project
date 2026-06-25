<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category', 100)->nullable();
            $table->text('description')->nullable();
            $table->decimal('quantity', 10, 2)->default(1);
            $table->string('unit', 50)->nullable()->comment('pcs, kg, liter, set, dll');
            $table->enum('condition', ['good', 'damaged', 'lost', 'maintenance'])->default('good');
            $table->string('location', 255)->nullable()->comment('Where is it stored');
            $table->json('product_photos')->nullable()->comment('Array of photo URLs');

            // Borrower tracking
            $table->string('borrower_name', 255)->nullable();
            $table->string('borrower_contact', 255)->nullable();
            $table->json('borrower_photos')->nullable()->comment('Array of borrower photo URLs');
            $table->date('loan_date')->nullable();
            $table->date('expected_return_date')->nullable();

            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('category');
            $table->index('condition');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};
