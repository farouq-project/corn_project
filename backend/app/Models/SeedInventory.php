<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SeedInventory extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'package_code', 'qr_code', 'barcode', 'genotype_id', 'storage_unit_id',
        'rack_label', 'box_number', 'row_position', 'column_position',
        'season_id', 'source_trial_id', 'harvest_date', 'storage_date',
        'expiry_date', 'initial_weight_g', 'remaining_weight_g',
        'moisture_content', 'germination_percentage', 'germination_test_date',
        'vigor_index', 'seed_count', 'storage_status', 'notes', 'created_by',
    ];

    protected $casts = [
        'harvest_date' => 'date',
        'storage_date' => 'date',
        'expiry_date' => 'date',
        'germination_test_date' => 'date',
    ];

    public function genotype()
    {
        return $this->belongsTo(Genotype::class);
    }

    public function storageUnit()
    {
        return $this->belongsTo(StorageUnit::class);
    }

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function sourceTrial()
    {
        return $this->belongsTo(Trial::class, 'source_trial_id');
    }

    public function movements()
    {
        return $this->hasMany(SeedMovement::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getUsagePercentageAttribute(): float
    {
        if ($this->initial_weight_g <= 0) return 0;
        $used = $this->initial_weight_g - $this->remaining_weight_g;
        return round(($used / $this->initial_weight_g) * 100, 1);
    }

    public function getStorageAgeAttribute(): int
    {
        return $this->storage_date ? now()->diffInDays($this->storage_date) : 0;
    }

    public function isLowStock(float $threshold = 50.0): bool
    {
        return $this->remaining_weight_g <= $threshold;
    }

    public function isHighMoisture(float $threshold = 14.0): bool
    {
        return $this->moisture_content && $this->moisture_content > $threshold;
    }
}
