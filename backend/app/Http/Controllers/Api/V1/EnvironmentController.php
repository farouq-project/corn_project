<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Environment;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EnvironmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Environment::with(['location', 'season', 'creator'])
            ->when($request->trial_id, fn($q) => $q->whereHas('trials', fn($q) => $q->where('trials.id', $request->trial_id)))
            ->when($request->season_id, fn($q) => $q->where('season_id', $request->season_id))
            ->when($request->location_id, fn($q) => $q->where('location_id', $request->location_id));

        if ($request->boolean('all')) {
            return response()->json($query->get(['id', 'environment_code', 'location_id', 'season_id'])->map(fn($e) => [
                'id' => $e->id,
                'environment_code' => $e->environment_code,
                'name' => $e->name,
            ]));
        }

        return response()->json($query->withCount('plots')->orderBy('created_at', 'desc')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'location_id' => ['required', 'exists:locations,id'],
            'season_id' => ['required', 'exists:seasons,id'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'elevation_m' => ['nullable', 'integer'],
            'irrigation_type' => ['nullable', 'string'],
            'land_history' => ['nullable', 'string'],
            'soil_type' => ['nullable', 'string'],
            'total_rainfall_mm' => ['nullable', 'numeric'],
            'avg_temperature_c' => ['nullable', 'numeric'],
            'planting_date' => ['nullable', 'date'],
            'harvest_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        // Auto-generate environment code
        $location = \App\Models\Location::find($data['location_id']);
        $season = \App\Models\Season::find($data['season_id']);
        $data['environment_code'] = strtoupper(
            substr($location->field_code, 0, 4) . '-' . substr($season->season_code, 0, 6)
        );

        // Ensure uniqueness
        $count = Environment::where('environment_code', 'like', $data['environment_code'] . '%')->count();
        if ($count > 0) {
            $data['environment_code'] .= '-' . ($count + 1);
        }

        $data['created_by'] = $request->user()->id;

        $environment = Environment::create($data);
        AuditService::logCreated($environment);

        return response()->json($environment->load(['location', 'season']), 201);
    }

    public function show(Environment $environment): JsonResponse
    {
        return response()->json($environment->load([
            'location', 'season', 'blocks', 'soilAnalyses', 'layout',
        ])->loadCount(['plots', 'plotObservations', 'diseaseEvaluations']));
    }

    public function update(Request $request, Environment $environment): JsonResponse
    {
        $data = $request->validate([
            'irrigation_type' => ['nullable', 'string'],
            'land_history' => ['nullable', 'string'],
            'soil_type' => ['nullable', 'string'],
            'total_rainfall_mm' => ['nullable', 'numeric'],
            'avg_temperature_c' => ['nullable', 'numeric'],
            'avg_humidity_percent' => ['nullable', 'numeric'],
            'planting_date' => ['nullable', 'date'],
            'harvest_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $original = $environment->getAttributes();
        $environment->update($data);
        AuditService::logUpdated($environment, $original);

        return response()->json($environment->load(['location', 'season']));
    }

    public function destroy(Environment $environment): JsonResponse
    {
        if ($environment->observationRecords()->exists()) {
            return response()->json([
                'message' => 'Environment tidak dapat dihapus karena memiliki data pengamatan.',
            ], 422);
        }

        AuditService::logDeleted($environment);
        $environment->delete();

        return response()->json(['message' => 'Environment berhasil dihapus.']);
    }

    public function soilAnalyses(Environment $environment): JsonResponse
    {
        return response()->json($environment->soilAnalyses()->orderBy('sample_date', 'desc')->get());
    }

    public function storeSoilAnalysis(Request $request, Environment $environment): JsonResponse
    {
        $data = $request->validate([
            'sample_date' => ['required', 'date'],
            'sample_depth_cm' => ['nullable', 'string'],
            'lab_name' => ['nullable', 'string'],
            'ph_h2o' => ['nullable', 'numeric', 'min:0', 'max:14'],
            'ph_kcl' => ['nullable', 'numeric', 'min:0', 'max:14'],
            'organic_c_percent' => ['nullable', 'numeric', 'min:0'],
            'organic_matter_percent' => ['nullable', 'numeric', 'min:0'],
            'total_n_percent' => ['nullable', 'numeric', 'min:0'],
            'available_p_ppm' => ['nullable', 'numeric', 'min:0'],
            'available_k_ppm' => ['nullable', 'numeric', 'min:0'],
            'sand_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'silt_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'clay_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'texture_class' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['environment_id'] = $environment->id;
        $data['recorded_by'] = $request->user()->id;

        $analysis = $environment->soilAnalyses()->create($data);
        return response()->json($analysis, 201);
    }
}
