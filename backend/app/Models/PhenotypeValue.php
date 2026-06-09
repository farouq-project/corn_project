<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PhenotypeValue extends Model
{
    protected $fillable = [
        'observation_id', 'variable_id', 'numeric_value',
        'text_value', 'is_outlier', 'outlier_note',
    ];

    protected $casts = [
        'is_outlier' => 'boolean',
    ];

    public function observation()
    {
        return $this->belongsTo(PhenotypeObservation::class, 'observation_id');
    }

    public function variable()
    {
        return $this->belongsTo(PhenotypeVariable::class, 'variable_id');
    }

    public function getCastedValueAttribute(): mixed
    {
        if (!$this->variable) return $this->numeric_value ?? $this->text_value;

        return match ($this->variable->data_type) {
            'numeric' => $this->numeric_value !== null ? (float) $this->numeric_value : null,
            'integer' => $this->numeric_value !== null ? (int) $this->numeric_value : null,
            'boolean' => $this->numeric_value !== null ? (bool) $this->numeric_value : null,
            default => $this->text_value,
        };
    }
}
