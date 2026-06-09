<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Environment;
use App\Models\Trial;
use App\Models\TrialEnvironment;
use App\Models\TrialPlot;
use App\Services\AuditService;
use App\Services\RcbdService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrialPlotController extends Controller
{
    public function __construct(private RcbdService $rcbdService) {}

    /**
     * Generate RCBD plot structure for a trial × environment.
     */
    public function generateRcbd(Request $request, Trial $trial): JsonResponse
    {
        $data = $request->validate([
            'environment_id' => ['required', 'exists:environments,id'],
            'replications' => ['required', 'integer', 'min:1', 'max:10'],
            'seed' => ['nullable', 'integer'],
            'plot_length_m' => ['nullable', 'numeric'],
            'plot_width_m' => ['nullable', 'numeric'],
            'plant_spacing_cm' => ['nullable', 'numeric'],
            'row_spacing_cm' => ['nullable', 'numeric'],
        ]);

        $environment = Environment::findOrFail($data['environment_id']);

        // Check for existing plots
        $existingCount = TrialPlot::where('trial_id', $trial->id)
            ->where('environment_id', $environment->id)
            ->count();

        if ($existingCount > 0) {
            return response()->json([
                'message' => "This trial already has {$existingCount} plots for this environment. Delete them first to regenerate.",
            ], 422);
        }

        // Ensure trial-environment link exists
        TrialEnvironment::firstOrCreate(
            ['trial_id' => $trial->id, 'environment_id' => $environment->id],
            ['status' => 'planned']
        );

        // Build genotype list from trial_genotypes
        $genotypes = $trial->genotypes()->orderBy('pivot_entry_number')->get()
            ->map(fn($g) => [
                'genotype_id' => $g->id,
                'entry_number' => $g->pivot->entry_number ?? $g->id,
                'is_check' => (bool) $g->pivot->is_check,
            ])->toArray();

        if (empty($genotypes)) {
            return response()->json([
                'message' => 'No genotypes assigned to this trial. Assign genotypes first.',
            ], 422);
        }

        $result = $this->rcbdService->generateRcbd(
            $trial,
            $environment,
            $genotypes,
            $data['replications'],
            [
                'length' => $data['plot_length_m'] ?? null,
                'width' => $data['plot_width_m'] ?? null,
                'plant_spacing' => $data['plant_spacing_cm'] ?? null,
                'row_spacing' => $data['row_spacing_cm'] ?? null,
            ],
            $data['seed'] ?? 0
        );

        AuditService::logAction('rcbd_generated', $trial, [
            'environment_id' => $environment->id,
            'plots_created' => $result['total_plots'],
            'seed' => $result['seed'],
        ]);

        return response()->json([
            'message' => $result['summary'],
            'total_plots' => $result['total_plots'],
            'seed' => $result['seed'],
            'blocks' => count($result['blocks']),
            'layout' => $result['layout'],
        ], 201);
    }

    /**
     * Get plot matrix (blocks × entries) for visualization.
     */
    public function matrix(Request $request, Trial $trial): JsonResponse
    {
        $request->validate(['environment_id' => 'required|exists:environments,id']);
        $environment = Environment::findOrFail($request->environment_id);

        $matrix = $this->rcbdService->getPlotMatrix($trial, $environment);

        return response()->json([
            'environment' => $environment->load(['location', 'season']),
            'blocks' => $matrix,
            'layout' => $trial->layouts()->where('environment_id', $environment->id)->first(),
        ]);
    }

    /**
     * List all plots for a trial (optionally filtered by environment).
     */
    public function index(Request $request, Trial $trial): JsonResponse
    {
        $plots = TrialPlot::with(['genotype', 'block', 'environment.location', 'environment.season'])
            ->where('trial_id', $trial->id)
            ->when($request->environment_id, fn($q) => $q->where('environment_id', $request->environment_id))
            ->when($request->genotype_id, fn($q) => $q->where('genotype_id', $request->genotype_id))
            ->orderBy('environment_id')
            ->orderBy('trial_block_id')
            ->orderBy('randomization_order')
            ->get();

        return response()->json($plots);
    }

    public function show(TrialPlot $plot): JsonResponse
    {
        return response()->json($plot->load([
            'genotype', 'block', 'environment.location', 'environment.season',
            'observations' => fn($q) => $q->orderBy('observation_date', 'desc'),
            'diseaseScores.evaluation.diseaseType',
        ]));
    }

    public function checkBalance(Trial $trial): JsonResponse
    {
        return response()->json($this->rcbdService->checkDesignBalance($trial));
    }

    public function destroyByEnvironment(Request $request, Trial $trial): JsonResponse
    {
        $request->validate(['environment_id' => 'required|exists:environments,id']);

        $deleted = TrialPlot::where('trial_id', $trial->id)
            ->where('environment_id', $request->environment_id)
            ->delete();

        // Also delete blocks
        \App\Models\TrialBlock::where('trial_id', $trial->id)
            ->where('environment_id', $request->environment_id)
            ->delete();

        return response()->json(['message' => "{$deleted} plots deleted."]);
    }
}
