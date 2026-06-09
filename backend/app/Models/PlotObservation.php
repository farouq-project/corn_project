<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PlotObservation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'observation_code', 'trial_plot_id', 'trial_id', 'environment_id',
        'trial_block_id', 'genotype_id', 'observation_date', 'growth_stage',
        'days_after_planting', 'total_variables_expected', 'total_variables_filled',
        'status', 'general_notes', 'photos',
        'recorded_by', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'observation_date' => 'date',
        'approved_at' => 'datetime',
        'photos' => 'array',
    ];

    public function plot()
    {
        return $this->belongsTo(TrialPlot::class, 'trial_plot_id');
    }

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

    public function values()
    {
        return $this->hasMany(PlotObservationValue::class, 'observation_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function getCompletionRateAttribute(): float
    {
        if ($this->total_variables_expected <= 0) return 0;
        return round(($this->total_variables_filled / $this->total_variables_expected) * 100, 1);
    }
}
