<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\GenotypeImportTemplateExport;
use App\Http\Controllers\Controller;
use App\Models\Genotype;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class GenotypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Genotype::query()
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('genotype_code', 'ilike', "%{$request->search}%")
                  ->orWhere('genotype_name', 'ilike', "%{$request->search}%")
                  ->orWhere('old_code', 'ilike', "%{$request->search}%");
            }))
            ->when($request->category, fn($q) => $q->where('category', $request->category))
            ->when($request->trial_type, fn($q) => $q->where('trial_type', $request->trial_type))
            ->when($request->status, fn($q) => $q->where('status', $request->status));

        if ($request->boolean('all')) {
            return response()->json($query->orderBy('genotype_code')->get(['id', 'genotype_code', 'genotype_name', 'category']));
        }

        return response()->json($query->with('creator')->orderBy('genotype_code')->paginate($request->per_page ?? 20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'genotype_code' => ['required', 'string', 'max:30', 'unique:genotypes'],
            'old_code' => ['nullable', 'string', 'max:30'],
            'genotype_name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'in:inbred_line,hybrid,variety,population,germplasm'],
            'trial_type' => ['required', 'in:drought,shade,normal,feed,sweet_corn,multi'],
            'origin' => ['nullable', 'string'],
            'breeder' => ['nullable', 'string'],
            'release_year' => ['nullable', 'digits:4'],
            'breeder_notes' => ['nullable', 'string'],
            'pedigree' => ['nullable', 'string'],
            'status' => ['in:active,inactive,archived'],
        ]);

        $data['created_by'] = $request->user()->id;
        $genotype = Genotype::create($data);
        AuditService::logCreated($genotype);

        return response()->json($genotype, 201);
    }

    public function show(Genotype $genotype): JsonResponse
    {
        return response()->json($genotype->load(['seedInventories.storageUnit', 'creator'])->append(['total_seed_weight']));
    }

    public function update(Request $request, Genotype $genotype): JsonResponse
    {
        $data = $request->validate([
            'genotype_code' => ['sometimes', 'string', "unique:genotypes,genotype_code,{$genotype->id}"],
            'old_code' => ['nullable', 'string'],
            'genotype_name' => ['sometimes', 'string'],
            'category' => ['sometimes', 'in:inbred_line,hybrid,variety,population,germplasm'],
            'trial_type' => ['sometimes', 'in:drought,shade,normal,feed,sweet_corn,multi'],
            'origin' => ['nullable', 'string'],
            'breeder' => ['nullable', 'string'],
            'release_year' => ['nullable', 'digits:4'],
            'breeder_notes' => ['nullable', 'string'],
            'pedigree' => ['nullable', 'string'],
            'status' => ['in:active,inactive,archived'],
        ]);

        $original = $genotype->getAttributes();
        $genotype->update($data);
        AuditService::logUpdated($genotype, $original);

        return response()->json($genotype);
    }

    public function destroy(Genotype $genotype): JsonResponse
    {
        AuditService::logDeleted($genotype);
        $genotype->delete();
        return response()->json(null, 204);
    }

    /**
     * Bulk create genotypes from a list of codes.
     * Accepts an array of objects or a plain newline/comma-separated string.
     * Skips duplicates. Returns created, skipped, and failed counts.
     */
    // Valid enum values — used for soft normalization
    private const VALID_CATEGORIES  = ['inbred_line', 'hybrid', 'variety', 'population', 'germplasm'];
    private const VALID_TRIAL_TYPES = ['drought', 'shade', 'normal', 'feed', 'sweet_corn', 'multi'];

    public function bulkStore(Request $request): JsonResponse
    {
        // Only validate structure, NOT enum values on each row —
        // invalid category/trial_type values are silently defaulted below.
        $data = $request->validate([
            'genotypes'              => ['required', 'array', 'min:1', 'max:500'],
            'genotypes.*.genotype_code' => ['required', 'string', 'max:30'],
            'genotypes.*.genotype_name' => ['nullable', 'string', 'max:255'],
            'genotypes.*.old_code'   => ['nullable', 'string', 'max:30'],
            'genotypes.*.category'   => ['nullable', 'string'],  // normalized below
            'genotypes.*.trial_type' => ['nullable', 'string'],  // normalized below
            'genotypes.*.origin'     => ['nullable', 'string'],
            'genotypes.*.breeder'    => ['nullable', 'string'],
        ]);

        $userId = $request->user()->id;
        $defaultCategory  = 'inbred_line';
        $defaultTrialType = 'normal';

        $created = [];
        $skipped = [];
        $failed = [];

        // Pre-load existing codes for O(1) duplicate check
        $existingCodes = Genotype::withTrashed()
            ->pluck('genotype_code')
            ->map('strtoupper')
            ->flip()
            ->toArray();

        foreach ($data['genotypes'] as $row) {
            $code = strtoupper(trim($row['genotype_code']));

            if (empty($code)) {
                $failed[] = ['code' => $row['genotype_code'], 'reason' => 'Kode kosong'];
                continue;
            }

            if (isset($existingCodes[$code])) {
                $skipped[] = ['code' => $code, 'reason' => 'Sudah ada di database'];
                continue;
            }

            try {
                // Normalize category & trial_type: accept valid values, fall back to default
                $rawCategory  = strtolower(trim((string) ($row['category']  ?? '')));
                $rawTrialType = strtolower(trim((string) ($row['trial_type'] ?? '')));

                $category  = in_array($rawCategory,  self::VALID_CATEGORIES,  true) ? $rawCategory  : $defaultCategory;
                $trialType = in_array($rawTrialType, self::VALID_TRIAL_TYPES, true) ? $rawTrialType : $defaultTrialType;

                $genotype = Genotype::create([
                    'genotype_code' => $code,
                    'genotype_name' => trim((string) ($row['genotype_name'] ?? '')) ?: $code,
                    'old_code'      => trim((string) ($row['old_code']      ?? '')) ?: null,
                    'category'      => $category,
                    'trial_type'    => $trialType,
                    'origin'        => trim((string) ($row['origin']  ?? '')) ?: null,
                    'breeder'       => trim((string) ($row['breeder'] ?? '')) ?: null,
                    'status'        => 'active',
                    'created_by'    => $userId,
                ]);

                $existingCodes[$code] = true; // prevent within-batch duplicates
                $created[] = ['id' => $genotype->id, 'code' => $code, 'name' => $genotype->genotype_name];
            } catch (\Exception $e) {
                $failed[] = ['code' => $code, 'reason' => $e->getMessage()];
            }
        }

        AuditService::logAction('bulk_genotype_import', new Genotype(), [
            'created' => count($created),
            'skipped' => count($skipped),
            'failed' => count($failed),
        ]);

        return response()->json([
            'message' => count($created) . " genotipe berhasil dibuat, " . count($skipped) . " dilewati, " . count($failed) . " gagal.",
            'created_count' => count($created),
            'skipped_count' => count($skipped),
            'failed_count' => count($failed),
            'created' => $created,
            'skipped' => $skipped,
            'failed' => $failed,
        ], 201);
    }

    /** Download the official Excel import template for genotypes. */
    public function downloadTemplate(): BinaryFileResponse
    {
        return Excel::download(new GenotypeImportTemplateExport(), 'template_import_genotipe.xlsx');
    }

    /**
     * Import genotypes from an uploaded Excel file.
     * Reads columns: genotype_code, genotype_name, old_code, category,
     *                trial_type, origin, breeder, release_year, pedigree
     * Delegates to bulkStore logic after parsing.
     */
    public function importFromFile(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ]);

        $rows = Excel::toArray([], $request->file('file'));
        $sheet = $rows[0] ?? [];

        if (empty($sheet)) {
            return response()->json(['message' => 'File kosong atau tidak dapat dibaca.'], 422);
        }

        // Map header row (row 0) → column indices
        $header = array_map(fn($h) => strtolower(trim(str_replace(' *', '', (string) $h))), $sheet[0]);
        $colIndex = array_flip($header);

        $genotypes = [];
        foreach (array_slice($sheet, 1) as $row) {
            $code = trim((string) ($row[$colIndex['genotype_code']] ?? ''));
            if ($code === '') continue;

            $genotypes[] = [
                'genotype_code' => $code,
                'genotype_name' => trim((string) ($row[$colIndex['genotype_name'] ?? -1] ?? '')) ?: $code,
                'old_code'      => trim((string) ($row[$colIndex['old_code'] ?? -1] ?? '')) ?: null,
                'category'      => trim((string) ($row[$colIndex['category'] ?? -1] ?? '')) ?: null,
                'trial_type'    => trim((string) ($row[$colIndex['trial_type'] ?? -1] ?? '')) ?: null,
                'origin'        => trim((string) ($row[$colIndex['origin'] ?? -1] ?? '')) ?: null,
                'breeder'       => trim((string) ($row[$colIndex['breeder'] ?? -1] ?? '')) ?: null,
            ];
        }

        if (empty($genotypes)) {
            return response()->json(['message' => 'Tidak ada data genotipe yang ditemukan di file.'], 422);
        }

        // Re-use bulkStore logic by forwarding as a JSON request
        $request->merge(['genotypes' => $genotypes]);
        return $this->bulkStore($request);
    }
}
