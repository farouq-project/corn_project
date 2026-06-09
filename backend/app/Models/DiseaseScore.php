<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DiseaseScore extends Model
{
    protected $fillable = [
        'evaluation_id', 'trial_plot_id', 'genotype_id', 'trial_block_id',
        'incidence_percent', 'severity_score', 'intensity_percent',
        'symptom_first_seen', 'plants_assessed', 'plants_affected',
        'resistance_category', 'notes',
    ];

    protected $casts = [
        'symptom_first_seen' => 'date',
    ];

    public function evaluation()
    {
        return $this->belongsTo(DiseaseEvaluation::class);
    }

    public function plot()
    {
        return $this->belongsTo(TrialPlot::class, 'trial_plot_id');
    }

    public function genotype()
    {
        return $this->belongsTo(Genotype::class);
    }

    public function block()
    {
        return $this->belongsTo(TrialBlock::class, 'trial_block_id');
    }
}
