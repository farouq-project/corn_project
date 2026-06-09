<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->string('expense_code', 30)->unique();
            $table->foreignId('category_id')->constrained('expense_categories');
            $table->foreignId('budget_id')->nullable()->constrained('budgets')->nullOnDelete();
            $table->foreignId('trial_id')->nullable()->constrained('trials')->nullOnDelete();
            $table->foreignId('season_id')->nullable()->constrained('seasons')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('amount', 15, 2);
            $table->date('payment_date');
            $table->string('vendor')->nullable();
            $table->string('vendor_contact')->nullable();
            $table->string('funding_source')->nullable();
            $table->string('payment_method')->nullable();
            $table->string('reference_number')->nullable();
            $table->json('attachments')->nullable()->comment('array of file paths');
            $table->enum('approval_status', ['pending', 'approved', 'rejected', 'revision_needed'])->default('pending');
            $table->text('approval_notes')->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category_id', 'payment_date']);
            $table->index(['trial_id', 'approval_status']);
            $table->index('payment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
