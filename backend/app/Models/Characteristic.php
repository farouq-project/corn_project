<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Characteristic extends Model
{
    protected $fillable = [
        'code', 'name', 'unit', 'group',
        'display_order', 'decimal_places', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected $attributes = [
        'display_order' => 0,
        'decimal_places' => 2,
        'is_active' => true,
    ];

    public function values()
    {
        return $this->hasMany(ObservationValue::class, 'characteristic_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order')->orderBy('name');
    }
}
