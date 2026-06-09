<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PhenotypeObservation;
use App\Models\PhenotypeValue;
use App\Models\PhenotypeVariable;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PhenotypeController extends Controller
{
    // Variables
    public function variableIndex(Request $request): JsonResponse
    {
        $query = PhenotypeVariable::query()
            ->when($request->category, fn($q) => $q->where('category', $request->category))
            ->when(isset($request->is_active), fn($q) => $q->where('is_active', $request->boolean('is_active')));

        if ($request->boolean('all')) {
            return response()->json($query->where('is_active', true)->orderBy('sort_order')->get());
        }

        return response()->json($query->orderBy('category')->orderBy('sort_order')->paginate(50));
    }

    public function variableStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'variable_code' => ['required', 'string', 'unique:phenotype_variables'],
            'variable_name' => ['required', 'string'],
            'abbreviation' => ['nullable', 'string', 'max:20'],
            'category' => ['required', 'in:vegetative,reproductive,ear_characteristics,yield_components,stress_response,seed_characteristics'],
            'data_type' => ['required', 'in:numeric,integer,text,boolean,scale,date'],
            'unit' => ['nullable', 'string', 'max:20'],
            'min_value' => ['nullable', 'numeric'],
            'max_value' => ['nullable', 'numeric'],
            'decimal_places' => ['integer', 'min:0', 'max:6'],
            'description' => ['nullable', 'string'],
            'measurement_guide' => ['nullable', 'string'],
            'is_required' => ['boolean'],
            'sort_order' => ['integer'],
        ]);

        $variable = PhenotypeVariable::create($data);

        return response()->json($variable, 201);
    }

    public function variableUpdate(Request $request, PhenotypeVariable $variable): JsonResponse
    {
        $data = $request->validate([
            'variable_name' => ['sometimes', 'string'],
            'abbreviation' => ['nullable', 'string', 'max:20'],
            'category' => ['sometimes', 'in:vegetative,reproductive,ear_characteristics,yield_components,stress_response,seed_characteristics'],
            'unit' => ['nullable', 'string'],
            'min_value' => ['nullable', 'numeric'],
            'max_value' => ['nullable', 'numeric'],
            'decimal_places' => ['integer'],
            'description' => ['nullable', 'string'],
            'measurement_guide' => ['nullable', 'string'],
            'is_required' => ['boolean'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer'],
        ]);

        $variable->update($data);

        return response()->json($variable);
    }

    // Observations
    public function observationIndex(Request $request): JsonResponse
    {
        $query = PhenotypeObservation::with(['trial', 'genotype', 'season', 'recorder'])
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->when($request->genotype_id, fn($q) => $q->where('genotype_id', $request->genotype_id))
            ->when($request->season_id, fn($q) => $q->where('season_id', $request->season_id))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->growth_stage, fn($q) => $q->where('growth_stage', $request->growth_stage));

        return response()->json($query->orderBy('observation_date', 'desc')->paginate($request->per_page ?? 20));
    }

    public function observationStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_id' => ['required', 'exists:trials,id'],
            'genotype_id' => ['required', 'exists:genotypes,id'],
            'season_id' => ['required', 'exists:seasons,id'],
            'replication' => ['required', 'integer', 'min:1'],
            'plot_number' => ['nullable', 'integer'],
            'row_label' => ['nullable', 'string'],
            'observation_date' => ['required', 'date'],
            'growth_stage' => ['nullable', 'in:emergence,vegetative,tasseling,silking,grain_fill,maturity,harvest'],
            'general_notes' => ['nullable', 'string'],
            'values' => ['nullable', 'array'],
            'values.*.variable_id' => ['required_with:values', 'exists:phenotype_variables,id'],
            'values.*.numeric_value' => ['nullable'],
            'values.*.text_value' => ['nullable', 'string'],
        ]);

        $data['observation_code'] = 'OBS-' . date('Ymd') . '-' . str_pad(random_int(1, 99999), 5, '0', STR_PAD_LEFT);
        $data['recorded_by'] = $request->user()->id;
        $data['status'] = 'submitted';
        $values = $data['values'] ?? [];
        unset($data['values']);

        $observation = PhenotypeObservation::create($data);

        if (!empty($values)) {
            foreach ($values as $value) {
                PhenotypeValue::create([
                    'observation_id' => $observation->id,
                    'variable_id' => $value['variable_id'],
                    'numeric_value' => $value['numeric_value'] ?? null,
                    'text_value' => $value['text_value'] ?? null,
                ]);
            }
        }

        AuditService::logCreated($observation);

        return response()->json($observation->load(['trial', 'genotype', 'values.variable']), 201);
    }

    public function observationShow(PhenotypeObservation $observation): JsonResponse
    {
        return response()->json($observation->load(['trial', 'genotype', 'season', 'recorder', 'approver', 'values.variable']));
    }

    public function observationUpdate(Request $request, PhenotypeObservation $observation): JsonResponse
    {
        $data = $request->validate([
            'observation_date' => ['sometimes', 'date'],
            'growth_stage' => ['nullable', 'in:emergence,vegetative,tasseling,silking,grain_fill,maturity,harvest'],
            'general_notes' => ['nullable', 'string'],
            'values' => ['nullable', 'array'],
            'values.*.variable_id' => ['required_with:values', 'exists:phenotype_variables,id'],
            'values.*.numeric_value' => ['nullable'],
            'values.*.text_value' => ['nullable', 'string'],
        ]);

        $observation->update($data);

        if (isset($data['values'])) {
            foreach ($data['values'] as $value) {
                PhenotypeValue::updateOrCreate(
                    ['observation_id' => $observation->id, 'variable_id' => $value['variable_id']],
                    ['numeric_value' => $value['numeric_value'] ?? null, 'text_value' => $value['text_value'] ?? null]
                );
            }
        }

        return response()->json($observation->load(['values.variable']));
    }

    public function approveObservation(Request $request, PhenotypeObservation $observation): JsonResponse
    {
        $request->validate(['status' => 'required|in:approved,rejected', 'notes' => 'nullable|string']);

        $observation->update([
            'status' => $request->status,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        AuditService::logAction("observation_{$request->status}", $observation);

        return response()->json($observation);
    }

    public function trialSummary(Request $request): JsonResponse
    {
        $request->validate(['trial_id' => 'required|exists:trials,id']);

        $observations = PhenotypeObservation::with(['genotype', 'values.variable'])
            ->where('trial_id', $request->trial_id)
            ->where('status', 'approved')
            ->get();

        $summary = $observations->groupBy('genotype_id')->map(function ($obs, $genotypeId) {
            $genotype = $obs->first()->genotype;
            $means = $obs->flatMap->values
                ->groupBy('variable_id')
                ->map(fn($vals) => [
                    'variable' => $vals->first()->variable?->variable_name,
                    'unit' => $vals->first()->variable?->unit,
                    'mean' => round($vals->avg(fn($v) => (float) $v->numeric_value), 2),
                    'n' => $vals->whereNotNull('numeric_value')->count(),
                ]);

            return ['genotype' => $genotype?->genotype_name, 'code' => $genotype?->genotype_code, 'means' => $means];
        });

        return response()->json($summary->values());
    }
}
