<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Location extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'field_code', 'field_name', 'latitude', 'longitude', 'altitude',
        'area_hectares', 'village', 'district', 'regency', 'province',
        'soil_type', 'description', 'is_active', 'created_by',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'is_active' => 'boolean',
    ];

    public function trials()
    {
        return $this->hasMany(Trial::class);
    }

    public function fieldActivities()
    {
        return $this->hasMany(FieldActivity::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
