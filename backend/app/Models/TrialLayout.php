<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrialLayout extends Model
{
    protected $fillable = [
        'trial_id', 'environment_id',
        'total_rows', 'total_columns', 'layout_direction', 'border_type',
        'plot_grid', 'randomization_method', 'randomization_seed',
        'randomized_at', 'randomized_by', 'field_sketch_path', 'notes',
    ];

    protected $casts = [
        'plot_grid' => 'array',
        'randomized_at' => 'datetime',
    ];

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function randomizer()
    {
        return $this->belongsTo(User::class, 'randomized_by');
    }
}
