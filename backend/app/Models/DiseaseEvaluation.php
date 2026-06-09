<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DiseaseEvaluation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'evaluation_code', 'trial_id', 'environment_id', 'disease_type_id',
        'evaluation_date', 'growth_stage', 'days_after_planting',
        'weather_notes', 'general_observations', 'photos',
        'status', 'evaluator_id', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'evaluation_date' => 'date',
        'approved_at' => 'datetime',
        'photos' => 'array',
    ];

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function diseaseType()
    {
        return $this->belongsTo(DiseaseType::class);
    }

    public function scores()
    {
        return $this->hasMany(DiseaseScore::class, 'evaluation_id');
    }

    public function evaluator()
    {
        return $this->belongsTo(User::class, 'evaluator_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function getGenotypeResistanceSummaryAttribute(): array
    {
        return $this->scores()
            ->with('genotype:id,genotype_code,genotype_name')
            ->get()
            ->groupBy('genotype_id')
            ->map(fn($scores) => [
                'genotype' => $scores->first()->genotype,
                'avg_incidence' => round($scores->avg('incidence_percent'), 2),
                'avg_severity' => round($scores->avg('severity_score'), 2),
                'resistance_category' => $scores->first()->resistance_category,
            ])
            ->values()
            ->toArray();
    }
}
