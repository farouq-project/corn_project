<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EnvironmentCondition;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnvironmentConditionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = EnvironmentCondition::query()
            ->when($request->boolean('active_only'), fn($q) => $q->where('is_active', true))
            ->when($request->search, fn($q) => $q->where('name', 'ilike', "%{$request->search}%"));

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:environment_conditions,name'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $condition = EnvironmentCondition::create($data);
        AuditService::logCreated($condition);

        return response()->json($condition, 201);
    }

    public function update(Request $request, EnvironmentCondition $environmentCondition): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100', 'unique:environment_conditions,name,' . $environmentCondition->id],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $original = $environmentCondition->getAttributes();
        $environmentCondition->update($data);
        AuditService::logUpdated($environmentCondition, $original);

        return response()->json($environmentCondition);
    }

    public function destroy(EnvironmentCondition $environmentCondition): JsonResponse
    {
        AuditService::logDeleted($environmentCondition);
        $environmentCondition->delete();

        return response()->json(['message' => 'Environment dihapus.']);
    }
}
