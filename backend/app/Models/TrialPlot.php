<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrialPlot extends Model
{
    protected $fillable = [
        'plot_code', 'trial_id', 'environment_id', 'trial_block_id', 'genotype_id',
        'entry_number', 'treatment_label', 'is_check',
        'plot_number', 'row_position', 'column_position', 'randomization_order',
        'plot_length_m', 'plot_width_m', 'plant_spacing_cm', 'row_spacing_cm',
        'plants_per_plot', 'status', 'exclusion_reason', 'notes',
    ];

    protected $casts = [
        'is_check' => 'boolean',
    ];

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function block()
    {
        return $this->belongsTo(TrialBlock::class, 'trial_block_id');
    }

    public function genotype()
    {
        return $this->belongsTo(Genotype::class);
    }

    public function observations()
    {
        return $this->hasMany(PlotObservation::class, 'trial_plot_id');
    }

    public function diseaseScores()
    {
        return $this->hasMany(DiseaseScore::class, 'trial_plot_id');
    }

    public function getPlotSizeM2Attribute(): ?float
    {
        if ($this->plot_length_m && $this->plot_width_m) {
            return round($this->plot_length_m * $this->plot_width_m, 2);
        }
        return null;
    }
}
