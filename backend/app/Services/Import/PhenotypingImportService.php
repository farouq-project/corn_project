<?php

namespace App\Services\Import;

use App\Models\Characteristic;
use App\Models\PhenotypingImportBatch;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * Phase 2 scaffolding: bulk import pipeline for "Data Pengamatan"
 * spreadsheets into observation_records / observation_values.
 *
 * Follows the same 4-step flow as InventoryImportService:
 *   upload & parse -> normalize & validate -> preview -> confirm/rollback
 *
 * See backend/docs/PHENOTYPING_IMPORT_DESIGN.md for the full design.
 * Only uploadAndParse() (batch creation + raw row capture) and the
 * Excel template generation are implemented in this phase; the
 * remaining steps are marked TODO Phase 2.
 */
class PhenotypingImportService
{
    public function __construct(
        private PhenotypingNormalizationService $normalizer,
        private PhenotypingValidationEngine $validator,
    ) {}

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: UPLOAD & PARSE
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Accept an uploaded "Data Pengamatan" Excel file, store it, and
     * register a batch. Row parsing into observation_import_staging
     * is TODO Phase 2.
     */
    public function uploadAndParse(UploadedFile $file, int $userId): PhenotypingImportBatch
    {
        $fileHash = hash_file('sha256', $file->getPathname());
        $folder = 'imports/phenotyping/' . date('Y/m');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs($folder, $filename, 'local');

        $batch = PhenotypingImportBatch::create([
            'batch_code' => 'PIMP-' . date('Ymd') . '-' . strtoupper(Str::random(4)),
            'original_filename' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_hash' => $fileHash,
            'status' => 'parsing',
            'uploaded_by' => $userId,
        ]);

        // TODO Phase 2: parse Excel rows into observation_import_staging.
        // Expected columns: No Plot | Kode Gen | Gen | Environment | R | <one column per active characteristic code>
        // For each data row:
        //   - capture raw_data as {header => cell value}
        //   - create ObservationImportStaging row with status=pending

        $batch->update(['status' => 'parsed']);

        return $batch->refresh();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: NORMALIZE & VALIDATE
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * TODO Phase 2: for each pending staging row, normalize raw_data via
     * PhenotypingNormalizationService, validate via PhenotypingValidationEngine,
     * write normalized_data/status/errors/warnings back to the row, and
     * update batch row counters + status=validated.
     */
    public function normalizeAndValidate(PhenotypingImportBatch $batch): PhenotypingImportBatch
    {
        return $batch;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: PREVIEW
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * TODO Phase 2: return paginated staging rows (with status/errors/warnings)
     * for the review UI, optionally filtered by status.
     */
    public function getPreviewData(PhenotypingImportBatch $batch, array $filters = []): array
    {
        return [];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: CONFIRM / ROLLBACK
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * TODO Phase 2: for each valid/warning staging row, create or update
     * an ObservationRecord + ObservationValue rows inside a transaction,
     * recording imported_observation_record_id back on the staging row.
     */
    public function confirmImport(PhenotypingImportBatch $batch, int $confirmedByUserId): PhenotypingImportBatch
    {
        return $batch;
    }

    /**
     * TODO Phase 2: soft-delete all observation_records created by this
     * batch (via imported_observation_record_id) and mark the batch
     * status=rolled_back.
     */
    public function rollback(PhenotypingImportBatch $batch, int $rolledBackByUserId): array
    {
        return [];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEMPLATE GENERATION (implemented now)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Build the "Data Pengamatan" import template: static columns
     * (No Plot, Kode Gen, Gen, Environment, R) + one column per
     * active characteristic, ordered by display_order.
     *
     * @return array<int, string> header row
     */
    public function buildTemplateHeaders(): array
    {
        $headers = ['No Plot', 'Kode Gen', 'Gen', 'Environment', 'R'];

        foreach (Characteristic::active()->ordered()->get() as $characteristic) {
            $headers[] = $characteristic->unit
                ? "{$characteristic->code} ({$characteristic->unit})"
                : $characteristic->code;
        }

        return $headers;
    }
}
