<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrialEnvironment extends Model
{
    protected $fillable = [
        'trial_id', 'environment_id', 'local_trial_code',
        'status', 'local_coordinator_id', 'notes',
    ];

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function localCoordinator()
    {
        return $this->belongsTo(User::class, 'local_coordinator_id');
    }
}
