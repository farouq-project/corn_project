<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\PhenotypingObservationTemplateExport;
use App\Http\Controllers\Controller;
use App\Models\PhenotypingImportBatch;
use App\Services\Import\PhenotypingImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Phase 2 scaffolding: bulk import endpoints for "Data Pengamatan".
 * Only downloadTemplate() and upload() (batch creation) are functional;
 * validate/preview/confirm/rollback return 501 until Phase 2 implements
 * PhenotypingImportService's normalize/validate/confirm pipeline.
 */
class PhenotypingImportController extends Controller
{
    public function __construct(private PhenotypingImportService $importService) {}

    /**
     * Download the "Data Pengamatan" Excel import template, with one
     * column per active characteristic.
     */
    public function downloadTemplate(): BinaryFileResponse
    {
        return Excel::download(
            new PhenotypingObservationTemplateExport(),
            'template_import_data_pengamatan.xlsx'
        );
    }

    public function batchIndex(Request $request): JsonResponse
    {
        $batches = PhenotypingImportBatch::with(['uploader', 'confirmer'])
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($batches);
    }

    public function batchShow(PhenotypingImportBatch $batch): JsonResponse
    {
        return response()->json($batch->load(['uploader', 'confirmer']));
    }

    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ]);

        $batch = $this->importService->uploadAndParse($data['file'], $request->user()->id);

        return response()->json([
            'message' => 'File berhasil diupload. Parsing baris belum diimplementasikan (Phase 2).',
            'batch' => $batch,
        ], 201);
    }

    public function validateBatch(PhenotypingImportBatch $batch): JsonResponse
    {
        return response()->json([
            'message' => 'Validasi import belum diimplementasikan (Phase 2).',
            'batch' => $batch,
        ], 501);
    }

    public function preview(PhenotypingImportBatch $batch): JsonResponse
    {
        return response()->json([
            'message' => 'Preview import belum diimplementasikan (Phase 2).',
            'batch' => $batch,
        ], 501);
    }

    public function confirm(PhenotypingImportBatch $batch): JsonResponse
    {
        return response()->json([
            'message' => 'Konfirmasi import belum diimplementasikan (Phase 2).',
            'batch' => $batch,
        ], 501);
    }

    public function rollback(PhenotypingImportBatch $batch): JsonResponse
    {
        return response()->json([
            'message' => 'Rollback import belum diimplementasikan (Phase 2).',
            'batch' => $batch,
        ], 501);
    }
}
