<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FieldActivity extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'activity_code', 'user_id', 'trial_id', 'location_id', 'genotype_id',
        'activity_type', 'activity_title', 'description', 'activity_date',
        'start_time', 'end_time', 'latitude', 'longitude',
        'photos', 'voice_note_path', 'materials_used', 'weather_conditions',
        'status', 'notes', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'activity_date' => 'date',
        'approved_at' => 'datetime',
        'photos' => 'array',
        'materials_used' => 'array',
        'weather_conditions' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function genotype()
    {
        return $this->belongsTo(Genotype::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function attachments()
    {
        return $this->morphMany(FileAttachment::class, 'attachable');
    }
}
