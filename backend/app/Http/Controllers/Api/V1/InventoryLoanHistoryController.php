<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InventoryLoanHistory;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryLoanHistoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = InventoryLoanHistory::with(['item', 'creator', 'returner'])
            ->whereNotNull('return_date')
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('borrower_name', 'ilike', "%{$request->search}%")
                  ->orWhere('item_name', 'ilike', "%{$request->search}%")
                  ->orWhere('lender_name', 'ilike', "%{$request->search}%")
                  ->orWhere('borrow_code', 'ilike', "%{$request->search}%");
            }))
            ->orderBy('return_date', 'desc');

        return response()->json($query->paginate($request->per_page ?? 50));
    }

    public function destroy(Request $request, InventoryLoanHistory $history): JsonResponse
    {
        if (!$request->user()->hasRole('super_admin')) {
            return response()->json(['message' => 'Hanya Super Admin yang dapat menghapus riwayat'], 403);
        }

        AuditService::logDeleted($history);
        $history->delete();
        return response()->json(['message' => 'Riwayat pinjam dihapus.']);
    }
}
