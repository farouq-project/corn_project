<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seed_movements', function (Blueprint $table) {
            $table->id();
            $table->string('movement_code', 30)->unique();
            $table->foreignId('seed_inventory_id')->constrained('seed_inventories');
            $table->enum('movement_type', [
                'in_initial', 'in_transfer', 'in_return',
                'out_planting', 'out_laboratory', 'out_distribution',
                'out_discard', 'out_damage', 'adjustment'
            ]);
            $table->decimal('quantity_g', 10, 2)->comment('grams moved');
            $table->decimal('balance_after_g', 10, 2)->comment('remaining after movement');
            $table->foreignId('from_storage_unit_id')->nullable()->constrained('storage_units')->nullOnDelete();
            $table->foreignId('to_storage_unit_id')->nullable()->constrained('storage_units')->nullOnDelete();
            $table->foreignId('related_trial_id')->nullable()->constrained('trials')->nullOnDelete();
            $table->string('destination')->nullable()->comment('lab, field, institution name');
            $table->string('recipient_name')->nullable();
            $table->date('movement_date');
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['seed_inventory_id', 'movement_date']);
            $table->index('movement_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seed_movements');
    }
};
