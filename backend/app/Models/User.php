<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, HasRoles, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'password', 'employee_id',
        'phone', 'institution', 'avatar', 'status',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function trials()
    {
        return $this->hasMany(Trial::class, 'principal_researcher_id');
    }

    public function trialAssignments()
    {
        return $this->belongsToMany(Trial::class, 'trial_researchers', 'user_id', 'trial_id')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function fieldActivities()
    {
        return $this->hasMany(FieldActivity::class);
    }

    public function phenotypeObservations()
    {
        return $this->hasMany(PhenotypeObservation::class, 'recorded_by');
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class, 'submitted_by');
    }

    public function systemNotifications()
    {
        return $this->hasMany(SystemNotification::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }
}
