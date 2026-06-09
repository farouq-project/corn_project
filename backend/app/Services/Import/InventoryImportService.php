<?php

namespace App\Services\Import;

use App\Models\InventoryImportBatch;
use App\Models\InventoryImportStaging;
use App\Models\SeedInventory;
use App\Models\SeedMovement;
use App\Models\StorageUnit;
use App\Models\StorageUnitImportStaging;
use App\Services\AuditService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class InventoryImportService
{
    public function __construct(
        private NormalizationService $normalizer,
        private ValidationEngine $validator,
    ) {}

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: UPLOAD & PARSE
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Accept an uploaded Excel file, store it, parse rows into staging table.
     * Returns the batch record.
     */
    public function uploadAndParse(UploadedFile $file, string $importType, int $userId): InventoryImportBatch
    {
        // Store the file for audit
        $fileHash = hash_file('sha256', $file->getPathname());
        $folder = "imports/{$importType}/" . date('Y/m');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs($folder, $filename, 'local');

        // Create batch record
        $batch = InventoryImportBatch::create([
            'batch_code' => 'IMP-' . date('Ymd') . '-' . strtoupper(Str::random(4)),
            'import_type' => $importType,
            'original_filename' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_hash' => $fileHash,
            'status' => 'parsing',
            'uploaded_by' => $userId,
        ]);

        try {
            if ($importType === 'seed_inventory') {
                $this->parseInventoryFile($batch, $file);
            } else {
                $this->parseStorageUnitFile($batch, $file);
            }

            $batch->update(['status' => 'parsed']);
        } catch (\Exception $e) {
            $batch->update(['status' => 'failed', 'status_message' => $e->getMessage()]);
            throw $e;
        }

        return $batch->refresh();
    }

    /**
     * Parse inventory Excel rows into staging table.
     */
    private function parseInventoryFile(InventoryImportBatch $batch, UploadedFile $file): void
    {
        $rows = $this->readExcel($file);
        $totalRows = 0;

        $stagingRows = [];
        foreach ($rows as $rowNum => $row) {
            if ($rowNum === 1) continue; // skip header
            if ($this->isBlankRow($row)) continue;

            $totalRows++;
            $stagingRows[] = [
                'import_batch_id' => $batch->id,
                'row_number' => $rowNum,
                'raw_package_code' => $this->cell($row, 0),
                'raw_genotype_code' => $this->cell($row, 1),
                'raw_storage_unit_code' => $this->cell($row, 2),
                'raw_rack_label' => $this->cell($row, 3),
                'raw_box_number' => $this->cell($row, 4),
                'raw_row_position' => $this->cell($row, 5),
                'raw_column_position' => $this->cell($row, 6),
                'raw_season_code' => $this->cell($row, 7),
                'raw_source_trial_code' => $this->cell($row, 8),
                'raw_harvest_date' => $this->cell($row, 9),
                'raw_storage_date' => $this->cell($row, 10),
                'raw_expiry_date' => $this->cell($row, 11),
                'raw_initial_weight_g' => $this->cell($row, 12),
                'raw_remaining_weight_g' => $this->cell($row, 13),
                'raw_moisture_content' => $this->cell($row, 14),
                'raw_germination_percentage' => $this->cell($row, 15),
                'raw_germination_test_date' => $this->cell($row, 16),
                'raw_vigor_index' => $this->cell($row, 17),
                'raw_seed_count' => $this->cell($row, 18),
                'raw_storage_status' => $this->cell($row, 19),
                'raw_notes' => $this->cell($row, 20),
                'validation_status' => 'pending',
                'import_status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        // Bulk insert into staging
        foreach (array_chunk($stagingRows, 500) as $chunk) {
            InventoryImportStaging::insert($chunk);
        }

        $batch->update(['total_rows' => $totalRows]);
    }

    /**
     * Parse storage unit Excel rows.
     */
    private function parseStorageUnitFile(InventoryImportBatch $batch, UploadedFile $file): void
    {
        $rows = $this->readExcel($file);
        $totalRows = 0;
        $stagingRows = [];

        foreach ($rows as $rowNum => $row) {
            if ($rowNum === 1) continue;
            if ($this->isBlankRow($row)) continue;

            $totalRows++;
            $stagingRows[] = [
                'import_batch_id' => $batch->id,
                'row_number' => $rowNum,
                'raw_unit_code' => $this->cell($row, 0),
                'raw_unit_name' => $this->cell($row, 1),
                'raw_unit_type' => $this->cell($row, 2),
                'raw_room_name' => $this->cell($row, 3),
                'raw_building' => $this->cell($row, 4),
                'raw_temperature_min' => $this->cell($row, 5),
                'raw_temperature_max' => $this->cell($row, 6),
                'raw_humidity_min' => $this->cell($row, 7),
                'raw_humidity_max' => $this->cell($row, 8),
                'raw_capacity_racks' => $this->cell($row, 9),
                'raw_capacity_boxes_per_rack' => $this->cell($row, 10),
                'raw_is_active' => $this->cell($row, 11),
                'raw_description' => $this->cell($row, 12),
                'validation_status' => 'pending',
                'import_status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        foreach (array_chunk($stagingRows, 500) as $chunk) {
            StorageUnitImportStaging::insert($chunk);
        }

        $batch->update(['total_rows' => $totalRows]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: NORMALIZE + VALIDATE
    // ──────────────────────────────────────────────────────────────────────────

    public function normalizeAndValidate(InventoryImportBatch $batch): InventoryImportBatch
    {
        $batch->update(['status' => 'validating']);

        if ($batch->import_type === 'seed_inventory') {
            $this->validateInventoryBatch($batch);
        } else {
            $this->validateStorageUnitBatch($batch);
        }

        $batch->update(['status' => 'validated']);

        return $batch->refresh();
    }

    private function validateInventoryBatch(InventoryImportBatch $batch): void
    {
        $stagingRows = InventoryImportStaging::where('import_batch_id', $batch->id)->get();

        // Register all package codes in file for duplicate detection
        $this->validator->registerFileCodes(
            $stagingRows->pluck('raw_package_code')->toArray()
        );

        $validCount = $invalidCount = $warningCount = $duplicateCount = 0;

        foreach ($stagingRows as $row) {
            // Normalize all fields
            $norm = [
                'package_code' => $this->normalizer->normalizePackageCode($row->raw_package_code),
                'genotype_code' => $this->normalizer->normalizeGenotypeCode($row->raw_genotype_code),
                'storage_unit_code' => $this->normalizer->normalizeStorageUnitCode($row->raw_storage_unit_code),
                'rack_label' => trim($row->raw_rack_label ?? '') ?: null,
                'box_number' => trim($row->raw_box_number ?? '') ?: null,
                'row_position' => trim($row->raw_row_position ?? '') ?: null,
                'column_position' => trim($row->raw_column_position ?? '') ?: null,
                'season_code' => $this->normalizer->normalizeSeasonCode($row->raw_season_code),
                'source_trial_code' => strtoupper(trim($row->raw_source_trial_code ?? '')) ?: null,
                'harvest_date' => $this->normalizer->normalizeDate($row->raw_harvest_date),
                'storage_date' => $this->normalizer->normalizeDate($row->raw_storage_date) ?? now()->format('Y-m-d'),
                'expiry_date' => $this->normalizer->normalizeDate($row->raw_expiry_date),
                'initial_weight_g' => $this->normalizer->normalizeWeightToGrams($row->raw_initial_weight_g) ?? 0,
                'remaining_weight_g' => $this->normalizer->normalizeWeightToGrams($row->raw_remaining_weight_g),
                'moisture_content' => $this->normalizer->normalizeDecimal($row->raw_moisture_content),
                'germination_percentage' => $this->normalizer->normalizeDecimal($row->raw_germination_percentage),
                'germination_test_date' => $this->normalizer->normalizeDate($row->raw_germination_test_date),
                'vigor_index' => $this->normalizer->normalizeDecimal($row->raw_vigor_index),
                'seed_count' => $this->normalizer->normalizeInteger($row->raw_seed_count),
                'storage_status' => $this->normalizer->normalizeStorageStatus($row->raw_storage_status),
            ];

            $raw = [
                'genotype_code' => $row->raw_genotype_code,
                'storage_unit_code' => $row->raw_storage_unit_code,
                'storage_date' => $row->raw_storage_date,
                'harvest_date' => $row->raw_harvest_date,
                'expiry_date' => $row->raw_expiry_date,
                'initial_weight_g' => $row->raw_initial_weight_g,
                'remaining_weight_g' => $row->raw_remaining_weight_g,
                'moisture_content' => $row->raw_moisture_content,
                'germination_percentage' => $row->raw_germination_percentage,
                'storage_status' => $row->raw_storage_status,
                'season_code' => $row->raw_season_code,
                'source_trial_code' => $row->raw_source_trial_code,
            ];

            $result = $this->validator->validateInventoryRow($norm, $raw, $row->row_number);

            // Default remaining_weight_g to initial if not provided
            if ($norm['remaining_weight_g'] === null && $norm['initial_weight_g'] !== null) {
                $norm['remaining_weight_g'] = $norm['initial_weight_g'];
            }

            $row->update([
                'norm_package_code' => $norm['package_code'],
                'norm_genotype_code' => $norm['genotype_code'],
                'norm_genotype_id' => $result['resolved']['genotype_id'] ?? null,
                'norm_storage_unit_id' => $result['resolved']['storage_unit_id'] ?? null,
                'norm_rack_label' => $norm['rack_label'],
                'norm_box_number' => $norm['box_number'],
                'norm_row_position' => $norm['row_position'],
                'norm_column_position' => $norm['column_position'],
                'norm_season_id' => $result['resolved']['season_id'] ?? null,
                'norm_source_trial_id' => $result['resolved']['source_trial_id'] ?? null,
                'norm_harvest_date' => $norm['harvest_date'],
                'norm_storage_date' => $norm['storage_date'],
                'norm_expiry_date' => $norm['expiry_date'],
                'norm_initial_weight_g' => $norm['initial_weight_g'],
                'norm_remaining_weight_g' => $norm['remaining_weight_g'],
                'norm_moisture_content' => $norm['moisture_content'],
                'norm_germination_percentage' => $norm['germination_percentage'],
                'norm_germination_test_date' => $norm['germination_test_date'],
                'norm_vigor_index' => $norm['vigor_index'],
                'norm_seed_count' => $norm['seed_count'],
                'norm_storage_status' => $norm['storage_status'] ?? 'good',
                'validation_status' => $result['status'],
                'validation_errors' => $result['errors'] ?: null,
                'validation_warnings' => $result['warnings'] ?: null,
                'is_duplicate_in_file' => $result['is_duplicate_in_file'],
                'is_duplicate_in_db' => $result['is_duplicate_in_db'],
            ]);

            match ($result['status']) {
                'valid' => $validCount++,
                'warning' => $warningCount++,
                'invalid' => $invalidCount++,
                'duplicate' => $duplicateCount++,
                default => null,
            };
        }

        $batch->update([
            'valid_rows' => $validCount + $warningCount,
            'invalid_rows' => $invalidCount,
            'warning_rows' => $warningCount,
            'duplicate_rows' => $duplicateCount,
        ]);
    }

    private function validateStorageUnitBatch(InventoryImportBatch $batch): void
    {
        $stagingRows = StorageUnitImportStaging::where('import_batch_id', $batch->id)->get();
        $validCount = $invalidCount = $warningCount = $duplicateCount = 0;

        foreach ($stagingRows as $row) {
            $norm = [
                'unit_code' => $this->normalizer->normalizeStorageUnitCode($row->raw_unit_code),
                'unit_name' => trim($row->raw_unit_name ?? ''),
                'unit_type' => $this->normalizer->normalizeUnitType($row->raw_unit_type),
                'room_name' => trim($row->raw_room_name ?? '') ?: null,
                'building' => trim($row->raw_building ?? '') ?: null,
                'temperature_min' => $this->normalizer->normalizeDecimal($row->raw_temperature_min),
                'temperature_max' => $this->normalizer->normalizeDecimal($row->raw_temperature_max),
                'humidity_min' => $this->normalizer->normalizeDecimal($row->raw_humidity_min),
                'humidity_max' => $this->normalizer->normalizeDecimal($row->raw_humidity_max),
                'capacity_racks' => $this->normalizer->normalizeInteger($row->raw_capacity_racks),
                'capacity_boxes_per_rack' => $this->normalizer->normalizeInteger($row->raw_capacity_boxes_per_rack),
                'is_active' => $this->normalizer->normalizeBoolean($row->raw_is_active) ?? true,
            ];

            $result = $this->validator->validateStorageUnitRow($norm, (array) $row->toArray(), $row->row_number);

            $row->update([
                'norm_unit_code' => $norm['unit_code'],
                'norm_unit_name' => $norm['unit_name'],
                'norm_unit_type' => $norm['unit_type'],
                'norm_temperature_min' => $norm['temperature_min'],
                'norm_temperature_max' => $norm['temperature_max'],
                'norm_humidity_min' => $norm['humidity_min'],
                'norm_humidity_max' => $norm['humidity_max'],
                'norm_capacity_racks' => $norm['capacity_racks'],
                'norm_capacity_boxes_per_rack' => $norm['capacity_boxes_per_rack'],
                'norm_is_active' => $norm['is_active'],
                'validation_status' => $result['status'],
                'validation_errors' => $result['errors'] ?: null,
                'validation_warnings' => $result['warnings'] ?: null,
                'is_duplicate_in_db' => $result['is_duplicate_in_db'],
            ]);

            match ($result['status']) {
                'valid' => $validCount++,
                'warning' => $warningCount++,
                'invalid' => $invalidCount++,
                'duplicate' => $duplicateCount++,
                default => null,
            };
        }

        $batch->update([
            'valid_rows' => $validCount + $warningCount,
            'invalid_rows' => $invalidCount,
            'warning_rows' => $warningCount,
            'duplicate_rows' => $duplicateCount,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: CONFIRM & IMPORT
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Confirm and execute the import for a validated batch.
     * Only valid/warning rows are inserted.
     * Each insert creates an in_initial seed_movement for audit trail.
     *
     * @param  array $skipRowNumbers  Row numbers the user has chosen to skip
     */
    public function confirmImport(
        InventoryImportBatch $batch,
        int $confirmedByUserId,
        array $skipRowNumbers = []
    ): array {
        if (!in_array($batch->status, ['validated', 'partial'])) {
            throw new \LogicException("Batch {$batch->batch_code} is not in a confirmable state (status: {$batch->status})");
        }

        $batch->update([
            'status' => 'importing',
            'confirmed_by' => $confirmedByUserId,
            'confirmed_at' => now(),
        ]);

        $imported = 0;
        $failed = 0;
        $skipped = 0;

        if ($batch->import_type === 'seed_inventory') {
            ['imported' => $imported, 'failed' => $failed, 'skipped' => $skipped] =
                $this->importInventoryRows($batch, $confirmedByUserId, $skipRowNumbers);
        } else {
            ['imported' => $imported, 'failed' => $failed, 'skipped' => $skipped] =
                $this->importStorageUnitRows($batch, $confirmedByUserId, $skipRowNumbers);
        }

        $finalStatus = $failed > 0 ? 'partial' : 'completed';

        $batch->update([
            'status' => $finalStatus,
            'imported_rows' => $imported,
            'import_completed_at' => now(),
            'status_message' => "{$imported} baris berhasil diimport, {$failed} gagal, {$skipped} dilewati.",
        ]);

        AuditService::logAction('import_confirmed', $batch, [
            'imported' => $imported,
            'failed' => $failed,
            'skipped' => $skipped,
        ]);

        return compact('imported', 'failed', 'skipped');
    }

    private function importInventoryRows(
        InventoryImportBatch $batch,
        int $userId,
        array $skipRows
    ): array {
        $rows = InventoryImportStaging::where('import_batch_id', $batch->id)
            ->whereIn('validation_status', ['valid', 'warning'])
            ->where('import_status', 'pending')
            ->get();

        $imported = $failed = $skipped = 0;

        foreach ($rows as $row) {
            if (in_array($row->row_number, $skipRows)) {
                $row->update(['import_status' => 'skipped']);
                $skipped++;
                continue;
            }

            DB::beginTransaction();
            try {
                // Generate QR and barcode
                $qrCode = 'QR-' . strtoupper(Str::random(12));
                $barcode = 'BC-' . str_pad(SeedInventory::withTrashed()->count() + 1, 8, '0', STR_PAD_LEFT);

                $inventory = SeedInventory::create([
                    'package_code' => $row->norm_package_code,
                    'qr_code' => $qrCode,
                    'barcode' => $barcode,
                    'genotype_id' => $row->norm_genotype_id,
                    'storage_unit_id' => $row->norm_storage_unit_id,
                    'rack_label' => $row->norm_rack_label,
                    'box_number' => $row->norm_box_number,
                    'row_position' => $row->norm_row_position,
                    'column_position' => $row->norm_column_position,
                    'season_id' => $row->norm_season_id,
                    'source_trial_id' => $row->norm_source_trial_id,
                    'harvest_date' => $row->norm_harvest_date,
                    'storage_date' => $row->norm_storage_date,
                    'expiry_date' => $row->norm_expiry_date,
                    'initial_weight_g' => $row->norm_initial_weight_g,
                    'remaining_weight_g' => $row->norm_remaining_weight_g ?? $row->norm_initial_weight_g,
                    'moisture_content' => $row->norm_moisture_content,
                    'germination_percentage' => $row->norm_germination_percentage,
                    'germination_test_date' => $row->norm_germination_test_date,
                    'vigor_index' => $row->norm_vigor_index,
                    'seed_count' => $row->norm_seed_count,
                    'storage_status' => $row->norm_storage_status ?? 'good',
                    'created_by' => $userId,
                ]);

                // MANDATORY: Create initial movement record for audit trail
                $movement = SeedMovement::create([
                    'movement_code' => 'MOV-INIT-' . date('Ymd') . '-' . strtoupper(Str::random(6)),
                    'seed_inventory_id' => $inventory->id,
                    'movement_type' => 'in_initial',
                    'quantity_g' => $row->norm_initial_weight_g,
                    'balance_after_g' => $row->norm_remaining_weight_g ?? $row->norm_initial_weight_g,
                    'to_storage_unit_id' => $row->norm_storage_unit_id,
                    'movement_date' => $row->norm_storage_date,
                    'reason' => "Import historis dari file: {$batch->original_filename}",
                    'notes' => "Batch: {$batch->batch_code}, Row: {$row->row_number}",
                    'performed_by' => $userId,
                    'approved_by' => $userId,
                    'approved_at' => now(),
                ]);

                $row->update([
                    'import_status' => 'imported',
                    'imported_inventory_id' => $inventory->id,
                    'imported_movement_id' => $movement->id,
                    'generated_qr_code' => $qrCode,
                    'generated_barcode' => $barcode,
                ]);

                DB::commit();
                $imported++;
            } catch (\Exception $e) {
                DB::rollBack();
                $row->update([
                    'import_status' => 'failed',
                    'import_error' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        return compact('imported', 'failed', 'skipped');
    }

    private function importStorageUnitRows(
        InventoryImportBatch $batch,
        int $userId,
        array $skipRows
    ): array {
        $rows = StorageUnitImportStaging::where('import_batch_id', $batch->id)
            ->whereIn('validation_status', ['valid', 'warning'])
            ->where('import_status', 'pending')
            ->get();

        $imported = $failed = $skipped = 0;

        foreach ($rows as $row) {
            if (in_array($row->row_number, $skipRows)) {
                $row->update(['import_status' => 'skipped']);
                $skipped++;
                continue;
            }

            try {
                $unit = StorageUnit::create([
                    'unit_code' => $row->norm_unit_code,
                    'unit_name' => $row->norm_unit_name,
                    'unit_type' => $row->norm_unit_type,
                    'room_name' => $row->raw_room_name,
                    'building' => $row->raw_building,
                    'temperature_min' => $row->norm_temperature_min,
                    'temperature_max' => $row->norm_temperature_max,
                    'humidity_min' => $row->norm_humidity_min,
                    'humidity_max' => $row->norm_humidity_max,
                    'capacity_racks' => $row->norm_capacity_racks,
                    'capacity_boxes_per_rack' => $row->norm_capacity_boxes_per_rack,
                    'is_active' => $row->norm_is_active ?? true,
                    'description' => $row->raw_description,
                    'created_by' => $userId,
                ]);

                $row->update(['import_status' => 'imported', 'imported_unit_id' => $unit->id]);
                $imported++;
            } catch (\Exception $e) {
                $row->update(['import_status' => 'failed', 'import_error' => $e->getMessage()]);
                $failed++;
            }
        }

        return compact('imported', 'failed', 'skipped');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: ROLLBACK
    // ──────────────────────────────────────────────────────────────────────────

    public function rollback(InventoryImportBatch $batch, int $rolledBackByUserId): array
    {
        if (!in_array($batch->status, ['completed', 'partial'])) {
            throw new \LogicException("Only completed/partial batches can be rolled back.");
        }

        $deleted = 0;

        DB::beginTransaction();
        try {
            if ($batch->import_type === 'seed_inventory') {
                $importedRows = InventoryImportStaging::where('import_batch_id', $batch->id)
                    ->where('import_status', 'imported')
                    ->whereNotNull('imported_inventory_id')
                    ->get();

                foreach ($importedRows as $row) {
                    // Delete movement first (FK dependency)
                    if ($row->imported_movement_id) {
                        SeedMovement::destroy($row->imported_movement_id);
                    }
                    // Force-delete inventory (soft-delete + hard-delete)
                    SeedInventory::withTrashed()->find($row->imported_inventory_id)?->forceDelete();
                    $deleted++;
                }
            } else {
                $importedRows = StorageUnitImportStaging::where('import_batch_id', $batch->id)
                    ->where('import_status', 'imported')
                    ->whereNotNull('imported_unit_id')
                    ->get();

                foreach ($importedRows as $row) {
                    StorageUnit::withTrashed()->find($row->imported_unit_id)?->forceDelete();
                    $deleted++;
                }
            }

            $batch->update([
                'status' => 'rolled_back',
                'is_rolled_back' => true,
                'rolled_back_at' => now(),
                'rolled_back_by' => $rolledBackByUserId,
                'status_message' => "{$deleted} records dihapus saat rollback.",
            ]);

            AuditService::logAction('import_rolled_back', $batch, ['deleted_records' => $deleted]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return ['deleted' => $deleted];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PREVIEW / REPORT
    // ──────────────────────────────────────────────────────────────────────────

    public function getPreviewData(InventoryImportBatch $batch, array $filters = []): array
    {
        $query = $batch->import_type === 'seed_inventory'
            ? InventoryImportStaging::where('import_batch_id', $batch->id)
            : StorageUnitImportStaging::where('import_batch_id', $batch->id);

        if (!empty($filters['validation_status'])) {
            $query->where('validation_status', $filters['validation_status']);
        }

        $rows = $query->orderBy('row_number')->get();

        return [
            'batch' => $batch,
            'summary' => [
                'total' => $batch->total_rows,
                'valid' => $batch->valid_rows,
                'invalid' => $batch->invalid_rows,
                'warnings' => $batch->warning_rows,
                'duplicates' => $batch->duplicate_rows,
                'ready_to_import' => $batch->valid_rows,
            ],
            'rows' => $rows,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    private function readExcel(UploadedFile $file): array
    {
        $rows = [];
        $data = Excel::toArray([], $file);
        foreach ($data[0] ?? [] as $index => $row) {
            $rows[$index + 1] = $row;
        }
        return $rows;
    }

    private function cell(array $row, int $index): ?string
    {
        $value = $row[$index] ?? null;
        if ($value === null || $value === '') return null;
        return trim((string) $value);
    }

    private function isBlankRow(array $row): bool
    {
        return collect($row)->filter(fn($v) => $v !== null && $v !== '')->isEmpty();
    }
}
