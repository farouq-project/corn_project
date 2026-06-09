<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ObservationSchedule extends Model
{
    protected $fillable = [
        'trial_id', 'environment_id', 'schedule_title', 'observation_type',
        'variable_category', 'scheduled_date', 'deadline_date',
        'growth_stage_target', 'assigned_to', 'status',
        'completion_date', 'completion_rate_percent',
        'reminder_sent', 'reminder_sent_at', 'reminder_days_before',
        'instructions', 'notes', 'created_by',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'deadline_date' => 'date',
        'completion_date' => 'date',
        'reminder_sent' => 'boolean',
        'reminder_sent_at' => 'datetime',
    ];

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isOverdue(): bool
    {
        return $this->status === 'pending' &&
            $this->scheduled_date < now()->toDateString();
    }
}
