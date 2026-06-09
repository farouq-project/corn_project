<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DiseaseScore;
use App\Models\PlotObservation;
use App\Models\VarietyCandidate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VarietyCandidateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = VarietyCandidate::with(['genotype', 'principalBreeder'])
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->target_release_year, fn($q) => $q->where('target_release_year', $request->target_release_year));

        return response()->json($query->orderBy('target_release_year')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'genotype_id' => ['required', 'exists:genotypes,id'],
            'proposed_variety_name' => ['nullable', 'string'],
            'target_release_year' => ['nullable', 'digits:4'],
            'evaluation_start_year' => ['nullable', 'digits:4'],
            'adaptation_zones' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
        ]);

        $data['candidate_code'] = 'VC-' . strtoupper(Str::random(8));
        $data['principal_breeder_id'] = $request->user()->id;

        $candidate = VarietyCandidate::create($data);

        return response()->json($candidate->load(['genotype', 'principalBreeder']), 201);
    }

    public function show(VarietyCandidate $candidate): JsonResponse
    {
        return response()->json($candidate->load(['genotype', 'principalBreeder']));
    }

    public function update(Request $request, VarietyCandidate $candidate): JsonResponse
    {
        $data = $request->validate([
            'proposed_variety_name' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:under_evaluation,proposed,submitted_to_board,approved,released,withdrawn,rejected'],
            'target_release_year' => ['nullable', 'digits:4'],
            'submission_number' => ['nullable', 'string'],
            'submission_date' => ['nullable', 'date'],
            'release_date' => ['nullable', 'date'],
            'release_decree_number' => ['nullable', 'string'],
            'adaptation_zones' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
        ]);

        $candidate->update($data);
        return response()->json($candidate);
    }

    /**
     * Auto-calculate performance summary from approved trial data.
     */
    public function calculateSummary(VarietyCandidate $candidate): JsonResponse
    {
        $genotypeId = $candidate->genotype_id;

        // Yield summary from approved plot observations
        $yieldObs = PlotObservation::with(['values' => fn($q) => $q->whereHas('variable', fn($q) => $q->where('variable_code', 'YIELD')), 'environment'])
            ->where('genotype_id', $genotypeId)
            ->where('status', 'approved')
            ->get();

        $yieldValues = $yieldObs->flatMap->values->whereNotNull('numeric_value');
        $avgYield = $yieldValues->avg('numeric_value');

        $environments = $yieldObs->pluck('environment_id')->unique();

        // Disease resistance summary
        $diseaseScores = DiseaseScore::with(['evaluation.diseaseType'])
            ->where('genotype_id', $genotypeId)
            ->whereHas('evaluation', fn($q) => $q->where('status', 'approved'))
            ->get();

        $diseaseResistance = $diseaseScores
            ->groupBy(fn($s) => $s->evaluation?->diseaseType?->disease_code)
            ->map(fn($scores, $code) => [
                'disease_code' => $code,
                'avg_severity' => round($scores->avg('severity_score'), 2),
                'avg_incidence' => round($scores->avg('incidence_percent'), 2),
                'resistance_category' => $scores->last()?->resistance_category,
            ])->values()->toArray();

        $candidate->update([
            'num_trial_locations' => $environments->count(),
            'avg_yield_t_ha' => $avgYield ? round($avgYield, 3) : null,
            'disease_resistance_summary' => $diseaseResistance,
        ]);

        return response()->json([
            'candidate' => $candidate->fresh(['genotype']),
            'locations_evaluated' => $environments->count(),
            'avg_yield_t_ha' => $avgYield ? round($avgYield, 3) : null,
            'disease_resistance' => $diseaseResistance,
        ]);
    }
}
