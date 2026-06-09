<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StorageUnitImportStaging extends Model
{
    protected $table = 'storage_unit_import_staging';

    protected $fillable = [
        'import_batch_id', 'row_number',
        'raw_unit_code', 'raw_unit_name', 'raw_unit_type', 'raw_room_name', 'raw_building',
        'raw_temperature_min', 'raw_temperature_max', 'raw_humidity_min', 'raw_humidity_max',
        'raw_capacity_racks', 'raw_capacity_boxes_per_rack', 'raw_is_active', 'raw_description',
        'norm_unit_code', 'norm_unit_name', 'norm_unit_type',
        'norm_temperature_min', 'norm_temperature_max', 'norm_humidity_min', 'norm_humidity_max',
        'norm_capacity_racks', 'norm_capacity_boxes_per_rack', 'norm_is_active',
        'validation_status', 'validation_errors', 'validation_warnings',
        'is_duplicate_in_file', 'is_duplicate_in_db',
        'import_status', 'imported_unit_id', 'import_error',
    ];

    protected $casts = [
        'validation_errors' => 'array',
        'validation_warnings' => 'array',
        'norm_is_active' => 'boolean',
        'is_duplicate_in_file' => 'boolean',
        'is_duplicate_in_db' => 'boolean',
    ];

    public function batch()
    {
        return $this->belongsTo(InventoryImportBatch::class, 'import_batch_id');
    }
}
