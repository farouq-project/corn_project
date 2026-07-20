<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Characteristic;
use App\Models\Environment;
use App\Models\ObservationRecord;
use App\Models\ObservationValue;
use App\Models\Trial;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ObservationRecordController extends Controller
{
    /**
     * Generate a virtual spreadsheet grid for a trial.
     * Rows = trial.genotypes × trial.environments × replications.
     * Existing ObservationRecords are overlaid; missing rows return record_id = null.
     */
    public function grid(Request $request): JsonResponse
    {
        $request->validate([
            'trial_id'       => ['required', 'exists:trials,id'],
            'environment_id' => ['nullable', 'exists:environments,id'],
        ]);

        $trial = Trial::with([
            'genotypes' => fn ($q) => $q->orderByPivot('entry_number'),
            'environments',
        ])->findOrFail($request->trial_id);

        $trialMeta = [
            'id'          => $trial->id,
            'trial_name'  => $trial->trial_name,
            'replications' => $trial->replications,
            'num_plots'   => $trial->num_plots,
        ];

        // ── Simple-plot mode: num_plots set, no genotypes assigned ──────────────
        if ($trial->num_plots && $trial->genotypes->isEmpty()) {
            $records = ObservationRecord::with(['values.characteristic'])
                ->where('trial_id', $trial->id)
                ->whereNull('genotype_id')
                ->get();

            $plotIndex = $records->keyBy('plot_no');

            $rows = [];
            for ($i = 1; $i <= $trial->num_plots; $i++) {
                $record = $plotIndex->get((string) $i);
                $values = $this->extractValues($record);
                $rows[] = [
                    'entry_number'   => $i,
                    'plot_no'        => (string) $i,
                    'genotype_id'    => null,
                    'genotype'       => null,
                    'environment_id' => null,
                    'environment'    => null,
                    'replication'    => 1,
                    'record_id'      => $record?->id,
                    'values'         => empty($values) ? (object) [] : $values,
                ];
            }

            return response()->json(['trial' => array_merge($trialMeta, ['mode' => 'simple']), 'rows' => $rows]);
        }

        // ── Matrix mode: genotypes × environments × replications ────────────────
        $environments = $request->filled('environment_id')
            ? $trial->environments->where('id', $request->environment_id)->values()
            : $trial->environments->values();

        if ($environments->isEmpty() || $trial->genotypes->isEmpty()) {
            return response()->json(['trial' => $trialMeta, 'rows' => []]);
        }

        $genotypeIds = $trial->genotypes->pluck('id')->toArray();
        $envIds      = $environments->pluck('id')->toArray();

        $records = ObservationRecord::with(['values.characteristic'])
            ->whereIn('genotype_id', $genotypeIds)
            ->whereIn('environment_id', $envIds)
            ->get();

        $index = $records->keyBy(fn ($r) => "{$r->genotype_id}:{$r->environment_id}:{$r->replication}");

        $rows = [];
        foreach ($trial->genotypes as $idx => $genotype) {
            $entryNumber = $genotype->pivot->entry_number ?? ($idx + 1);
            foreach ($environments as $env) {
                for ($rep = 1; $rep <= $trial->replications; $rep++) {
                    $key    = "{$genotype->id}:{$env->id}:{$rep}";
                    $record = $index->get($key);
                    $values = $this->extractValues($record);
                    $rows[] = [
                        'entry_number'   => $entryNumber,
                        'plot_no'        => $record?->plot_no ?? (string) $entryNumber,
                        'genotype_id'    => $genotype->id,
                        'genotype'       => [
                            'id'            => $genotype->id,
                            'genotype_code' => $genotype->genotype_code,
                            'genotype_name' => $genotype->genotype_name,
                        ],
                        'environment_id' => $env->id,
                        'environment'    => [
                            'id'               => $env->id,
                            'environment_code' => $env->environment_code,
                            'name'             => $env->name,
                        ],
                        'replication' => $rep,
                        'record_id'   => $record?->id,
                        'values'      => empty($values) ? (object) [] : $values,
                    ];
                }
            }
        }

        return response()->json(['trial' => $trialMeta, 'rows' => $rows]);
    }

    private function extractValues(?ObservationRecord $record): array
    {
        if (!$record) return [];
        return $record->values
            ->groupBy(fn ($v) => $v->characteristic?->code ?? $v->characteristic_id)
            ->mapWithKeys(fn ($group, $code) => [
                $code => $group->count() > 1
                    ? round($group->whereNotNull('value')->avg('value'), 4)
                    : ($group->first()?->value !== null ? (float) $group->first()->value : null),
            ])->toArray();
    }

    public function index(Request $request): JsonResponse
    {
        $query = ObservationRecord::with(['genotype', 'environment.location', 'environment.season', 'recorder', 'values.characteristic'])
            ->when($request->filled('environment_id'), fn($q) => $q->where('environment_id', $request->environment_id))
            ->when($request->filled('genotype_id'), fn($q) => $q->where('genotype_id', $request->genotype_id))
            ->when($request->filled('season_id'), fn($q) => $q->where('season_id', $request->season_id))
            ->when($request->filled('replication'), fn($q) => $q->where('replication', $request->replication));

        $perPage = min((int) ($request->per_page ?? 50), 500);
        $records = $query->orderBy('plot_no')->paginate($perPage);

        $records->getCollection()->transform(fn($record) => $this->formatRecord($record));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_id' => ['nullable', 'exists:trials,id'],
            'plot_no' => ['required', 'string', 'max:20'],
            'genotype_id' => ['nullable', 'exists:genotypes,id'],
            'environment_id' => ['nullable', 'exists:environments,id'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'replication' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
            'values' => ['nullable', 'array'],
            'values.*.characteristic_id' => ['required_with:values', 'exists:characteristics,id'],
            'values.*.value' => ['nullable', 'numeric'],
        ]);

        // Simple-plot mode: trial_id provided, no genotype/environment
        $isSimplePlot = !empty($data['trial_id']) && empty($data['genotype_id']) && empty($data['environment_id']);

        if (!$isSimplePlot && empty($data['season_id']) && !empty($data['environment_id'])) {
            $data['season_id'] = Environment::find($data['environment_id'])?->season_id;
        }

        $data['record_code'] = 'OBS-' . strtoupper(Str::random(10));
        $data['recorded_by'] = $request->user()->id;

        $values = $data['values'] ?? [];
        unset($data['values']);

        // Check for existing record (different logic per mode)
        if ($isSimplePlot) {
            $existing = ObservationRecord::withTrashed()
                ->where('trial_id', $data['trial_id'])
                ->whereNull('genotype_id')
                ->where('plot_no', $data['plot_no'])
                ->first();
        } else {
            $existing = ObservationRecord::withTrashed()
                ->where('environment_id', $data['environment_id'])
                ->where('season_id', $data['season_id'] ?? null)
                ->where('plot_no', $data['plot_no'])
                ->where('replication', $data['replication'])
                ->first();
        }

        if ($existing && $existing->trashed()) {
            $existing->restore();
            $existing->update(array_diff_key($data, ['record_code' => true]));
            $record = $existing;
        } elseif ($existing) {
            return response()->json([
                'message' => "Plot '{$data['plot_no']}' sudah ada. Gunakan fitur edit untuk mengubah nilainya.",
            ], 422);
        } else {
            $record = ObservationRecord::create($data);
        }

        foreach ($values as $value) {
            $sampleNum = $value['sample_number'] ?? 1;
            ObservationValue::updateOrCreate(
                ['observation_record_id' => $record->id, 'characteristic_id' => $value['characteristic_id'], 'sample_number' => $sampleNum],
                ['value' => $value['value'] ?? null]
            );
        }

        AuditService::logCreated($record);

        $record->load(['genotype', 'environment.location', 'environment.season', 'recorder', 'values.characteristic']);

        return response()->json($this->formatRecord($record), 201);
    }

    public function update(Request $request, ObservationRecord $record): JsonResponse
    {
        $data = $request->validate([
            'plot_no' => ['sometimes', 'string', 'max:20'],
            'genotype_id' => ['sometimes', 'exists:genotypes,id'],
            'environment_id' => ['sometimes', 'exists:environments,id'],
            'replication' => ['sometimes', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
            'values' => ['nullable', 'array'],
            'values.*.characteristic_id' => ['required_with:values', 'exists:characteristics,id'],
            'values.*.value' => ['nullable', 'numeric'],
            'values.*.sample_number' => ['nullable', 'integer', 'min:1'],
        ]);

        $values = $data['values'] ?? null;
        unset($data['values']);

        $original = $record->getOriginal();
        $record->update($data);

        if ($values !== null) {
            foreach ($values as $value) {
                $sampleNum = $value['sample_number'] ?? 1;
                ObservationValue::updateOrCreate(
                    [
                        'observation_record_id' => $record->id,
                        'characteristic_id' => $value['characteristic_id'],
                        'sample_number' => $sampleNum,
                    ],
                    ['value' => $value['value'] ?? null]
                );
            }
        }

        AuditService::logUpdated($record, $original);

        $record->load(['genotype', 'environment.location', 'environment.season', 'recorder', 'values.characteristic']);

        return response()->json($this->formatRecord($record));
    }

    public function destroy(ObservationRecord $record): JsonResponse
    {
        AuditService::logDeleted($record);
        $record->delete(); // soft-delete — restorable within 30 days

        return response()->json(['message' => 'Observation record deleted.']);
    }

    /** List soft-deleted records (up to 30 days) for restore UI */
    public function deletedIndex(Request $request): JsonResponse
    {
        $records = ObservationRecord::onlyTrashed()
            ->with(['genotype', 'environment', 'recorder', 'values.characteristic'])
            ->where('deleted_at', '>=', now()->subDays(30))
            ->when($request->filled('environment_id'), fn($q) => $q->where('environment_id', $request->environment_id))
            ->orderBy('deleted_at', 'desc')
            ->paginate($request->per_page ?? 50);

        $records->getCollection()->transform(fn($r) => $this->formatRecord($r));
        return response()->json($records);
    }

    /** Restore a soft-deleted record */
    public function restore(int $id): JsonResponse
    {
        $record = ObservationRecord::onlyTrashed()
            ->where('id', $id)
            ->where('deleted_at', '>=', now()->subDays(30))
            ->firstOrFail();

        $record->restore();
        AuditService::logAction('restored', $record);

        return response()->json(['message' => 'Record restored.', 'record' => $this->formatRecord($record->load(['genotype', 'environment', 'recorder', 'values.characteristic']))]);
    }

    /** Edit history for a record via AuditLog */
    public function history(ObservationRecord $record): JsonResponse
    {
        $logs = \App\Models\AuditLog::where('auditable_type', ObservationRecord::class)
            ->where('auditable_id', $record->id)
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($logs);
    }

    /**
     * Data Rata-Rata: averages per genotype x environment x characteristic,
     * with missing replication values imputed as the mean of present values.
     */
    public function aggregate(Request $request): JsonResponse
    {
        $request->validate([
            'environment_id' => ['nullable', 'exists:environments,id'],
            'genotype_id' => ['nullable', 'exists:genotypes,id'],
        ]);

        $countQuery = ObservationRecord::query()
            ->when($request->filled('environment_id'), fn($q) => $q->where('environment_id', $request->environment_id))
            ->when($request->filled('genotype_id'), fn($q) => $q->where('genotype_id', $request->genotype_id));

        if ($countQuery->count() > 5000) {
            return response()->json([
                'message' => 'Terlalu banyak data untuk diagregasi sekaligus. Silakan filter berdasarkan Environment atau Genotipe.',
            ], 422);
        }

        $records = ObservationRecord::with(['genotype', 'environment', 'values'])
            ->when($request->filled('environment_id'), fn($q) => $q->where('environment_id', $request->environment_id))
            ->when($request->filled('genotype_id'), fn($q) => $q->where('genotype_id', $request->genotype_id))
            ->get();

        $characteristics = Characteristic::active()->ordered()->get();

        $groups = $records->groupBy(fn($record) => $record->genotype_id . '-' . $record->environment_id);

        $data = $groups->map(function ($groupRecords) use ($characteristics) {
            $first = $groupRecords->first();

            $characteristicData = [];

            foreach ($characteristics as $characteristic) {
                $values = [];

                foreach ($groupRecords as $record) {
                    $observationValue = $record->values->firstWhere('characteristic_id', $characteristic->id);
                    $values[(string) $record->replication] = $observationValue?->value !== null
                        ? (float) $observationValue->value
                        : null;
                }

                $present = array_filter($values, fn($v) => $v !== null);
                $imputed = [];

                if (count($present) > 0) {
                    $mean = array_sum($present) / count($present);

                    foreach ($values as $rep => $v) {
                        if ($v === null) {
                            $values[$rep] = $mean;
                            $imputed[$rep] = true;
                        }
                    }

                    $average = $mean;
                } else {
                    $average = null;
                }

                $characteristicData[$characteristic->code] = [
                    'values' => $values,
                    'imputed' => $imputed,
                    'average' => $average !== null ? round($average, $characteristic->decimal_places) : null,
                ];
            }

            return [
                'genotype_id' => $first->genotype_id,
                'genotype_code' => $first->genotype?->genotype_code,
                'genotype_name' => $first->genotype?->genotype_name,
                'environment_id' => $first->environment_id,
                'environment_code' => $first->environment?->environment_code,
                'characteristics' => $characteristicData,
            ];
        })->values();

        return response()->json(['data' => $data]);
    }

    private function formatRecord(ObservationRecord $record): array
    {
        return [
            'id' => $record->id,
            'record_code' => $record->record_code,
            'plot_no' => $record->plot_no,
            'genotype_id' => $record->genotype_id,
            'genotype' => $record->genotype,
            'environment_id' => $record->environment_id,
            'environment' => $record->environment,
            'season_id' => $record->season_id,
            'replication' => $record->replication,
            'notes' => $record->notes,
            'recorded_by' => $record->recorded_by,
            'recorder' => $record->recorder,
            // For backward compat: flat values map (sample 1 / average per char code)
            'values' => $record->values
                ->groupBy(fn($v) => $v->characteristic?->code ?? $v->characteristic_id)
                ->mapWithKeys(fn($group, $code) => [
                    $code => $group->count() > 1
                        ? round($group->whereNotNull('value')->avg('value'), 4)
                        : ($group->first()?->value !== null ? (float) $group->first()->value : null),
                ]),
            // Full samples including sample_number
            'samples' => $record->values->map(fn($v) => [
                'characteristic_id' => $v->characteristic_id,
                'code' => $v->characteristic?->code,
                'sample_number' => $v->sample_number,
                'value' => $v->value !== null ? (float) $v->value : null,
            ]),
            'staff_name' => $record->recorder?->name,
            'created_at' => $record->created_at,
            'updated_at' => $record->updated_at,
            'deleted_at' => $record->deleted_at,
        ];
    }
}
