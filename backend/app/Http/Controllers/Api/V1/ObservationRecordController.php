<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Characteristic;
use App\Models\Environment;
use App\Models\ObservationRecord;
use App\Models\ObservationValue;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ObservationRecordController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ObservationRecord::with(['genotype', 'environment.location', 'environment.season', 'recorder', 'values.characteristic'])
            ->when($request->filled('environment_id'), fn($q) => $q->where('environment_id', $request->environment_id))
            ->when($request->filled('genotype_id'), fn($q) => $q->where('genotype_id', $request->genotype_id))
            ->when($request->filled('season_id'), fn($q) => $q->where('season_id', $request->season_id))
            ->when($request->filled('replication'), fn($q) => $q->where('replication', $request->replication));

        $records = $query->orderBy('plot_no')->paginate($request->per_page ?? 50);

        $records->getCollection()->transform(fn($record) => $this->formatRecord($record));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plot_no' => ['required', 'string', 'max:20'],
            'genotype_id' => ['required', 'exists:genotypes,id'],
            'environment_id' => ['required', 'exists:environments,id'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'replication' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
            'values' => ['nullable', 'array'],
            'values.*.characteristic_id' => ['required_with:values', 'exists:characteristics,id'],
            'values.*.value' => ['nullable', 'numeric'],
        ]);

        if (empty($data['season_id'])) {
            $data['season_id'] = Environment::find($data['environment_id'])?->season_id;
        }

        $data['record_code'] = 'OBS-' . strtoupper(Str::random(10));
        $data['recorded_by'] = $request->user()->id;

        $values = $data['values'] ?? [];
        unset($data['values']);

        $record = ObservationRecord::create($data);

        foreach ($values as $value) {
            ObservationValue::create([
                'observation_record_id' => $record->id,
                'characteristic_id' => $value['characteristic_id'],
                'value' => $value['value'] ?? null,
            ]);
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
        ]);

        $values = $data['values'] ?? null;
        unset($data['values']);

        $original = $record->getOriginal();
        $record->update($data);

        if ($values !== null) {
            foreach ($values as $value) {
                ObservationValue::updateOrCreate(
                    [
                        'observation_record_id' => $record->id,
                        'characteristic_id' => $value['characteristic_id'],
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
        $record->delete();

        return response()->json(['message' => 'Observation record deleted.']);
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
            'values' => $record->values->mapWithKeys(fn($v) => [
                $v->characteristic?->code ?? $v->characteristic_id => $v->value !== null ? (float) $v->value : null,
            ]),
            'created_at' => $record->created_at,
            'updated_at' => $record->updated_at,
        ];
    }
}
