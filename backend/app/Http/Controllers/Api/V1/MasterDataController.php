<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\Season;
use App\Models\TrialType;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MasterDataController extends Controller
{
    // Seasons
    public function seasonIndex(Request $request): JsonResponse
    {
        $query = Season::query()
            ->when($request->status, fn($q) => $q->where('status', $request->status));

        if ($request->boolean('all')) {
            return response()->json($query->orderBy('start_date', 'desc')->get(['id', 'season_code', 'season_name', 'status']));
        }

        return response()->json($query->with('creator')->orderBy('start_date', 'desc')->paginate(20));
    }

    public function seasonStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'season_code' => ['required', 'string', 'max:20', 'unique:seasons'],
            'season_name' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'description' => ['nullable', 'string'],
            'status' => ['in:upcoming,active,completed,cancelled'],
        ]);

        $data['created_by'] = $request->user()->id;
        $season = Season::create($data);
        AuditService::logCreated($season);

        return response()->json($season, 201);
    }

    public function seasonUpdate(Request $request, Season $season): JsonResponse
    {
        $data = $request->validate([
            'season_name' => ['sometimes', 'string'],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['sometimes', 'date'],
            'description' => ['nullable', 'string'],
            'status' => ['in:upcoming,active,completed,cancelled'],
        ]);

        $season->update($data);
        return response()->json($season);
    }

    public function seasonDestroy(Season $season): JsonResponse
    {
        $season->delete();
        return response()->json(null, 204);
    }

    // Locations
    public function locationIndex(Request $request): JsonResponse
    {
        $query = Location::query()
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('field_name', 'ilike', "%{$request->search}%")
                  ->orWhere('province', 'ilike', "%{$request->search}%");
            }))
            ->when($request->province, fn($q) => $q->where('province', $request->province));

        if ($request->boolean('all')) {
            return response()->json($query->where('is_active', true)->orderBy('field_name')->get(['id', 'field_code', 'field_name', 'province']));
        }

        return response()->json($query->with('creator')->orderBy('field_name')->paginate(20));
    }

    public function locationStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'field_code' => ['required', 'string', 'max:20', 'unique:locations'],
            'field_name' => ['required', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'altitude' => ['nullable', 'numeric'],
            'area_hectares' => ['nullable', 'numeric', 'min:0'],
            'village' => ['nullable', 'string'],
            'district' => ['nullable', 'string'],
            'regency' => ['nullable', 'string'],
            'province' => ['required', 'string'],
            'soil_type' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        $data['created_by'] = $request->user()->id;
        $location = Location::create($data);
        AuditService::logCreated($location);

        return response()->json($location, 201);
    }

    public function locationUpdate(Request $request, Location $location): JsonResponse
    {
        $data = $request->validate([
            'field_name' => ['sometimes', 'string'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'altitude' => ['nullable', 'numeric'],
            'area_hectares' => ['nullable', 'numeric'],
            'village' => ['nullable', 'string'],
            'district' => ['nullable', 'string'],
            'regency' => ['nullable', 'string'],
            'province' => ['sometimes', 'string'],
            'soil_type' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        $location->update($data);
        return response()->json($location);
    }

    public function locationDestroy(Location $location): JsonResponse
    {
        $location->delete();
        return response()->json(null, 204);
    }

    // Trial Types
    public function trialTypeIndex(): JsonResponse
    {
        return response()->json(TrialType::where('is_active', true)->orderBy('type_name')->get());
    }

    public function trialTypeStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type_code' => ['required', 'string', 'unique:trial_types'],
            'type_name' => ['required', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        return response()->json(TrialType::create($data), 201);
    }
}
