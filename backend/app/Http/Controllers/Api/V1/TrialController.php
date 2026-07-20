<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Trial;
use App\Models\TrialEnvironment;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrialController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Trial::with(['season', 'location', 'trialType', 'principalResearcher'])
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('trial_code', 'ilike', "%{$request->search}%")
                  ->orWhere('trial_name', 'ilike', "%{$request->search}%");
            }))
            ->when($request->season_id, fn($q) => $q->where('season_id', $request->season_id))
            ->when($request->location_id, fn($q) => $q->where('location_id', $request->location_id))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->layout_design, fn($q) => $q->where('layout_design', $request->layout_design));

        if ($request->boolean('all')) {
            return response()->json($query->get(['id', 'trial_code', 'trial_name', 'status']));
        }

        return response()->json($query->with('environments')->withCount('genotypes')->orderBy('created_at', 'desc')->paginate($request->per_page ?? 20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_code' => ['required', 'string', 'max:30', 'unique:trials'],
            'trial_name' => ['required', 'string', 'max:255'],
            'environment_id' => ['nullable', 'exists:environments,id'],
            'environment_ids' => ['nullable', 'array'],
            'environment_ids.*' => ['exists:environments,id'],
            'environment_condition_id' => ['nullable', 'exists:environment_conditions,id'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'location_id' => ['nullable', 'exists:locations,id'],
            'trial_type_id' => ['nullable', 'exists:trial_types,id'],
            'objective' => ['nullable', 'string'],
            'layout_design' => ['required', 'in:RCBD,CRD,split_plot,factorial,augmented,alpha_lattice'],
            'replications' => ['required', 'integer', 'min:1', 'max:20'],
            'num_plots' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'plot_size_m2' => ['nullable', 'numeric'],
            'row_spacing_cm' => ['nullable', 'numeric'],
            'plant_spacing_cm' => ['nullable', 'numeric'],
            'planting_date' => ['nullable', 'date'],
            'harvest_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'principal_researcher_id' => ['nullable', 'exists:users,id'],
        ]);

        // Collect all environment IDs to link (merge single + multi)
        $envIds = collect($data['environment_ids'] ?? []);
        if (!empty($data['environment_id'])) {
            $envIds = $envIds->merge([$data['environment_id']])->unique()->values();
        }
        $firstEnvId = $envIds->first();

        // Derive location_id and season_id from primary environment if provided
        if ($firstEnvId) {
            $env = \App\Models\Environment::find($firstEnvId);
            if ($env) {
                $data['location_id'] = $data['location_id'] ?? $env->location_id;
                $data['season_id'] = $data['season_id'] ?? $env->season_id;
            }
        }

        unset($data['environment_ids']);
        $data['created_by'] = $request->user()->id;
        if (empty($data['principal_researcher_id'])) {
            $data['principal_researcher_id'] = $request->user()->id;
        }

        $trial = Trial::create($data);

        // Sync all environments via junction table
        foreach ($envIds as $envId) {
            TrialEnvironment::firstOrCreate(
                ['trial_id' => $trial->id, 'environment_id' => $envId],
                ['status' => 'active']
            );
        }

        AuditService::logCreated($trial);

        return response()->json($trial->load(['season', 'location', 'principalResearcher']), 201);
    }

    public function show(Trial $trial): JsonResponse
    {
        return response()->json($trial->load([
            'season', 'location', 'trialType', 'principalResearcher',
            'genotypes', 'researchers', 'environments',
        ])->append(['total_expense', 'phenotype_completion_rate']));
    }

    public function update(Request $request, Trial $trial): JsonResponse
    {
        $data = $request->validate([
            'trial_name' => ['sometimes', 'string'],
            'environment_id' => ['nullable', 'exists:environments,id'],
            'environment_ids' => ['nullable', 'array'],
            'environment_ids.*' => ['exists:environments,id'],
            'environment_condition_id' => ['nullable', 'exists:environment_conditions,id'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'location_id' => ['nullable', 'exists:locations,id'],
            'trial_type_id' => ['nullable', 'exists:trial_types,id'],
            'objective' => ['nullable', 'string'],
            'layout_design' => ['sometimes', 'in:RCBD,CRD,split_plot,factorial,augmented,alpha_lattice'],
            'replications' => ['sometimes', 'integer', 'min:1'],
            'num_plots' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'plot_size_m2' => ['nullable', 'numeric'],
            'planting_date' => ['nullable', 'date'],
            'harvest_date' => ['nullable', 'date'],
            'status' => ['sometimes', 'in:planned,active,harvested,completed,cancelled'],
            'notes' => ['nullable', 'string'],
            'principal_researcher_id' => ['nullable', 'exists:users,id'],
        ]);

        // Collect all environment IDs to sync
        $envIds = collect($data['environment_ids'] ?? []);
        if (!empty($data['environment_id'])) {
            $envIds = $envIds->merge([$data['environment_id']])->unique()->values();
        }
        unset($data['environment_ids']);

        $original = $trial->getAttributes();
        $trial->update($data);

        // Sync junction table if environment_ids were provided
        if ($envIds->isNotEmpty()) {
            // Remove environments no longer in the list, add new ones
            TrialEnvironment::where('trial_id', $trial->id)
                ->whereNotIn('environment_id', $envIds->toArray())
                ->delete();
            foreach ($envIds as $envId) {
                TrialEnvironment::firstOrCreate(
                    ['trial_id' => $trial->id, 'environment_id' => $envId],
                    ['status' => 'active']
                );
            }
        }

        AuditService::logUpdated($trial, $original);

        return response()->json($trial->load(['season', 'location']));
    }

    public function destroy(Trial $trial): JsonResponse
    {
        AuditService::logDeleted($trial);
        $trial->forceDelete();
        return response()->json(null, 204);
    }

    public function assignGenotypes(Request $request, Trial $trial): JsonResponse
    {
        $data = $request->validate([
            'genotypes' => ['required', 'array'],
            'genotypes.*.genotype_id' => ['required', 'exists:genotypes,id'],
            'genotypes.*.entry_number' => ['nullable', 'integer'],
            'genotypes.*.treatment_label' => ['nullable', 'string'],
            'genotypes.*.is_check' => ['boolean'],
        ]);

        $syncData = collect($data['genotypes'])->keyBy('genotype_id')->map(fn($g) => [
            'entry_number' => $g['entry_number'] ?? null,
            'treatment_label' => $g['treatment_label'] ?? null,
            'is_check' => $g['is_check'] ?? false,
        ])->toArray();

        $trial->genotypes()->sync($syncData);

        return response()->json($trial->load('genotypes'));
    }

    public function assignResearchers(Request $request, Trial $trial): JsonResponse
    {
        $data = $request->validate([
            'researchers' => ['required', 'array'],
            'researchers.*.user_id' => ['required', 'exists:users,id'],
            'researchers.*.role' => ['required', 'in:principal,co_researcher,field_observer,data_entry'],
        ]);

        $syncData = collect($data['researchers'])->keyBy('user_id')->map(fn($r) => ['role' => $r['role']])->toArray();
        $trial->researchers()->sync($syncData);

        return response()->json($trial->load('researchers'));
    }
}
