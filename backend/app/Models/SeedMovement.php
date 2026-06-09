<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SeedMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'movement_code', 'seed_inventory_id', 'movement_type',
        'quantity_g', 'balance_after_g', 'from_storage_unit_id',
        'to_storage_unit_id', 'related_trial_id', 'destination',
        'recipient_name', 'movement_date', 'reason', 'notes',
        'performed_by', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'movement_date' => 'date',
        'approved_at' => 'datetime',
    ];

    public function seedInventory()
    {
        return $this->belongsTo(SeedInventory::class);
    }

    public function fromStorageUnit()
    {
        return $this->belongsTo(StorageUnit::class, 'from_storage_unit_id');
    }

    public function toStorageUnit()
    {
        return $this->belongsTo(StorageUnit::class, 'to_storage_unit_id');
    }

    public function relatedTrial()
    {
        return $this->belongsTo(Trial::class, 'related_trial_id');
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
