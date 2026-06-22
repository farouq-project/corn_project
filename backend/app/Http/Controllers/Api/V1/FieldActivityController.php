<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FieldActivity;
use App\Services\AuditService;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FieldActivityController extends Controller
{
    public function __construct(private FileUploadService $fileUploadService) {}

    public function index(Request $request): JsonResponse
    {
        $query = FieldActivity::with(['user', 'trial', 'location', 'genotype'])
            ->when($request->search, fn($q) => $q->where('activity_title', 'ilike', "%{$request->search}%"))
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->when($request->location_id, fn($q) => $q->where('location_id', $request->location_id))
            ->when($request->activity_type, fn($q) => $q->where('activity_type', $request->activity_type))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->from_date, fn($q) => $q->where('activity_date', '>=', $request->from_date))
            ->when($request->to_date, fn($q) => $q->where('activity_date', '<=', $request->to_date));

        if ($request->boolean('timeline')) {
            return response()->json($query->orderBy('activity_date', 'desc')->limit(50)->get());
        }

        return response()->json($query->orderBy('activity_date', 'desc')->paginate($request->per_page ?? 20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_id' => ['nullable', 'exists:trials,id'],
            'location_id' => ['nullable', 'exists:locations,id'],
            'genotype_id' => ['nullable', 'exists:genotypes,id'],
            'activity_type' => ['required', 'in:planting,pollination,fertilizer_application,irrigation,pesticide_application,harvesting,drone_flight,disease_observation,sampling,soil_preparation,thinning,weeding,monitoring,logbook,other'],
            'photo_urls' => ['nullable', 'array'],
            'photo_urls.*' => ['nullable', 'string'],
            'activity_title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'activity_date' => ['required', 'date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'materials_used' => ['nullable', 'array'],
            'weather_conditions' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
            'photos.*' => ['nullable', 'image', 'max:5120'],
        ]);

        $data['activity_code'] = 'ACT-' . date('Ymd') . '-' . strtoupper(Str::random(6));
        $data['user_id'] = $request->user()->id;

        // Accept pre-uploaded photo URLs (from /v1/media/upload) or multipart file uploads
        $data['photos'] = $data['photo_urls'] ?? [];
        unset($data['photo_urls']);

        if ($request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $attachment = $this->fileUploadService->upload($photo, 'activities/photos', null, 'activity_photo');
                $data['photos'][] = $attachment->path;
            }
        }

        $activity = FieldActivity::create($data);
        AuditService::logCreated($activity);

        return response()->json($activity->load(['user', 'trial', 'location']), 201);
    }

    public function show(FieldActivity $activity): JsonResponse
    {
        return response()->json($activity->load(['user', 'trial', 'location', 'genotype', 'approver']));
    }

    public function update(Request $request, FieldActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'activity_title' => ['sometimes', 'string'],
            'description' => ['nullable', 'string'],
            'activity_date' => ['sometimes', 'date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'materials_used' => ['nullable', 'array'],
            'weather_conditions' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
        ]);

        $original = $activity->getAttributes();
        $activity->update($data);
        AuditService::logUpdated($activity, $original);

        return response()->json($activity);
    }

    public function destroy(FieldActivity $activity): JsonResponse
    {
        AuditService::logDeleted($activity);
        $activity->delete();
        return response()->json(null, 204);
    }

    public function approve(Request $request, FieldActivity $activity): JsonResponse
    {
        $activity->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return response()->json($activity);
    }
}
