<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryLoanHistory extends Model
{
    protected $fillable = [
        'inventory_item_id', 'item_name', 'borrow_code',
        'borrower_name', 'lender_name', 'borrower_contact',
        'borrow_quantity', 'returned_quantity',
        'loan_date', 'expected_return_date', 'return_date',
        'condition_on_return', 'borrower_photos', 'return_photos',
        'notes', 'created_by', 'returned_by',
    ];

    protected $casts = [
        'borrower_photos' => 'array',
        'return_photos' => 'array',
        'loan_date' => 'date',
        'expected_return_date' => 'date',
        'return_date' => 'date',
    ];

    public function item()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function returner()
    {
        return $this->belongsTo(User::class, 'returned_by');
    }
}
