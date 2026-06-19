<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Environment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'environment_code', 'name', 'address', 'luas_ha',
        'location_id', 'season_id',
        'latitude', 'longitude', 'elevation_m',
        'irrigation_type', 'land_history', 'soil_type',
        'total_rainfall_mm', 'avg_temperature_c', 'avg_humidity_percent',
        'env_data_source', 'api_metadata', 'notes', 'created_by',
    ];

    protected $casts = [
        'planting_date' => 'date',
        'harvest_date' => 'date',
        'api_metadata' => 'array',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function trials()
    {
        return $this->belongsToMany(Trial::class, 'trial_environments')
            ->withPivot('local_trial_code', 'status', 'local_coordinator_id', 'notes')
            ->withTimestamps();
    }

    public function trialEnvironments()
    {
        return $this->hasMany(TrialEnvironment::class);
    }

    public function blocks()
    {
        return $this->hasMany(TrialBlock::class);
    }

    public function plots()
    {
        return $this->hasMany(TrialPlot::class);
    }

    public function plotObservations()
    {
        return $this->hasMany(PlotObservation::class);
    }

    public function diseaseEvaluations()
    {
        return $this->hasMany(DiseaseEvaluation::class);
    }

    public function observationRecords()
    {
        return $this->hasMany(ObservationRecord::class);
    }

    public function soilAnalyses()
    {
        return $this->hasMany(SoilAnalysis::class);
    }

    public function weatherRecords()
    {
        return $this->hasMany(WeatherRecord::class, 'location_id', 'location_id');
    }

    public function layout()
    {
        return $this->hasOne(TrialLayout::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getDisplayNameAttribute(): string
    {
        if ($this->name) return $this->name;
        return "{$this->location?->field_name} — {$this->season?->season_name}";
    }
}
