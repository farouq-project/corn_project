<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inventory_loan_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
            $table->string('item_name');
            $table->string('borrow_code')->nullable();
            $table->string('borrower_name');
            $table->string('lender_name')->nullable();
            $table->string('borrower_contact')->nullable();
            $table->integer('borrow_quantity')->default(0);
            $table->integer('returned_quantity')->nullable();
            $table->date('loan_date')->nullable();
            $table->date('expected_return_date')->nullable();
            $table->date('return_date')->nullable();
            $table->string('condition_on_return')->nullable();
            $table->json('borrower_photos')->nullable();
            $table->json('return_photos')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('returned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_loan_histories');
    }
};
