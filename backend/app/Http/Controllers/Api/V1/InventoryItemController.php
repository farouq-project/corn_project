<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = InventoryItem::with('recorder')
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('name', 'ilike', "%{$request->search}%")
                  ->orWhere('category', 'ilike', "%{$request->search}%")
                  ->orWhere('borrower_name', 'ilike', "%{$request->search}%");
            }))
            ->when($request->condition, fn($q) => $q->where('condition', $request->condition))
            ->when($request->category, fn($q) => $q->where('category', $request->category))
            ->when($request->boolean('borrowed'), fn($q) => $q->whereNotNull('borrower_name'))
            ->orderBy('created_at', 'desc');

        return response()->json($query->paginate($request->per_page ?? 50));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'quantity' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'condition' => ['nullable', 'in:good,damaged,lost,maintenance'],
            'location' => ['nullable', 'string', 'max:255'],
            'product_photos' => ['nullable', 'array'],
            'product_photos.*' => ['nullable', 'string'],
            'borrower_name' => ['nullable', 'string', 'max:255'],
            'borrower_contact' => ['nullable', 'string', 'max:255'],
            'borrower_photos' => ['nullable', 'array'],
            'borrower_photos.*' => ['nullable', 'string'],
            'loan_date' => ['nullable', 'date'],
            'expected_return_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['recorded_by'] = $request->user()->id;
        $item = InventoryItem::create($data);
        AuditService::logCreated($item);

        return response()->json($item->load('recorder'), 201);
    }

    public function show(InventoryItem $inventoryItem): JsonResponse
    {
        return response()->json($inventoryItem->load('recorder'));
    }

    public function update(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'quantity' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'condition' => ['nullable', 'in:good,damaged,lost,maintenance'],
            'location' => ['nullable', 'string', 'max:255'],
            'product_photos' => ['nullable', 'array'],
            'product_photos.*' => ['nullable', 'string'],
            'borrower_name' => ['nullable', 'string', 'max:255'],
            'borrower_contact' => ['nullable', 'string', 'max:255'],
            'borrower_photos' => ['nullable', 'array'],
            'borrower_photos.*' => ['nullable', 'string'],
            'loan_date' => ['nullable', 'date'],
            'expected_return_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $original = $inventoryItem->getAttributes();
        $inventoryItem->update($data);
        AuditService::logUpdated($inventoryItem, $original);

        return response()->json($inventoryItem->load('recorder'));
    }

    public function destroy(InventoryItem $inventoryItem): JsonResponse
    {
        AuditService::logDeleted($inventoryItem);
        $inventoryItem->delete();
        return response()->json(['message' => 'Item dihapus.']);
    }

    public function bulkDestroy(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['integer']]);
        $count = InventoryItem::whereIn('id', $data['ids'])->delete();
        return response()->json(['message' => "{$count} item dihapus."]);
    }
}
