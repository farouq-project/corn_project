<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryImportStaging extends Model
{
    protected $table = 'inventory_import_staging';

    protected $fillable = [
        'import_batch_id', 'row_number',
        'raw_package_code', 'raw_genotype_code', 'raw_storage_unit_code',
        'raw_rack_label', 'raw_box_number', 'raw_row_position', 'raw_column_position',
        'raw_season_code', 'raw_source_trial_code', 'raw_harvest_date', 'raw_storage_date',
        'raw_expiry_date', 'raw_initial_weight_g', 'raw_remaining_weight_g',
        'raw_moisture_content', 'raw_germination_percentage', 'raw_germination_test_date',
        'raw_vigor_index', 'raw_seed_count', 'raw_storage_status', 'raw_notes',
        'norm_package_code', 'norm_genotype_id', 'norm_genotype_code', 'norm_storage_unit_id',
        'norm_rack_label', 'norm_box_number', 'norm_row_position', 'norm_column_position',
        'norm_season_id', 'norm_source_trial_id', 'norm_harvest_date', 'norm_storage_date',
        'norm_expiry_date', 'norm_initial_weight_g', 'norm_remaining_weight_g',
        'norm_moisture_content', 'norm_germination_percentage', 'norm_germination_test_date',
        'norm_vigor_index', 'norm_seed_count', 'norm_storage_status',
        'validation_status', 'validation_errors', 'validation_warnings',
        'is_duplicate_in_file', 'is_duplicate_in_db', 'duplicate_of_inventory_id', 'duplicate_of_row',
        'generated_qr_code', 'generated_barcode',
        'import_status', 'imported_inventory_id', 'imported_movement_id', 'import_error',
    ];

    protected $casts = [
        'validation_errors' => 'array',
        'validation_warnings' => 'array',
        'is_duplicate_in_file' => 'boolean',
        'is_duplicate_in_db' => 'boolean',
        'norm_harvest_date' => 'date',
        'norm_storage_date' => 'date',
        'norm_expiry_date' => 'date',
        'norm_germination_test_date' => 'date',
    ];

    public function batch()
    {
        return $this->belongsTo(InventoryImportBatch::class, 'import_batch_id');
    }

    public function resolvedGenotype()
    {
        return $this->belongsTo(Genotype::class, 'norm_genotype_id');
    }

    public function resolvedStorageUnit()
    {
        return $this->belongsTo(StorageUnit::class, 'norm_storage_unit_id');
    }

    public function importedInventory()
    {
        return $this->belongsTo(SeedInventory::class, 'imported_inventory_id');
    }

    public function isImportable(): bool
    {
        return in_array($this->validation_status, ['valid', 'warning'])
            && $this->import_status === 'pending';
    }

    public function getErrorCountAttribute(): int
    {
        return count($this->validation_errors ?? []);
    }

    public function getWarningCountAttribute(): int
    {
        return count($this->validation_warnings ?? []);
    }
}
