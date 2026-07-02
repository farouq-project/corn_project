<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DiseaseEvaluation;
use App\Models\DiseaseScore;
use App\Models\DiseaseType;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DiseaseController extends Controller
{
    // ── Disease Types ──────────────────────────────────────────────────────────

    public function typeIndex(): JsonResponse
    {
        return response()->json(DiseaseType::where('is_active', true)->orderBy('sort_order')->get());
    }

    public function typeStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'disease_name' => ['required', 'string', 'max:100'],
            'disease_code' => ['nullable', 'string', 'max:20'],
        ]);

        $code = !empty($data['disease_code'])
            ? strtoupper($data['disease_code'])
            : 'DIS-' . strtoupper(Str::random(6));

        $type = DiseaseType::create([
            'disease_code' => $code,
            'disease_name' => $data['disease_name'],
            'is_active' => true,
            'sort_order' => (DiseaseType::max('sort_order') ?? 0) + 1,
        ]);

        return response()->json($type, 201);
    }

    // ── Disease Evaluations ────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = DiseaseEvaluation::with(['trial', 'environment.location', 'diseaseType', 'evaluator'])
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->when($request->environment_id, fn($q) => $q->where('environment_id', $request->environment_id))
            ->when($request->disease_type_id, fn($q) => $q->where('disease_type_id', $request->disease_type_id))
            ->when($request->status, fn($q) => $q->where('status', $request->status));

        return response()->json($query->withCount('scores')->orderBy('evaluation_date', 'desc')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_id' => ['required', 'exists:trials,id'],
            'environment_id' => ['required', 'exists:environments,id'],
            'disease_type_id' => ['required', 'exists:disease_types,id'],
            'evaluation_date' => ['required', 'date'],
            'growth_stage' => ['nullable', 'string'],
            'days_after_planting' => ['nullable', 'integer'],
            'weather_notes' => ['nullable', 'string'],
            'general_observations' => ['nullable', 'string'],
        ]);

        $data['evaluation_code'] = 'DE-' . date('Ymd') . '-' . strtoupper(Str::random(6));
        $data['evaluator_id'] = $request->user()->id;
        $data['status'] = 'draft';

        $evaluation = DiseaseEvaluation::create($data);
        AuditService::logCreated($evaluation);

        return response()->json($evaluation->load(['diseaseType', 'environment.location']), 201);
    }

    public function show(DiseaseEvaluation $evaluation): JsonResponse
    {
        return response()->json($evaluation->load([
            'trial', 'environment.location', 'environment.season',
            'diseaseType', 'evaluator', 'approver',
            'scores.genotype', 'scores.block',
        ]));
    }

    public function destroy(DiseaseEvaluation $evaluation): JsonResponse
    {
        AuditService::logDeleted($evaluation);
        $evaluation->scores()->delete();
        $evaluation->forceDelete(); // hard delete so it's truly gone

        return response()->json(['message' => 'Evaluasi berhasil dihapus.']);
    }

    // ── Disease Scores ─────────────────────────────────────────────────────────

    public function storeScores(Request $request, DiseaseEvaluation $evaluation): JsonResponse
    {
        $data = $request->validate([
            'scores' => ['required', 'array', 'min:1'],
            'scores.*.trial_plot_id' => ['required', 'exists:trial_plots,id'],
            'scores.*.incidence_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'scores.*.severity_score' => ['nullable', 'numeric', 'min:0'],
            'scores.*.intensity_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'scores.*.symptom_first_seen' => ['nullable', 'date'],
            'scores.*.plants_assessed' => ['nullable', 'integer', 'min:0'],
            'scores.*.plants_affected' => ['nullable', 'integer', 'min:0'],
            'scores.*.resistance_category' => ['nullable', 'in:tahan,agak_tahan,moderat,rentan,sangat_rentan'],
            'scores.*.notes' => ['nullable', 'string'],
        ]);

        $created = [];
        foreach ($data['scores'] as $scoreData) {
            $plot = \App\Models\TrialPlot::find($scoreData['trial_plot_id']);

            // Auto-classify resistance if not provided
            if (!isset($scoreData['resistance_category']) && isset($scoreData['severity_score'])) {
                $scoreData['resistance_category'] = $this->classifyResistance(
                    $scoreData['severity_score'],
                    $scoreData['incidence_percent'] ?? null
                );
            }

            $score = DiseaseScore::updateOrCreate(
                ['evaluation_id' => $evaluation->id, 'trial_plot_id' => $scoreData['trial_plot_id']],
                array_merge($scoreData, [
                    'genotype_id' => $plot->genotype_id,
                    'trial_block_id' => $plot->trial_block_id,
                ])
            );

            $created[] = $score;
        }

        // Update evaluation status
        $evaluation->update(['status' => 'submitted']);

        AuditService::logAction('disease_scores_recorded', $evaluation, ['count' => count($created)]);

        return response()->json(['recorded' => count($created), 'scores' => $created], 201);
    }

    public function approve(Request $request, DiseaseEvaluation $evaluation): JsonResponse
    {
        $evaluation->update([
            'status' => $request->input('status', 'approved'),
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return response()->json($evaluation);
    }

    /**
     * Resistance summary per genotype across all evaluations of a trial.
     * Used for variety release documentation.
     */
    public function resistanceSummary(Request $request): JsonResponse
    {
        $request->validate(['trial_id' => 'required|exists:trials,id']);

        $scores = DiseaseScore::with(['genotype', 'evaluation.diseaseType', 'evaluation.environment.location'])
            ->whereHas('evaluation', fn($q) => $q->where('trial_id', $request->trial_id)->where('status', 'approved'))
            ->get();

        $summary = $scores
            ->groupBy('genotype_id')
            ->map(function ($genotypeScores, $genotypeId) {
                $genotype = $genotypeScores->first()->genotype;

                $byDisease = $genotypeScores->groupBy('evaluation.disease_type_id')
                    ->map(function ($diseaseScores) {
                        $avgIncidence = round($diseaseScores->avg('incidence_percent'), 2);
                        $avgSeverity = round($diseaseScores->avg('severity_score'), 2);
                        $disease = $diseaseScores->first()->evaluation?->diseaseType;

                        $resistance = $this->classifyResistance($avgSeverity, $avgIncidence);

                        return [
                            'disease_name' => $disease?->disease_name,
                            'disease_code' => $disease?->disease_code,
                            'n_evaluations' => $diseaseScores->count(),
                            'avg_incidence_percent' => $avgIncidence,
                            'avg_severity_score' => $avgSeverity,
                            'resistance_category' => $resistance,
                            'resistance_label' => $this->resistanceLabel($resistance),
                        ];
                    })->values();

                return [
                    'genotype_id' => $genotypeId,
                    'genotype_code' => $genotype?->genotype_code,
                    'genotype_name' => $genotype?->genotype_name,
                    'disease_resistance' => $byDisease,
                ];
            })->values();

        return response()->json($summary);
    }

    private function classifyResistance(float $severity, ?float $incidence = null): string
    {
        $score = $severity;
        if ($incidence !== null && $severity <= 9) {
            // Use severity score (1-9 IPTEK scale)
            if ($score <= 2) return 'tahan';
            if ($score <= 3.5) return 'agak_tahan';
            if ($score <= 5) return 'moderat';
            if ($score <= 7) return 'rentan';
            return 'sangat_rentan';
        }

        // Percentage-based
        if ($score <= 10) return 'tahan';
        if ($score <= 25) return 'agak_tahan';
        if ($score <= 50) return 'moderat';
        if ($score <= 75) return 'rentan';
        return 'sangat_rentan';
    }

    private function resistanceLabel(string $category): string
    {
        return match ($category) {
            'tahan' => 'Tahan (T)',
            'agak_tahan' => 'Agak Tahan (AT)',
            'moderat' => 'Moderat (M)',
            'rentan' => 'Rentan (R)',
            'sangat_rentan' => 'Sangat Rentan (SR)',
            default => $category,
        };
    }
}
