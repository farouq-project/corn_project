<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StorageMonitorEntry;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class StorageMonitorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = StorageMonitorEntry::with('recorder')
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('genotype_name', 'ilike', "%{$request->search}%")
                  ->orWhere('new_code', 'ilike', "%{$request->search}%")
                  ->orWhere('prev_code', 'ilike', "%{$request->search}%");
            }));

        return response()->json($query->orderBy('entry_number', 'desc')->paginate($request->per_page ?? 100));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'prev_code' => ['nullable', 'string', 'max:50'],
            'new_code' => ['nullable', 'string', 'max:50'],
            'prev_box' => ['nullable', 'string', 'max:100'],
            'new_box' => ['nullable', 'string', 'max:100'],
            'genotype_name' => ['nullable', 'string'],
            'prev_packaging' => ['nullable', 'string', 'max:100'],
            'new_packaging' => ['nullable', 'string', 'max:100'],
            'harvest_date' => ['nullable', 'date'],
            'seed_weight' => ['nullable', 'numeric', 'min:0'],
            'moisture_content' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['entry_number'] = (StorageMonitorEntry::max('entry_number') ?? 0) + 1;
        $data['recorded_by'] = $request->user()->id;

        $entry = StorageMonitorEntry::create($data);
        AuditService::logCreated($entry);

        return response()->json($entry->load('recorder'), 201);
    }

    public function destroy(StorageMonitorEntry $storageMonitorEntry): JsonResponse
    {
        AuditService::logDeleted($storageMonitorEntry);
        $storageMonitorEntry->delete();

        return response()->json(['message' => 'Entri berhasil dihapus.']);
    }

    public function downloadTemplate(): BinaryFileResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Storage Monitor Template');

        $headers = [
            'Nomor', 'Kode Sebelumnya', 'Kode Baru', 'Box Sebelumnya', 'Box Baru',
            'Nama Genotipe', 'Kemasan Sebelumnya', 'Kemasan Baru',
            'Tanggal Panen (YYYY-MM-DD)', 'Berat Benih (g)', 'Kadar Air (%)', 'Keterangan',
        ];

        foreach ($headers as $i => $h) {
            $sheet->setCellValueByColumnAndRow($i + 1, 1, $h);
        }

        $sheet->getStyle('A1:L1')->getFont()->setBold(true);
        $sheet->getStyle('A1:L1')->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFD5E8D4');

        // Example row
        $example = [1, 'K-001', 'K-001-R', 'Box A1', 'Box B2', 'SR4 x SR7 x Jambore',
                    'Kantong', 'Kaleng', '2026-05-10', '150.5', '12.3', 'Repacking dari box lama'];
        foreach ($example as $i => $v) {
            $sheet->setCellValueByColumnAndRow($i + 1, 2, $v);
        }

        foreach (range(1, count($headers)) as $col) {
            $sheet->getColumnDimensionByColumn($col)->setAutoSize(true);
        }

        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        $tempFile = tempnam(sys_get_temp_dir(), 'storage_monitor_') . '.xlsx';
        $writer->save($tempFile);

        return response()->download($tempFile, 'template_storage_monitor.xlsx')->deleteFileAfterSend();
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:20480'],
        ]);

        try {
            $spreadsheet = IOFactory::load($request->file('file')->getPathname());
        } catch (\Throwable $e) {
            return response()->json(['message' => 'File tidak dapat dibaca: ' . $e->getMessage()], 422);
        }

        $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);

        if (empty($rows) || count($rows) < 2) {
            return response()->json(['message' => 'File kosong atau hanya berisi header.'], 422);
        }

        // Normalize headers: lowercase, trim, strip parenthetical units for flexible matching
        $rawHeaders = array_map(fn($h) => strtolower(trim((string) $h)), $rows[0]);
        $colMap = array_flip($rawHeaders);

        // Helper: look up a column value by header keyword (partial match fallback)
        $col = function(string $key, array $row) use ($colMap, $rawHeaders): string {
            // Exact match first
            if (isset($colMap[$key])) {
                return trim((string) ($row[$colMap[$key]] ?? ''));
            }
            // Partial match: find header that starts with or contains the key
            foreach ($rawHeaders as $idx => $header) {
                if (str_starts_with($header, $key) || str_contains($header, $key)) {
                    return trim((string) ($row[$idx] ?? ''));
                }
            }
            return '';
        };

        $created = 0;
        $errors = [];
        $maxEntry = StorageMonitorEntry::max('entry_number') ?? 0;

        try {
            DB::transaction(function () use ($rows, $col, $request, &$created, &$errors, &$maxEntry) {
                foreach (array_slice($rows, 1) as $i => $row) {
                    $values = array_map(fn($v) => $v === null ? '' : trim((string) $v), $row);
                    if (implode('', $values) === '') continue;

                    $genotypeCol = $col('nama genotipe', $row);
                    if (!$genotypeCol) { $errors[] = "Baris " . ($i + 2) . ": Nama Genotipe kosong, dilewati."; continue; }

                    $harvestRaw = $col('tanggal panen', $row);
                    $harvestDate = null;
                    if ($harvestRaw) {
                        try { $harvestDate = \Carbon\Carbon::parse($harvestRaw)->format('Y-m-d'); } catch (\Throwable) {}
                    }

                    $seedWeightRaw = $col('berat benih', $row);
                    $moistureRaw = $col('kadar air', $row);

                    $maxEntry++;
                    StorageMonitorEntry::create([
                        'entry_number' => $maxEntry,
                        'prev_code' => $col('kode sebelumnya', $row) ?: null,
                        'new_code' => $col('kode baru', $row) ?: null,
                        'prev_box' => $col('box sebelumnya', $row) ?: null,
                        'new_box' => $col('box baru', $row) ?: null,
                        'genotype_name' => $genotypeCol,
                        'prev_packaging' => $col('kemasan sebelumnya', $row) ?: null,
                        'new_packaging' => $col('kemasan baru', $row) ?: null,
                        'harvest_date' => $harvestDate,
                        'seed_weight' => $seedWeightRaw !== '' ? (float) $seedWeightRaw : null,
                        'moisture_content' => $moistureRaw !== '' ? (float) $moistureRaw : null,
                        'notes' => $col('keterangan', $row) ?: null,
                        'recorded_by' => $request->user()->id,
                    ]);
                    $created++;
                }
            });
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Gagal menyimpan data: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Import selesai: {$created} entri dibuat.",
            'created' => $created,
            'errors' => $errors,
        ]);
    }
}
