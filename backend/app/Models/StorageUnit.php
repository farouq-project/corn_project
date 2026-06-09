<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StorageUnit extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'unit_code', 'unit_name', 'unit_type', 'room_name', 'building',
        'temperature_min', 'temperature_max', 'humidity_min', 'humidity_max',
        'capacity_racks', 'capacity_boxes_per_rack', 'description', 'is_active', 'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function seedInventories()
    {
        return $this->hasMany(SeedInventory::class);
    }

    public function storageReadings()
    {
        return $this->hasMany(StorageReading::class);
    }

    public function latestReading()
    {
        return $this->hasOne(StorageReading::class)->latestOfMany('reading_time');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getOccupancyRateAttribute(): float
    {
        $total = $this->capacity_racks * ($this->capacity_boxes_per_rack ?? 1);
        if ($total <= 0) return 0;
        $used = $this->seedInventories()->whereNotIn('storage_status', ['depleted', 'discarded'])->count();
        return round(($used / $total) * 100, 1);
    }
}
