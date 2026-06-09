<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeatherRecord extends Model
{
    protected $fillable = [
        'location_id', 'record_date', 'source',
        'temp_max_c', 'temp_min_c', 'temp_avg_c',
        'rainfall_mm', 'humidity_avg_percent', 'solar_radiation_mj_m2',
        'wind_speed_m_s', 'wind_direction_deg', 'evapotranspiration_mm',
        'raw_data', 'api_request_id', 'notes',
    ];

    protected $casts = [
        'record_date' => 'date',
        'raw_data' => 'array',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }
}
