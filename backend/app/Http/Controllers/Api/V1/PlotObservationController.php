<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PlotObservation;
use App\Models\PlotObservationValue;
use App\Models\Trial;
use App\Models\TrialPlot;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlotObservationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PlotObservation::with(['plot.block', 'genotype', 'environment.location', 'recorder'])
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->when($request->environment_id, fn($q) => $q->where('environment_id', $request->environment_id))
            ->when($request->genotype_id, fn($q) => $q->where('genotype_id', $request->genotype_id))
            ->when($request->growth_stage, fn($q) => $q->where('growth_stage', $request->growth_stage))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->from_date, fn($q) => $q->where('observation_date', '>=', $request->from_date))
            ->when($request->to_date, fn($q) => $q->where('observation_date', '<=', $request->to_date));

        return response()->json($query->orderBy('observation_date', 'desc')->paginate($request->per_page ?? 30));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_plot_id' => ['required', 'exists:trial_plots,id'],
            'observation_date' => ['required', 'date'],
            'growth_stage' => ['nullable', 'string'],
            'days_after_planting' => ['nullable', 'integer', 'min:0'],
            'general_notes' => ['nullable', 'string'],
            'values' => ['nullable', 'array'],
            'values.*.variable_id' => ['required_with:values', 'exists:phenotype_variables,id'],
            'values.*.numeric_value' => ['nullable', 'numeric'],
            'values.*.text_value' => ['nullable', 'string'],
            'values.*.is_missing' => ['boolean'],
            'values.*.missing_reason' => ['nullable', 'string'],
        ]);

        $plot = TrialPlot::with(['trial', 'environment', 'block'])->findOrFail($data['trial_plot_id']);

        $data['observation_code'] = 'OBS-' . strtoupper(Str::random(10));
        $data['trial_id'] = $plot->trial_id;
        $data['environment_id'] = $plot->environment_id;
        $data['trial_block_id'] = $plot->trial_block_id;
        $data['genotype_id'] = $plot->genotype_id;
        $data['recorded_by'] = $request->user()->id;
        $data['status'] = 'submitted';

        $values = $data['values'] ?? [];
        unset($data['values']);

        $data['total_variables_expected'] = count($values);
        $data['total_variables_filled'] = count(array_filter($values, fn($v) => isset($v['numeric_value']) || isset($v['text_value'])));

        $observation = PlotObservation::create($data);

        foreach ($values as $value) {
            PlotObservationValue::create([
                'observation_id' => $observation->id,
                'variable_id' => $value['variable_id'],
                'numeric_value' => $value['numeric_value'] ?? null,
                'text_value' => $value['text_value'] ?? null,
                'is_missing' => $value['is_missing'] ?? false,
                'missing_reason' => $value['missing_reason'] ?? null,
            ]);
        }

        AuditService::logCreated($observation);

        return response()->json($observation->load(['plot.block', 'genotype', 'values.variable']), 201);
    }

    public function show(PlotObservation $observation): JsonResponse
    {
        return response()->json($observation->load([
            'plot.genotype', 'plot.block',
            'environment.location', 'environment.season',
            'genotype', 'recorder', 'approver',
            'values.variable',
        ]));
    }

    public function update(Request $request, PlotObservation $observation): JsonResponse
    {
        $data = $request->validate([
            'observation_date' => ['sometimes', 'date'],
            'growth_stage' => ['nullable', 'string'],
            'days_after_planting' => ['nullable', 'integer'],
            'general_notes' => ['nullable', 'string'],
            'values' => ['nullable', 'array'],
            'values.*.variable_id' => ['required_with:values', 'exists:phenotype_variables,id'],
            'values.*.numeric_value' => ['nullable', 'numeric'],
            'values.*.text_value' => ['nullable', 'string'],
            'values.*.is_missing' => ['boolean'],
        ]);

        $observation->update($data);

        if (isset($data['values'])) {
            foreach ($data['values'] as $value) {
                PlotObservationValue::updateOrCreate(
                    ['observation_id' => $observation->id, 'variable_id' => $value['variable_id']],
                    [
                        'numeric_value' => $value['numeric_value'] ?? null,
                        'text_value' => $value['text_value'] ?? null,
                        'is_missing' => $value['is_missing'] ?? false,
                    ]
                );
            }

            $observation->update([
                'total_variables_filled' => $observation->values()->whereNotNull('numeric_value')->orWhere('text_value', '!=', '')->count(),
            ]);
        }

        return response()->json($observation->load(['values.variable']));
    }

    public function approve(Request $request, PlotObservation $observation): JsonResponse
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

    /**
     * Get data matrix for statistical analysis:
     * Rows = genotype × replication × environment combinations.
     * Columns = variables.
     * This format is ready for ANOVA/AMMI/GGE input.
     */
    public function dataMatrix(Request $request): JsonResponse
    {
        $request->validate(['trial_id' => 'required|exists:trials,id']);

        $observations = PlotObservation::with(['values.variable', 'plot.block', 'environment.location', 'genotype'])
            ->where('trial_id', $request->trial_id)
            ->where('status', 'approved')
            ->when($request->environment_id, fn($q) => $q->where('environment_id', $request->environment_id))
            ->when($request->growth_stage, fn($q) => $q->where('growth_stage', $request->growth_stage))
            ->get();

        $matrix = $observations->map(fn($obs) => [
            'observation_id' => $obs->id,
            'trial_id' => $obs->trial_id,
            'environment_id' => $obs->environment_id,
            'environment_name' => $obs->environment?->name,
            'location' => $obs->environment?->location?->field_name,
            'season' => $obs->environment?->season?->season_name,
            'genotype_id' => $obs->genotype_id,
            'genotype_code' => $obs->genotype?->genotype_code,
            'genotype_name' => $obs->genotype?->genotype_name,
            'block' => $obs->plot?->block?->block_number,
            'replication' => $obs->plot?->block?->block_number,
            'plot_number' => $obs->plot?->plot_number,
            'observation_date' => $obs->observation_date,
            'growth_stage' => $obs->growth_stage,
            'values' => $obs->values->mapWithKeys(fn($v) => [
                $v->variable?->variable_code ?? $v->variable_id => $v->numeric_value,
            ]),
        ]);

        return response()->json([
            'trial_id' => $request->trial_id,
            'total_observations' => $matrix->count(),
            'matrix' => $matrix,
        ]);
    }

    /**
     * Missing data report — which plots have no observations.
     */
    public function missingReport(Request $request): JsonResponse
    {
        $request->validate([
            'trial_id' => 'required|exists:trials,id',
            'growth_stage' => 'nullable|string',
        ]);

        $allPlots = TrialPlot::with(['genotype', 'block', 'environment.location'])
            ->where('trial_id', $request->trial_id)
            ->where('status', 'active')
            ->get();

        $observedPlotIds = PlotObservation::where('trial_id', $request->trial_id)
            ->when($request->growth_stage, fn($q) => $q->where('growth_stage', $request->growth_stage))
            ->whereIn('status', ['submitted', 'approved'])
            ->pluck('trial_plot_id')
            ->unique();

        $missingPlots = $allPlots->whereNotIn('id', $observedPlotIds);

        return response()->json([
            'total_plots' => $allPlots->count(),
            'observed_plots' => $observedPlotIds->count(),
            'missing_plots' => $missingPlots->count(),
            'completion_rate' => round(($observedPlotIds->count() / max($allPlots->count(), 1)) * 100, 1),
            'missing' => $missingPlots->map(fn($p) => [
                'plot_code' => $p->plot_code,
                'plot_number' => $p->plot_number,
                'genotype' => $p->genotype?->genotype_code,
                'block' => $p->block?->block_label,
                'environment' => $p->environment?->location?->field_name,
            ])->values(),
        ]);
    }
}
