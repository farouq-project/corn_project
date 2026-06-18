<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Characteristic;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class CharacteristicController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Characteristic::query()
            ->when($request->boolean('active_only'), fn($q) => $q->active())
            ->when($request->filled('group'), fn($q) => $q->where('group', $request->group));

        return response()->json($query->ordered()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:characteristics,code'],
            'name' => ['required', 'string', 'max:255'],
            'unit' => ['nullable', 'string', 'max:20'],
            'group' => ['nullable', 'string', 'max:50'],
            'display_order' => ['nullable', 'integer'],
            'decimal_places' => ['nullable', 'integer', 'min:0', 'max:6'],
            'is_active' => ['nullable', 'boolean'],
            'method_description' => ['nullable', 'string'],
        ]);

        $characteristic = Characteristic::create($data);

        AuditService::logCreated($characteristic);

        return response()->json($characteristic, 201);
    }

    public function update(Request $request, Characteristic $characteristic): JsonResponse
    {
        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:20', 'unique:characteristics,code,' . $characteristic->id],
            'name' => ['sometimes', 'string', 'max:255'],
            'unit' => ['nullable', 'string', 'max:20'],
            'group' => ['nullable', 'string', 'max:50'],
            'display_order' => ['nullable', 'integer'],
            'decimal_places' => ['nullable', 'integer', 'min:0', 'max:6'],
            'is_active' => ['nullable', 'boolean'],
            'method_description' => ['nullable', 'string'],
        ]);

        $original = $characteristic->getOriginal();
        $characteristic->update($data);

        AuditService::logUpdated($characteristic, $original);

        return response()->json($characteristic);
    }

    /**
     * Download Excel template for bulk characteristic import.
     */
    public function downloadTemplate(): BinaryFileResponse
    {
        $headers = ['Kelompok Pengamatan', 'Karakter', 'Kode', 'Satuan', 'Metode Pengamatan', 'Desimal', 'Urutan'];

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Template Import Pengamatan');

        foreach ($headers as $i => $h) {
            $sheet->setCellValueByColumnAndRow($i + 1, 1, $h);
        }
        $sheet->getStyle('A1:G1')->getFont()->setBold(true);
        $sheet->getStyle('A1:G1')->getFill()
            ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFD5E8D4');

        // Example row
        $example = ['Vegetatif', 'Tinggi Tanaman', 'TT', 'cm', 'Diukur dari pangkal batang ke ujung daun tertinggi', '1', '1'];
        foreach ($example as $i => $v) {
            $sheet->setCellValueByColumnAndRow($i + 1, 2, $v);
        }

        foreach (range(1, count($headers)) as $col) {
            $sheet->getColumnDimensionByColumn($col)->setAutoSize(true);
        }

        $writer = \PhpOffice\PhpSpreadsheet\IOFactory::createWriter($spreadsheet, 'Xlsx');
        $tempFile = tempnam(sys_get_temp_dir(), 'char_import_') . '.xlsx';
        $writer->save($tempFile);

        return response()->download($tempFile, 'template_import_pengamatan.xlsx')->deleteFileAfterSend();
    }

    /**
     * Bulk import characteristics from Excel.
     * Behaviour: upsert by code (update if exists, create if not).
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120'],
        ]);

        $spreadsheet = IOFactory::load($request->file('file')->getPathname());
        $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);

        if (empty($rows)) {
            return response()->json(['message' => 'File kosong.'], 422);
        }

        $headers = array_map(fn($h) => strtolower(trim((string) $h)), $rows[0]);
        $headerMap = array_flip($headers);

        $created = $updated = $skipped = 0;
        $errors = [];

        DB::transaction(function () use ($rows, $headerMap, &$created, &$updated, &$skipped, &$errors) {
            foreach (array_slice($rows, 1) as $i => $row) {
                $rowNum = $i + 2;
                $values = array_map(fn($v) => $v === null ? '' : trim((string) $v), $row);
                if (implode('', $values) === '') continue;

                $code = strtoupper($values[$headerMap['kode'] ?? -1] ?? '');
                if (!$code) { $errors[] = "Baris {$rowNum}: Kode kosong, dilewati."; $skipped++; continue; }

                $name = $values[$headerMap['karakter'] ?? -1] ?? '';
                if (!$name) { $errors[] = "Baris {$rowNum}: Nama karakter kosong, dilewati."; $skipped++; continue; }

                $data = [
                    'name' => $name,
                    'group' => $values[$headerMap['kelompok pengamatan'] ?? -1] ?: null,
                    'unit' => $values[$headerMap['satuan'] ?? -1] ?: null,
                    'method_description' => $values[$headerMap['metode pengamatan'] ?? -1] ?: null,
                    'decimal_places' => max(0, (int) ($values[$headerMap['desimal'] ?? -1] ?? 2)),
                    'display_order' => max(0, (int) ($values[$headerMap['urutan'] ?? -1] ?? 0)),
                ];

                $existing = Characteristic::where('code', $code)->first();
                if ($existing) {
                    $existing->update($data);
                    AuditService::logUpdated($existing, $existing->getOriginal());
                    $updated++;
                } else {
                    $char = Characteristic::create(array_merge($data, ['code' => $code]));
                    AuditService::logCreated($char);
                    $created++;
                }
            }
        });

        return response()->json([
            'message' => "Import selesai: {$created} dibuat, {$updated} diperbarui, {$skipped} dilewati.",
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
        ]);
    }

    public function destroy(Characteristic $characteristic): JsonResponse
    {
        if ($characteristic->values()->exists()) {
            $characteristic->update(['is_active' => false]);

            AuditService::logAction('deactivated', $characteristic);

            return response()->json([
                'message' => 'Characteristic is in use and was deactivated instead of deleted.',
                'data' => $characteristic,
            ]);
        }

        AuditService::logDeleted($characteristic);
        $characteristic->delete();

        return response()->json(['message' => 'Characteristic deleted.']);
    }
}
