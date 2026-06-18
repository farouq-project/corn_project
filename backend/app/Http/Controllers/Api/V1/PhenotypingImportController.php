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

class PhenotypingImportController extends Controller
{
    public function __construct(private PhenotypingImportService $importService) {}

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
            'file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240'],
        ]);

        $batch = $this->importService->uploadAndParse($data['file'], $request->user()->id);

        return response()->json([
            'message' => "File diupload dan diparsing: {$batch->total_rows} baris ditemukan.",
            'batch' => $batch,
        ], 201);
    }

    public function validateBatch(PhenotypingImportBatch $batch): JsonResponse
    {
        if (!in_array($batch->status, ['parsed', 'validated'])) {
            return response()->json(['message' => 'Batch harus berstatus parsed atau validated untuk divalidasi ulang.'], 422);
        }

        $batch = $this->importService->normalizeAndValidate($batch);

        return response()->json([
            'message' => "Validasi selesai: {$batch->valid_rows} valid, {$batch->warning_rows} peringatan, {$batch->invalid_rows} error.",
            'batch' => $batch,
        ]);
    }

    public function preview(PhenotypingImportBatch $batch, Request $request): JsonResponse
    {
        if (!in_array($batch->status, ['validated', 'completed'])) {
            return response()->json(['message' => 'Batch belum divalidasi. Jalankan validasi terlebih dahulu.'], 422);
        }

        $data = $this->importService->getPreviewData($batch, [
            'status' => $request->status,
            'per_page' => $request->per_page ?? 50,
            'page' => $request->page ?? 1,
        ]);

        return response()->json($data);
    }

    public function confirm(PhenotypingImportBatch $batch): JsonResponse
    {
        if ($batch->status !== 'validated') {
            return response()->json(['message' => 'Batch harus berstatus validated sebelum dikonfirmasi.'], 422);
        }

        if ($batch->valid_rows === 0) {
            return response()->json(['message' => 'Tidak ada baris valid untuk diimpor.'], 422);
        }

        $batch = $this->importService->confirmImport($batch, request()->user()->id);

        return response()->json([
            'message' => "Import selesai: {$batch->imported_rows} baris berhasil diimpor.",
            'batch' => $batch,
        ]);
    }

    public function rollback(PhenotypingImportBatch $batch): JsonResponse
    {
        if ($batch->status !== 'completed') {
            return response()->json(['message' => 'Hanya batch yang sudah completed yang dapat di-rollback.'], 422);
        }

        if ($batch->is_rolled_back) {
            return response()->json(['message' => 'Batch ini sudah di-rollback sebelumnya.'], 422);
        }

        $result = $this->importService->rollback($batch, request()->user()->id);

        return response()->json([
            'message' => "Rollback selesai: {$result['deleted_records']} record dihapus.",
            'result' => $result,
        ]);
    }
}
