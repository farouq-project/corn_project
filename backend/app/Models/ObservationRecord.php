<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ObservationRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'trial_id', 'record_code', 'plot_no', 'genotype_id', 'environment_id', 'environment_condition_id', 'season_id',
        'replication', 'recorded_by', 'notes',
    ];

    protected static function booted(): void
    {
        static::creating(function (ObservationRecord $record) {
            if (empty($record->season_id) && $record->environment_id) {
                $record->season_id = Environment::find($record->environment_id)?->season_id;
            }
        });
    }

    public function genotype()
    {
        return $this->belongsTo(Genotype::class);
    }

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function values()
    {
        return $this->hasMany(ObservationValue::class, 'observation_record_id');
    }
}
