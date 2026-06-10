<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ObservationImportStaging extends Model
{
    protected $table = 'observation_import_staging';

    protected $fillable = [
        'import_batch_id', 'row_number',
        'raw_data', 'normalized_data',
        'status', 'errors', 'warnings',
        'imported_observation_record_id',
    ];

    protected $casts = [
        'raw_data' => 'array',
        'normalized_data' => 'array',
        'errors' => 'array',
        'warnings' => 'array',
    ];

    public function batch()
    {
        return $this->belongsTo(PhenotypingImportBatch::class, 'import_batch_id');
    }

    public function importedRecord()
    {
        return $this->belongsTo(ObservationRecord::class, 'imported_observation_record_id');
    }
}
