<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StorageMonitorEntry extends Model
{
    protected $table = 'storage_monitor_entries';

    protected $fillable = [
        'entry_number', 'prev_code', 'new_code', 'prev_box', 'new_box',
        'genotype_name', 'prev_packaging', 'new_packaging',
        'harvest_date', 'seed_weight', 'moisture_content', 'notes',
        'recorded_by',
    ];

    protected $casts = [
        'harvest_date' => 'date',
        'seed_weight' => 'decimal:2',
        'moisture_content' => 'decimal:2',
    ];

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
