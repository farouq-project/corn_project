<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryLoanHistory;
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
            'notes' => ['nullable', 'string'],
        ]);

        $original = $inventoryItem->getAttributes();
        $inventoryItem->update($data);
        AuditService::logUpdated($inventoryItem, $original);

        return response()->json($inventoryItem->load('recorder'));
    }

    public function borrow(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        if ($inventoryItem->borrower_name) {
            return response()->json(['message' => 'Item sedang dipinjam oleh orang lain'], 422);
        }

        $data = $request->validate([
            'borrower_name' => ['required', 'string', 'max:255'],
            'lender_name' => ['nullable', 'string', 'max:255'],
            'borrower_contact' => ['required', 'string', 'max:255'],
            'borrow_quantity' => ['required', 'integer', 'min:1'],
            'loan_date' => ['nullable', 'date'],
            'expected_return_date' => ['required', 'date'],
            'borrower_photos' => ['required', 'array', 'min:1'],
            'borrower_photos.*' => ['string'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($data['borrow_quantity'] > (int) $inventoryItem->quantity) {
            return response()->json(['message' => 'Jumlah pinjam melebihi stok tersedia (' . (int) $inventoryItem->quantity . ')'], 422);
        }

        // Extract borrow code from notes
        $borrowCode = null;
        if (!empty($data['notes'])) {
            preg_match('/PJM-\d{8}-[A-Z0-9]+/', $data['notes'], $matches);
            $borrowCode = $matches[0] ?? null;
        }

        $original = $inventoryItem->getAttributes();
        $inventoryItem->update([
            'borrower_name' => $data['borrower_name'],
            'lender_name' => $data['lender_name'] ?? null,
            'borrower_contact' => $data['borrower_contact'],
            'borrow_quantity' => $data['borrow_quantity'],
            'borrower_photos' => $data['borrower_photos'],
            'loan_date' => $data['loan_date'] ?? null,
            'expected_return_date' => $data['expected_return_date'],
            'notes' => $data['notes'] ?? null,
            'quantity' => $inventoryItem->quantity - $data['borrow_quantity'],
        ]);

        InventoryLoanHistory::create([
            'inventory_item_id' => $inventoryItem->id,
            'item_name' => $inventoryItem->name,
            'borrow_code' => $borrowCode,
            'borrower_name' => $data['borrower_name'],
            'lender_name' => $data['lender_name'] ?? null,
            'borrower_contact' => $data['borrower_contact'],
            'borrow_quantity' => $data['borrow_quantity'],
            'loan_date' => $data['loan_date'] ?? null,
            'expected_return_date' => $data['expected_return_date'],
            'borrower_photos' => $data['borrower_photos'],
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        AuditService::logUpdated($inventoryItem, $original);
        return response()->json($inventoryItem->load('recorder'));
    }

    public function confirmReturn(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        if (!$inventoryItem->borrower_name) {
            return response()->json(['message' => 'Item tidak sedang dipinjam'], 422);
        }

        $data = $request->validate([
            'returned_quantity' => ['required', 'integer', 'min:1'],
            'condition' => ['nullable', 'in:good,damaged,lost,maintenance'],
            'return_photos' => ['nullable', 'array'],
            'return_photos.*' => ['string'],
            'notes' => ['nullable', 'string'],
        ]);

        $original = $inventoryItem->getAttributes();
        $inventoryItem->update([
            'borrower_name' => null,
            'lender_name' => null,
            'borrower_contact' => null,
            'borrow_quantity' => null,
            'borrower_photos' => [],
            'loan_date' => null,
            'expected_return_date' => null,
            'condition' => $data['condition'] ?? 'good',
            'quantity' => $inventoryItem->quantity + $data['returned_quantity'],
        ]);

        $history = InventoryLoanHistory::where('inventory_item_id', $inventoryItem->id)
            ->whereNull('return_date')
            ->latest()
            ->first();

        if ($history) {
            $history->update([
                'return_date' => now()->toDateString(),
                'returned_quantity' => $data['returned_quantity'],
                'condition_on_return' => $data['condition'] ?? 'good',
                'return_photos' => $data['return_photos'] ?? null,
                'notes' => $data['notes'] ?? $history->notes,
                'returned_by' => $request->user()->id,
            ]);
        }

        AuditService::logUpdated($inventoryItem, $original);
        return response()->json($inventoryItem->load('recorder'));
    }

    public function deleteBorrow(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        if (!$request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Hanya Super Admin yang dapat melakukan ini'], 403);
        }

        if (!$inventoryItem->borrower_name) {
            return response()->json(['message' => 'Item tidak sedang dipinjam'], 422);
        }

        $borrowQty = $inventoryItem->borrow_quantity ?? 0;
        $original = $inventoryItem->getAttributes();

        $inventoryItem->update([
            'borrower_name' => null,
            'lender_name' => null,
            'borrower_contact' => null,
            'borrow_quantity' => null,
            'borrower_photos' => [],
            'loan_date' => null,
            'expected_return_date' => null,
            'quantity' => $inventoryItem->quantity + $borrowQty,
        ]);

        InventoryLoanHistory::where('inventory_item_id', $inventoryItem->id)
            ->whereNull('return_date')
            ->latest()
            ->first()
            ?->delete();

        AuditService::logUpdated($inventoryItem, $original);
        return response()->json(['message' => 'Log pinjam dihapus dan stok dipulihkan.']);
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
