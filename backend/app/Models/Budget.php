<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Budget extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'budget_code', 'budget_name', 'season_id', 'trial_id',
        'funding_source', 'total_amount', 'allocated_amount',
        'start_date', 'end_date', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getSpentAmountAttribute(): float
    {
        return (float) $this->expenses()->where('approval_status', 'approved')->sum('amount');
    }

    public function getRemainingAmountAttribute(): float
    {
        return $this->total_amount - $this->spent_amount;
    }

    public function getUtilizationRateAttribute(): float
    {
        if ($this->total_amount <= 0) return 0;
        return round(($this->spent_amount / $this->total_amount) * 100, 1);
    }
}
