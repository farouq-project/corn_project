<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PhenotypingImportBatch extends Model
{
    protected $fillable = [
        'batch_code', 'original_filename', 'file_path', 'file_hash',
        'total_rows', 'valid_rows', 'invalid_rows', 'warning_rows', 'imported_rows',
        'status', 'status_message',
        'is_rolled_back', 'rolled_back_at', 'rolled_back_by',
        'uploaded_by', 'confirmed_by', 'confirmed_at', 'import_completed_at',
    ];

    protected $casts = [
        'confirmed_at' => 'datetime',
        'import_completed_at' => 'datetime',
        'rolled_back_at' => 'datetime',
        'is_rolled_back' => 'boolean',
    ];

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function confirmer()
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function stagingRows()
    {
        return $this->hasMany(ObservationImportStaging::class, 'import_batch_id');
    }

    public function canConfirm(): bool
    {
        return $this->status === 'validated' && $this->valid_rows > 0;
    }
}
