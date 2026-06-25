<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ObservationValue extends Model
{
    protected $fillable = [
        'observation_record_id', 'characteristic_id', 'sample_number', 'value',
    ];

    protected $casts = [
        'value' => 'decimal:4',
    ];

    public function record()
    {
        return $this->belongsTo(ObservationRecord::class, 'observation_record_id');
    }

    public function characteristic()
    {
        return $this->belongsTo(Characteristic::class, 'characteristic_id');
    }
}
