<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryItem extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'category', 'description', 'quantity', 'unit', 'condition', 'location',
        'product_photos', 'borrower_name', 'borrower_contact', 'borrower_photos',
        'loan_date', 'expected_return_date', 'notes', 'recorded_by',
        'lender_name', 'borrow_quantity',
    ];

    protected $casts = [
        'product_photos' => 'array',
        'borrower_photos' => 'array',
        'loan_date' => 'date',
        'expected_return_date' => 'date',
        'quantity' => 'decimal:2',
    ];

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function getIsBorrowedAttribute(): bool
    {
        return $this->borrower_name !== null;
    }
}
