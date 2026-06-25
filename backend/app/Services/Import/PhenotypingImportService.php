<?php

namespace App\Services\Import;

use App\Models\Characteristic;
use App\Models\Environment;
use App\Models\Genotype;
use App\Models\ObservationImportStaging;
use App\Models\ObservationRecord;
use App\Models\ObservationValue;
use App\Models\PhenotypingImportBatch;
use App\Services\AuditService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;

class PhenotypingImportService
{
    public function __construct(
        private PhenotypingNormalizationService $normalizer,
        private PhenotypingValidationEngine $validator,
    ) {}

    // ── STEP 1: UPLOAD & PARSE ─────────────────────────────────────────────────

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

        try {
            $this->parseFile($batch, $file);
            $batch->update(['status' => 'parsed']);
        } catch (\Throwable $e) {
            $batch->update(['status' => 'failed', 'status_message' => $e->getMessage()]);
            throw $e;
        }

        return $batch->refresh();
    }

    private function parseFile(PhenotypingImportBatch $batch, UploadedFile $file): void
    {
        $spreadsheet = IOFactory::load($file->getPathname());
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, false);

        if (empty($rows)) return;

        $headers = array_map(fn($h) => trim((string) $h), $rows[0]);
        $totalRows = 0;
        $staging = [];

        foreach (array_slice($rows, 1) as $row) {
            // Skip blank rows
            $values = array_map(fn($v) => $v === null ? '' : trim((string) $v), $row);
            if (implode('', $values) === '') continue;

            $totalRows++;
            $rawData = array_combine($headers, $values);
            $staging[] = [
                'import_batch_id' => $batch->id,
                'row_number' => $totalRows + 1,
                'raw_data' => json_encode($rawData),
                'normalized_data' => null,
                'status' => 'pending',
                'errors' => null,
                'warnings' => null,
                'imported_observation_record_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        foreach (array_chunk($staging, 500) as $chunk) {
            ObservationImportStaging::insert($chunk);
        }

        $batch->update(['total_rows' => $totalRows]);
    }

    // ── STEP 2: NORMALIZE & VALIDATE ──────────────────────────────────────────

    public function normalizeAndValidate(PhenotypingImportBatch $batch): PhenotypingImportBatch
    {
        $batch->update(['status' => 'validating']);

        $stagingRows = ObservationImportStaging::where('import_batch_id', $batch->id)->get();
        $validCount = $invalidCount = $warningCount = 0;

        foreach ($stagingRows as $row) {
            $raw = $row->raw_data ?? [];

            // Normalise raw keys: lowercase + strip asterisks + trim
            // This handles templates with "NO PLOT *", "KODE GEN *", etc.
            $norm_key = fn($k) => strtolower(trim(str_replace(['*', '(wajib)', '(required)'], '', (string)$k)));
            $rawN = [];
            foreach ($raw as $k => $v) {
                $rawN[$norm_key($k)] = $v;
            }

            // Helper: look up by multiple possible normalised key aliases
            $pick = fn(array $aliases) => collect($aliases)
                ->map(fn($a) => $rawN[$a] ?? null)
                ->first(fn($v) => $v !== null);

            $norm = [
                'plot_no' => $this->normalizer->normalizePlotNo($pick(['no plot', 'no_plot', 'no.plot', 'nomor plot', 'plot'])),
                'genotype_code' => $this->normalizer->normalizeGenotypeCode($pick(['kode gen', 'kode_gen', 'kode genotipe', 'genotype_code', 'kode'])),
                'genotype_name' => trim((string) ($pick(['gen', 'genotipe', 'nama genotipe', 'genotype_name']) ?? '')),
                'environment_code' => strtoupper(trim((string) ($pick(['environment', 'env', 'lingkungan', 'kode env']) ?? ''))),
                'replication' => $this->normalizer->normalizeReplication($pick(['r', 'replikasi', 'ulangan', 'replication', 'rep'])),
                'values' => [],
            ];

            // Static key aliases to exclude from characteristic columns
            $staticAliases = ['no plot','no_plot','no.plot','nomor plot','plot',
                'kode gen','kode_gen','kode genotipe','genotype_code','kode',
                'gen','genotipe','nama genotipe','genotype_name',
                'environment','env','lingkungan','kode env',
                'r','replikasi','ulangan','replication','rep'];

            foreach ($raw as $colKey => $cellVal) {
                $normalizedKey = $norm_key($colKey);
                if (in_array($normalizedKey, $staticAliases, true)) continue;
                // Strip unit in parentheses: "TT (cm)" → "TT"
                $code = strtoupper(trim(preg_replace('/\s*\(.*\)/', '', $normalizedKey)));
                if ($code === '' || $code === '*') continue;
                // Empty cell → 0 (store as zero, not skip)
                $norm['values'][$code] = ($cellVal === '' || $cellVal === null)
                    ? 0.0
                    : $this->normalizer->normalizeNumericValue($cellVal);
            }

            $result = $this->validator->validateObservationRow($norm, $raw, $row->row_number);

            $row->update([
                'normalized_data' => $norm,
                'status' => $result['status'],
                'errors' => $result['errors'] ?: null,
                'warnings' => $result['warnings'] ?: null,
            ]);

            match ($result['status']) {
                'valid' => $validCount++,
                'warning' => $warningCount++,
                default => $invalidCount++,
            };
        }

        $batch->update([
            'status' => 'validated',
            'valid_rows' => $validCount + $warningCount,
            'invalid_rows' => $invalidCount,
            'warning_rows' => $warningCount,
        ]);

        return $batch->refresh();
    }

    // ── STEP 3: PREVIEW ───────────────────────────────────────────────────────

    public function getPreviewData(PhenotypingImportBatch $batch, array $filters = []): array
    {
        $query = ObservationImportStaging::where('import_batch_id', $batch->id);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $perPage = $filters['per_page'] ?? 50;
        $page = $filters['page'] ?? 1;

        $paginator = $query->orderBy('row_number')->paginate($perPage, ['*'], 'page', $page);

        return [
            'batch' => $batch->only([
                'id', 'batch_code', 'total_rows', 'valid_rows', 'invalid_rows',
                'warning_rows', 'status', 'original_filename',
            ]),
            'rows' => $paginator->items(),
            'pagination' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    // ── STEP 4: CONFIRM ───────────────────────────────────────────────────────

    public function confirmImport(PhenotypingImportBatch $batch, int $confirmedByUserId): PhenotypingImportBatch
    {
        $batch->update(['status' => 'importing']);

        $characteristicCache = Characteristic::active()
            ->get(['id', 'code', 'decimal_places'])
            ->keyBy(fn($c) => strtoupper($c->code));

        // Build environment cache by code AND by name for flexible lookup
        $environmentCache = [];
        Environment::select(['id', 'environment_code', 'name'])
            ->get()
            ->each(function ($e) use (&$environmentCache) {
                $environmentCache[strtoupper($e->environment_code)] = $e->id;
                if ($e->name) {
                    $environmentCache[strtoupper($e->name)] = $e->id;
                }
            });

        $genotypeCache = [];
        Genotype::whereIn('status', ['active', 'inactive'])
            ->get(['id', 'genotype_code', 'old_code'])
            ->each(function ($g) use (&$genotypeCache) {
                $genotypeCache[strtoupper($g->genotype_code)] = $g->id;
                if ($g->old_code) {
                    $genotypeCache[strtoupper($g->old_code)] = $g->id;
                }
            });

        $rows = ObservationImportStaging::where('import_batch_id', $batch->id)
            ->whereIn('status', ['valid', 'warning'])
            ->get();

        $importedCount = 0;

        try { DB::transaction(function () use ($rows, $characteristicCache, &$environmentCache, $genotypeCache, $batch, $confirmedByUserId, &$importedCount) {
            foreach ($rows as $row) {
                $norm = $row->normalized_data;
                if (empty($norm)) continue;

                $genotypeId = $genotypeCache[strtoupper($norm['genotype_code'] ?? '')] ?? null;
                if (!$genotypeId) continue;

                $envKey = strtoupper($norm['environment_code'] ?? '');
                $environmentId = $environmentCache[$envKey] ?? null;

                // Auto-create a Lokasi entry if environment not found in Master Data
                if (!$environmentId && $envKey !== '') {
                    $envName = $norm['environment_code'];
                    $envCode = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', substr($envName, 0, 6))) . '-' . date('y');
                    $count = \App\Models\Environment::where('environment_code', 'like', $envCode . '%')->count();
                    $finalCode = $count > 0 ? $envCode . '-' . ($count + 1) : $envCode;

                    $newEnv = \App\Models\Environment::create([
                        'name' => $envName,
                        'environment_code' => $finalCode,
                        'created_by' => $confirmedByUserId,
                    ]);
                    $environmentId = $newEnv->id;
                    $environmentCache[$envKey] = $environmentId;
                }

                if (!$environmentId) continue;

                $environment = Environment::find($environmentId);

                // Upsert the observation record
                $record = ObservationRecord::firstOrCreate(
                    [
                        'environment_id' => $environmentId,
                        'season_id' => $environment?->season_id,
                        'plot_no' => $norm['plot_no'],
                        'replication' => $norm['replication'],
                    ],
                    [
                        'record_code' => 'OBS-' . strtoupper(Str::random(10)),
                        'genotype_id' => $genotypeId,
                        'recorded_by' => $confirmedByUserId,
                    ]
                );

                // Upsert all characteristic values (empty cells stored as 0)
                foreach ($norm['values'] ?? [] as $code => $value) {
                    $char = $characteristicCache[strtoupper($code)] ?? null;
                    if (!$char) continue;
                    // value is 0.0 for empty cells (never null here)

                    ObservationValue::updateOrCreate(
                        [
                            'observation_record_id' => $record->id,
                            'characteristic_id' => $char->id,
                        ],
                        ['value' => $value]
                    );
                }

                $row->update([
                    'status' => 'valid',
                    'imported_observation_record_id' => $record->id,
                ]);

                $importedCount++;
            }
        }); } catch (\Throwable $e) {
            $batch->update(['status' => 'failed', 'status_message' => $e->getMessage()]);
            throw $e;
        }

        $batch->update([
            'status' => 'completed',
            'imported_rows' => $importedCount,
            'confirmed_by' => $confirmedByUserId,
            'confirmed_at' => now(),
            'import_completed_at' => now(),
        ]);

        AuditService::logAction('phenotyping_import_confirmed', $batch, [
            'imported_rows' => $importedCount,
            'batch_code' => $batch->batch_code,
        ]);

        return $batch->refresh();
    }

    // ── STEP 5: ROLLBACK ──────────────────────────────────────────────────────

    public function rollback(PhenotypingImportBatch $batch, int $rolledBackByUserId): array
    {
        $importedIds = ObservationImportStaging::where('import_batch_id', $batch->id)
            ->whereNotNull('imported_observation_record_id')
            ->pluck('imported_observation_record_id');

        $deletedCount = 0;

        DB::transaction(function () use ($importedIds, &$deletedCount) {
            foreach ($importedIds as $recordId) {
                $record = ObservationRecord::find($recordId);
                if ($record) {
                    $record->values()->delete();
                    $record->delete();
                    $deletedCount++;
                }
            }
        });

        $batch->update([
            'status' => 'rolled_back',
            'is_rolled_back' => true,
            'rolled_back_at' => now(),
            'rolled_back_by' => $rolledBackByUserId,
        ]);

        AuditService::logAction('phenotyping_import_rolled_back', $batch, [
            'deleted_records' => $deletedCount,
            'batch_code' => $batch->batch_code,
        ]);

        return ['deleted_records' => $deletedCount, 'batch_code' => $batch->batch_code];
    }

    // ── TEMPLATE GENERATION ───────────────────────────────────────────────────

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
