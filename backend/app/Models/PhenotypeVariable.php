<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PhenotypeVariable extends Model
{
    protected $fillable = [
        'variable_code', 'variable_name', 'abbreviation', 'category',
        'data_type', 'unit', 'min_value', 'max_value', 'decimal_places',
        'description', 'measurement_guide', 'is_required', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function values()
    {
        return $this->hasMany(PhenotypeValue::class, 'variable_id');
    }
}
