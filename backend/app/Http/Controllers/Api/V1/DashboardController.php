<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\FieldActivity;
use App\Models\Genotype;
use App\Models\PhenotypeObservation;
use App\Models\SeedInventory;
use App\Models\Trial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $stats = [
            'active_trials' => Trial::where('status', 'active')->count(),
            'total_genotypes' => Genotype::where('status', 'active')->count(),
            'total_seed_inventory' => SeedInventory::whereNotIn('storage_status', ['depleted', 'discarded'])->count(),
            'pending_phenotype_approvals' => PhenotypeObservation::where('status', 'submitted')->count(),
            'pending_expenses' => Expense::where('approval_status', 'pending')->count(),
            'recent_activities_count' => FieldActivity::where('activity_date', '>=', now()->subDays(7))->count(),
        ];

        $storage_alerts = [
            'low_stock' => SeedInventory::where('remaining_weight_g', '<=', 50)
                ->whereNotIn('storage_status', ['depleted', 'discarded'])->count(),
            'high_moisture' => SeedInventory::where('moisture_content', '>', 14)->count(),
            'expiring_soon' => SeedInventory::whereNotNull('expiry_date')
                ->where('expiry_date', '<=', now()->addDays(30))->count(),
        ];

        $recent_activities = FieldActivity::with(['user', 'trial', 'location'])
            ->orderBy('activity_date', 'desc')
            ->limit(5)
            ->get();

        $monthly_expenses = Expense::where('approval_status', 'approved')
            ->where('payment_date', '>=', now()->subMonths(6))
            ->selectRaw("TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as total")
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $trial_status_breakdown = Trial::selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $season_activity = FieldActivity::with('trial.season')
            ->where('activity_date', '>=', now()->subDays(30))
            ->selectRaw('activity_type, count(*) as count')
            ->groupBy('activity_type')
            ->orderBy('count', 'desc')
            ->get();

        return response()->json(compact(
            'stats', 'storage_alerts', 'recent_activities',
            'monthly_expenses', 'trial_status_breakdown', 'season_activity'
        ));
    }

    public function analytics(Request $request): JsonResponse
    {
        $trialId = $request->trial_id;

        $genotypePerformance = [];
        if ($trialId) {
            $genotypePerformance = PhenotypeObservation::with(['genotype', 'values.variable'])
                ->where('trial_id', $trialId)
                ->where('status', 'approved')
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
