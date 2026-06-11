<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Characteristic;
use App\Models\Environment;
use App\Models\FieldActivity;
use App\Models\Genotype;
use App\Models\ObservationRecord;
use App\Models\PhenotypeObservation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Simplified dashboard for the active data-collection phase: just the
     * core record counts researchers need plus recent activity.
     */
    public function index(Request $request): JsonResponse
    {
        $stats = [
            'total_genotypes' => Genotype::where('status', 'active')->count(),
            'total_environments' => Environment::count(),
            'total_observation_records' => ObservationRecord::count(),
            'total_characteristics' => Characteristic::active()->count(),
        ];

        $recent_activities = FieldActivity::with(['user', 'trial', 'location'])
            ->orderBy('activity_date', 'desc')
            ->limit(5)
            ->get();

        return response()->json(compact('stats', 'recent_activities'));
    }

    public function analytics(Request $request): JsonResponse
    {
        $trialId = $request->trial_id;

        $genotypePerformance = [];
        if ($trialId) {
            $genotypePerformance = PhenotypeObservation::with(['genotype', 'values.variable'])
                ->where('trial_id', $trialId)
                ->where('status', 'approved')
                ->limit(1000)
                ->get()
                ->groupBy('genotype.genotype_code')
                ->map(fn($obs) => [
                    'name' => $obs->first()->genotype?->genotype_name,
                    'observation_count' => $obs->count(),
                ]);
        }

        return response()->json(compact('genotypePerformance'));
    }
}
