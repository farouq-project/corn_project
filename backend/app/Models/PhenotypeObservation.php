<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PhenotypeObservation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'observation_code', 'trial_id', 'genotype_id', 'season_id',
        'replication', 'plot_number', 'row_label', 'observation_date',
        'growth_stage', 'status', 'general_notes', 'photos',
        'recorded_by', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'observation_date' => 'date',
        'approved_at' => 'datetime',
        'photos' => 'array',
    ];

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function genotype()
    {
        return $this->belongsTo(Genotype::class);
    }

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function values()
    {
        return $this->hasMany(PhenotypeValue::class, 'observation_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
