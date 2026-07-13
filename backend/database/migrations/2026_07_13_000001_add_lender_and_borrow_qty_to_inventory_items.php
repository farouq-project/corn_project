<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('lender_name')->nullable()->after('borrower_photos');
            $table->integer('borrow_quantity')->nullable()->after('lender_name');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn(['lender_name', 'borrow_quantity']);
        });
    }
};
