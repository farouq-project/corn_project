<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SeedInventory;
use App\Models\SeedMovement;
use App\Models\StorageReading;
use App\Models\StorageUnit;
use App\Services\AuditService;
use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StorageController extends Controller
{
    public function __construct(private StorageService $storageService) {}

    // Storage Units
    public function unitIndex(Request $request): JsonResponse
    {
        $query = StorageUnit::query()
            ->when($request->search, fn($q) => $q->where('unit_name', 'ilike', "%{$request->search}%"))
            ->when($request->unit_type, fn($q) => $q->where('unit_type', $request->unit_type))
            ->when(isset($request->is_active), fn($q) => $q->where('is_active', $request->boolean('is_active')));

        if ($request->boolean('all')) {
            return response()->json($query->where('is_active', true)->get(['id', 'unit_code', 'unit_name', 'unit_type']));
        }

        return response()->json($query->with('latestReading')->withCount([
            'seedInventories as active_inventory_count' => fn($q) => $q->whereNotIn('storage_status', ['depleted', 'discarded'])
        ])->paginate($request->per_page ?? 20));
    }

    public function unitStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'unit_code' => ['required', 'string', 'max:20', 'unique:storage_units'],
            'unit_name' => ['required', 'string', 'max:255'],
            'unit_type' => ['required', 'in:refrigerator,freezer,cold_room,dry_room,cabinet,shelf'],
            'room_name' => ['nullable', 'string'],
            'building' => ['nullable', 'string'],
            'temperature_min' => ['nullable', 'numeric'],
            'temperature_max' => ['nullable', 'numeric'],
            'humidity_min' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'humidity_max' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'capacity_racks' => ['nullable', 'integer', 'min:1'],
            'capacity_boxes_per_rack' => ['nullable', 'integer', 'min:1'],
            'description' => ['nullable', 'string'],
        ]);

        $data['created_by'] = $request->user()->id;
        $unit = StorageUnit::create($data);
        AuditService::logCreated($unit);

        return response()->json($unit, 201);
    }

    public function unitShow(StorageUnit $unit): JsonResponse
    {
        return response()->json($unit->load(['latestReading', 'creator'])->append(['occupancy_rate']));
    }

    public function unitUpdate(Request $request, StorageUnit $unit): JsonResponse
    {
        $data = $request->validate([
            'unit_name' => ['sometimes', 'string'],
            'unit_type' => ['sometimes', 'in:refrigerator,freezer,cold_room,dry_room,cabinet,shelf'],
            'room_name' => ['nullable', 'string'],
            'building' => ['nullable', 'string'],
            'temperature_min' => ['nullable', 'numeric'],
            'temperature_max' => ['nullable', 'numeric'],
            'humidity_min' => ['nullable', 'numeric'],
            'humidity_max' => ['nullable', 'numeric'],
            'capacity_racks' => ['nullable', 'integer'],
            'capacity_boxes_per_rack' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ]);

        $original = $unit->getAttributes();
        $unit->update($data);
        AuditService::logUpdated($unit, $original);

        return response()->json($unit);
    }

    // Seed Inventories
    public function inventoryIndex(Request $request): JsonResponse
    {
        $query = SeedInventory::with(['genotype', 'storageUnit', 'season'])
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('package_code', 'ilike', "%{$request->search}%")
                  ->orWhereHas('genotype', fn($q) => $q->where('genotype_name', 'ilike', "%{$request->search}%"));
            }))
            ->when($request->genotype_id, fn($q) => $q->where('genotype_id', $request->genotype_id))
            ->when($request->storage_unit_id, fn($q) => $q->where('storage_unit_id', $request->storage_unit_id))
            ->when($request->storage_status, fn($q) => $q->where('storage_status', $request->storage_status))
            ->when($request->low_stock, fn($q) => $q->where('remaining_weight_g', '<=', 50));

        return response()->json($query->orderBy('storage_date', 'desc')->paginate($request->per_page ?? 20));
    }

    public function inventoryStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'genotype_id' => ['required', 'exists:genotypes,id'],
            'storage_unit_id' => ['required', 'exists:storage_units,id'],
            'rack_label' => ['nullable', 'string', 'max:20'],
            'box_number' => ['nullable', 'string', 'max:20'],
            'row_position' => ['nullable', 'string', 'max:10'],
            'column_position' => ['nullable', 'string', 'max:10'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'source_trial_id' => ['nullable', 'exists:trials,id'],
            'harvest_date' => ['nullable', 'date'],
            'storage_date' => ['required', 'date'],
            'expiry_date' => ['nullable', 'date', 'after:storage_date'],
            'initial_weight_g' => ['required', 'numeric', 'min:0.01'],
            'remaining_weight_g' => ['required', 'numeric', 'min:0'],
            'moisture_content' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'germination_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'germination_test_date' => ['nullable', 'date'],
            'vigor_index' => ['nullable', 'numeric'],
            'seed_count' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['created_by'] = $request->user()->id;
        $inventory = $this->storageService->createInventory($data);

        return response()->json($inventory, 201);
    }

    public function inventoryShow(SeedInventory $inventory): JsonResponse
    {
        return response()->json($inventory->load(['genotype', 'storageUnit', 'season', 'sourceTrial', 'movements.performer'])
            ->append(['usage_percentage', 'storage_age']));
    }

    public function inventoryUpdate(Request $request, SeedInventory $inventory): JsonResponse
    {
        $data = $request->validate([
            'rack_label' => ['nullable', 'string'],
            'box_number' => ['nullable', 'string'],
            'row_position' => ['nullable', 'string'],
            'column_position' => ['nullable', 'string'],
            'storage_unit_id' => ['sometimes', 'exists:storage_units,id'],
            'expiry_date' => ['nullable', 'date'],
            'moisture_content' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'germination_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'germination_test_date' => ['nullable', 'date'],
            'vigor_index' => ['nullable', 'numeric'],
            'storage_status' => ['in:good,warning,critical,expired,depleted,discarded'],
            'notes' => ['nullable', 'string'],
        ]);

        $original = $inventory->getAttributes();
        $inventory->update($data);
        AuditService::logUpdated($inventory, $original);

        return response()->json($inventory->load(['genotype', 'storageUnit']));
    }

    public function recordMovement(Request $request, SeedInventory $inventory): JsonResponse
    {
        $data = $request->validate([
            'movement_type' => ['required', 'in:in_initial,in_transfer,in_return,out_planting,out_laboratory,out_distribution,out_discard,out_damage,adjustment'],
            'quantity_g' => ['required', 'numeric', 'min:0.01'],
            'to_storage_unit_id' => ['nullable', 'exists:storage_units,id'],
            'related_trial_id' => ['nullable', 'exists:trials,id'],
            'destination' => ['nullable', 'string'],
            'recipient_name' => ['nullable', 'string'],
            'movement_date' => ['required', 'date'],
            'reason' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        if (!str_starts_with($data['movement_type'], 'in_') && $data['quantity_g'] > $inventory->remaining_weight_g) {
            return response()->json(['message' => 'Insufficient seed weight'], 422);
        }

        $data['performed_by'] = $request->user()->id;
        $data['from_storage_unit_id'] = $inventory->storage_unit_id;

        $movement = $this->storageService->recordMovement($inventory, $data);

        return response()->json($movement, 201);
    }

    public function movementIndex(Request $request, SeedInventory $inventory): JsonResponse
    {
        return response()->json(
            $inventory->movements()->with(['performer', 'relatedTrial'])->orderBy('movement_date', 'desc')->paginate(20)
        );
    }

    public function recordReading(Request $request, StorageUnit $unit): JsonResponse
    {
        $data = $request->validate([
            'temperature' => ['nullable', 'numeric'],
            'humidity' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'reading_time' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['storage_unit_id'] = $unit->id;
        $data['source'] = 'manual';
        $data['recorded_by'] = $request->user()->id;

        $status = 'normal';
        if ($unit->temperature_max && $data['temperature'] > $unit->temperature_max) $status = 'warning';
        if ($unit->humidity_max && $data['humidity'] > $unit->humidity_max) $status = 'warning';
        $data['status'] = $status;

        $reading = StorageReading::create($data);

        return response()->json($reading, 201);
    }

    public function readingHistory(Request $request, StorageUnit $unit): JsonResponse
    {
        $readings = $unit->storageReadings()
            ->when($request->from, fn($q) => $q->where('reading_time', '>=', $request->from))
            ->when($request->to, fn($q) => $q->where('reading_time', '<=', $request->to))
            ->orderBy('reading_time', 'desc')
            ->paginate(50);

        return response()->json($readings);
    }

    public function dashboard(): JsonResponse
    {
        return response()->json($this->storageService->getDashboardStats());
    }

    public function lookupByQr(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);

        $inventory = SeedInventory::where('qr_code', $request->code)
            ->orWhere('barcode', $request->code)
            ->orWhere('package_code', $request->code)
            ->with(['genotype', 'storageUnit'])
            ->first();

        if (!$inventory) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json($inventory);
    }
}
