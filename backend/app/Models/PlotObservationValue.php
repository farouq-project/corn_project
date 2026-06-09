<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlotObservationValue extends Model
{
    protected $fillable = [
        'observation_id', 'variable_id',
        'numeric_value', 'text_value',
        'is_outlier', 'outlier_note', 'is_missing', 'missing_reason',
    ];

    protected $casts = [
        'is_outlier' => 'boolean',
        'is_missing' => 'boolean',
    ];

    public function observation()
    {
        return $this->belongsTo(PlotObservation::class, 'observation_id');
    }

    public function variable()
    {
        return $this->belongsTo(PhenotypeVariable::class, 'variable_id');
    }
}
