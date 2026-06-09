<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\InventoryImportTemplateExport;
use App\Exports\StorageUnitImportTemplateExport;
use App\Http\Controllers\Controller;
use App\Models\InventoryImportBatch;
use App\Models\InventoryImportStaging;
use App\Models\StorageUnitImportStaging;
use App\Services\Import\InventoryImportService;
use App\Services\Import\NormalizationService;
use App\Services\Import\ValidationEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class InventoryImportController extends Controller
{
    public function __construct(private InventoryImportService $importService) {}

    // ── TEMPLATES ─────────────────────────────────────────────────────────────

    /**
     * Download official Excel import template.
     */
    public function downloadTemplate(Request $request): BinaryFileResponse
    {
        $type = $request->query('type', 'seed_inventory');

        if ($type === 'storage_unit') {
            return Excel::download(
                new StorageUnitImportTemplateExport(),
                'template_import_storage_units.xlsx'
            );
        }

        return Excel::download(
            new InventoryImportTemplateExport(),
            'template_import_seed_inventory.xlsx'
        );
    }

    // ── BATCH MANAGEMENT ──────────────────────────────────────────────────────

    public function batchIndex(Request $request): JsonResponse
    {
        $batches = InventoryImportBatch::with(['uploader', 'confirmer'])
            ->when($request->import_type, fn($q) => $q->where('import_type', $request->import_type))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($batches);
    }

    public function batchShow(InventoryImportBatch $batch): JsonResponse
    {
        return response()->json($batch->load(['uploader', 'confirmer']));
    }

    // ── STEP 1: UPLOAD ────────────────────────────────────────────────────────

    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
            'import_type' => ['required', 'in:seed_inventory,storage_unit'],
        ]);

        $batch = $this->importService->uploadAndParse(
            $request->file('file'),
            $data['import_type'],
            $request->user()->id
        );

        return response()->json([
            'message' => "File berhasil diupload dan diparsing. {$batch->total_rows} baris ditemukan.",
            'batch' => $batch,
        ], 201);
    }

    // ── STEP 2: VALIDATE ─────────────────────────────────────────────────────

    public function validate_batch(InventoryImportBatch $batch, Request $request): JsonResponse
    {
        if (!in_array($batch->status, ['parsed', 'validated'])) {
            return response()->json(['message' => "Batch dengan status '{$batch->status}' tidak dapat divalidasi."], 422);
        }

        $updatedBatch = $this->importService->normalizeAndValidate($batch);

        return response()->json([
            'message' => 'Validasi selesai.',
            'batch' => $updatedBatch,
            'summary' => [
                'total' => $updatedBatch->total_rows,
                'valid' => $updatedBatch->valid_rows,
                'invalid' => $updatedBatch->invalid_rows,
                'warnings' => $updatedBatch->warning_rows,
                'duplicates' => $updatedBatch->duplicate_rows,
            ],
        ]);
    }

    // ── STEP 3: PREVIEW ───────────────────────────────────────────────────────

    public function preview(InventoryImportBatch $batch, Request $request): JsonResponse
    {
        if (!in_array($batch->status, ['validated', 'confirmed', 'completed', 'partial'])) {
            return response()->json(['message' => 'Batch belum divalidasi.'], 422);
        }

        $validationFilter = $request->validation_status;

        $query = $batch->import_type === 'seed_inventory'
            ? InventoryImportStaging::where('import_batch_id', $batch->id)
            : StorageUnitImportStaging::where('import_batch_id', $batch->id);

        if ($validationFilter) {
            $query->where('validation_status', $validationFilter);
        }

        $rows = $query->orderBy('row_number')->paginate($request->per_page ?? 50);

        // Summary by status
        $statusSummary = $batch->import_type === 'seed_inventory'
            ? InventoryImportStaging::where('import_batch_id', $batch->id)
                ->selectRaw('validation_status, count(*) as count')
                ->groupBy('validation_status')
                ->pluck('count', 'validation_status')
            : StorageUnitImportStaging::where('import_batch_id', $batch->id)
                ->selectRaw('validation_status, count(*) as count')
                ->groupBy('validation_status')
                ->pluck('count', 'validation_status');

        return response()->json([
            'batch' => $batch->load('uploader'),
            'summary' => [
                'total' => $batch->total_rows,
                'valid' => $statusSummary['valid'] ?? 0,
                'warning' => $statusSummary['warning'] ?? 0,
                'invalid' => $statusSummary['invalid'] ?? 0,
                'duplicate' => $statusSummary['duplicate'] ?? 0,
                'ready_to_import' => ($statusSummary['valid'] ?? 0) + ($statusSummary['warning'] ?? 0),
            ],
            'rows' => $rows,
        ]);
    }

    // ── STEP 4: CONFIRM IMPORT ────────────────────────────────────────────────

    public function confirm(InventoryImportBatch $batch, Request $request): JsonResponse
    {
        $data = $request->validate([
            'skip_row_numbers' => ['nullable', 'array'],
            'skip_row_numbers.*' => ['integer'],
        ]);

        if (!$batch->canConfirm()) {
            return response()->json([
                'message' => "Batch tidak siap untuk diimport. Status: {$batch->status}. Valid rows: {$batch->valid_rows}.",
            ], 422);
        }

        $result = $this->importService->confirmImport(
            $batch,
            $request->user()->id,
            $data['skip_row_numbers'] ?? []
        );

        $batch->refresh();

        return response()->json([
            'message' => $batch->status_message,
            'result' => $result,
            'batch' => $batch,
        ]);
    }

    // ── ROLLBACK ──────────────────────────────────────────────────────────────

    public function rollback(InventoryImportBatch $batch, Request $request): JsonResponse
    {
        if (!$batch->canRollback()) {
            return response()->json(['message' => "Batch ini tidak dapat di-rollback (status: {$batch->status})."], 422);
        }

        $result = $this->importService->rollback($batch, $request->user()->id);

        return response()->json([
            'message' => "Rollback berhasil. {$result['deleted']} record dihapus.",
            'batch' => $batch->refresh(),
        ]);
    }

    // ── ERROR REPORT EXPORT ───────────────────────────────────────────────────

    public function downloadErrorReport(InventoryImportBatch $batch): JsonResponse
    {
        $invalidRows = $batch->import_type === 'seed_inventory'
            ? InventoryImportStaging::where('import_batch_id', $batch->id)
                ->where('validation_status', 'invalid')
                ->orderBy('row_number')
                ->get()
            : StorageUnitImportStaging::where('import_batch_id', $batch->id)
                ->where('validation_status', 'invalid')
                ->orderBy('row_number')
                ->get();

        $report = $invalidRows->map(function ($row) {
            $errors = collect($row->validation_errors ?? [])
                ->pluck('message')
                ->implode('; ');

            return [
                'row_number' => $row->row_number,
                'package_code' => $row->raw_package_code ?? $row->raw_unit_code ?? '',
                'errors' => $errors,
            ];
        });

        return response()->json([
            'batch_code' => $batch->batch_code,
            'total_invalid' => $invalidRows->count(),
            'error_report' => $report,
        ]);
    }

    // ── ROW DETAIL ────────────────────────────────────────────────────────────

    public function rowDetail(InventoryImportBatch $batch, int $rowNumber): JsonResponse
    {
        $row = $batch->import_type === 'seed_inventory'
            ? InventoryImportStaging::where('import_batch_id', $batch->id)
                ->where('row_number', $rowNumber)
                ->first()
            : StorageUnitImportStaging::where('import_batch_id', $batch->id)
                ->where('row_number', $rowNumber)
                ->first();

        if (!$row) {
            return response()->json(['message' => 'Row tidak ditemukan'], 404);
        }

        return response()->json($row);
    }

    // ── QUICK NORMALIZATION PREVIEW ───────────────────────────────────────────

    /**
     * Normalize a single value without running a full import.
     * Useful for the frontend to show real-time normalization previews.
     */
    public function normalizePreview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:genotype_code,date,decimal,status,weight,unit_type'],
            'value' => ['required', 'string'],
        ]);

        $normalizer = new NormalizationService();

        $result = match ($data['type']) {
            'genotype_code' => [
                'normalized' => $normalizer->normalizeGenotypeCode($data['value']),
                'candidates' => $normalizer->genotypeCodeCandidates($data['value']),
            ],
            'date' => [
                'normalized' => $normalizer->normalizeDate($data['value']),
            ],
            'decimal' => [
                'normalized' => $normalizer->normalizeDecimal($data['value']),
            ],
            'weight' => [
                'normalized_g' => $normalizer->normalizeWeightToGrams($data['value']),
            ],
            'status' => [
                'normalized' => $normalizer->normalizeStorageStatus($data['value']),
            ],
            'unit_type' => [
                'normalized' => $normalizer->normalizeUnitType($data['value']),
            ],
        };

        return response()->json(['input' => $data['value'], ...$result]);
    }
}
