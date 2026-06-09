<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Season extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'season_code', 'season_name', 'start_date', 'end_date',
        'description', 'status', 'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function trials()
    {
        return $this->hasMany(Trial::class);
    }

    public function seedInventories()
    {
        return $this->hasMany(SeedInventory::class);
    }

    public function phenotypeObservations()
    {
        return $this->hasMany(PhenotypeObservation::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
