<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StorageReading extends Model
{
    protected $fillable = [
        'storage_unit_id', 'temperature', 'humidity',
        'reading_time', 'source', 'status', 'notes', 'recorded_by',
    ];

    protected $casts = [
        'reading_time' => 'datetime',
    ];

    public function storageUnit()
    {
        return $this->belongsTo(StorageUnit::class);
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
