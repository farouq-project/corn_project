<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Characteristic;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacteristicController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Characteristic::query()
            ->when($request->boolean('active_only'), fn($q) => $q->active())
            ->when($request->filled('group'), fn($q) => $q->where('group', $request->group));

        return response()->json($query->ordered()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:characteristics,code'],
            'name' => ['required', 'string', 'max:255'],
            'unit' => ['nullable', 'string', 'max:20'],
            'group' => ['nullable', 'string', 'max:50'],
            'display_order' => ['nullable', 'integer'],
            'decimal_places' => ['nullable', 'integer', 'min:0', 'max:6'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $characteristic = Characteristic::create($data);

        AuditService::logCreated($characteristic);

        return response()->json($characteristic, 201);
    }

    public function update(Request $request, Characteristic $characteristic): JsonResponse
    {
        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:20', 'unique:characteristics,code,' . $characteristic->id],
            'name' => ['sometimes', 'string', 'max:255'],
            'unit' => ['nullable', 'string', 'max:20'],
            'group' => ['nullable', 'string', 'max:50'],
            'display_order' => ['nullable', 'integer'],
            'decimal_places' => ['nullable', 'integer', 'min:0', 'max:6'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $original = $characteristic->getOriginal();
        $characteristic->update($data);

        AuditService::logUpdated($characteristic, $original);

        return response()->json($characteristic);
    }

    public function destroy(Characteristic $characteristic): JsonResponse
    {
        if ($characteristic->values()->exists()) {
            $characteristic->update(['is_active' => false]);

            AuditService::logAction('deactivated', $characteristic);

            return response()->json([
                'message' => 'Characteristic is in use and was deactivated instead of deleted.',
                'data' => $characteristic,
            ]);
        }

        AuditService::logDeleted($characteristic);
        $characteristic->delete();

        return response()->json(['message' => 'Characteristic deleted.']);
    }
}
