<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Genotype extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'genotype_code', 'old_code', 'genotype_name', 'category',
        'trial_type', 'origin', 'breeder', 'release_year',
        'breeder_notes', 'pedigree', 'status', 'created_by',
    ];

    public function trials()
    {
        return $this->belongsToMany(Trial::class, 'trial_genotypes')
            ->withPivot('entry_number', 'treatment_label', 'is_check', 'notes')
            ->withTimestamps();
    }

    public function seedInventories()
    {
        return $this->hasMany(SeedInventory::class);
    }

    public function phenotypeObservations()
    {
        return $this->hasMany(PhenotypeObservation::class);
    }

    public function fieldActivities()
    {
        return $this->hasMany(FieldActivity::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getTotalSeedWeightAttribute(): float
    {
        return (float) $this->seedInventories()->where('storage_status', '!=', 'depleted')->sum('remaining_weight_g');
    }
}
