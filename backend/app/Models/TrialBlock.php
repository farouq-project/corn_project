<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrialBlock extends Model
{
    protected $fillable = [
        'trial_id', 'environment_id', 'block_number', 'block_label',
        'row_start', 'row_end', 'col_start', 'col_end', 'notes',
    ];

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function plots()
    {
        return $this->hasMany(TrialPlot::class);
    }

    public function observations()
    {
        return $this->hasMany(PlotObservation::class, 'trial_block_id');
    }
}
