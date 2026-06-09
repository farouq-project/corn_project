<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImportJob extends Model
{
    protected $fillable = [
        'job_code', 'type', 'file_path', 'original_filename',
        'total_rows', 'processed_rows', 'success_rows', 'failed_rows',
        'errors', 'status', 'imported_by', 'started_at', 'completed_at',
    ];

    protected $casts = [
        'errors' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function importer()
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    public function getProgressAttribute(): float
    {
        if ($this->total_rows <= 0) return 0;
        return round(($this->processed_rows / $this->total_rows) * 100, 1);
    }
}
