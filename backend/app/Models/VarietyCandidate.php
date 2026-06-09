<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VarietyCandidate extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'candidate_code', 'genotype_id', 'proposed_variety_name', 'status',
        'evaluation_start_year', 'target_release_year',
        'num_trial_years', 'num_trial_locations',
        'avg_yield_t_ha', 'yield_superiority_percent', 'best_environment',
        'disease_resistance_summary',
        'submission_number', 'submission_date', 'release_date', 'release_decree_number',
        'adaptation_zones', 'remarks', 'principal_breeder_id',
    ];

    protected $casts = [
        'submission_date' => 'date',
        'release_date' => 'date',
        'disease_resistance_summary' => 'array',
    ];

    public function genotype()
    {
        return $this->belongsTo(Genotype::class);
    }

    public function principalBreeder()
    {
        return $this->belongsTo(User::class, 'principal_breeder_id');
    }
}
