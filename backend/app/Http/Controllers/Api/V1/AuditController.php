<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with('user')
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->event, fn($q) => $q->where('event', $request->event))
            ->when($request->auditable_type, fn($q) => $q->where('auditable_type', $request->auditable_type))
            ->when($request->from_date, fn($q) => $q->where('created_at', '>=', $request->from_date))
            ->when($request->to_date, fn($q) => $q->where('created_at', '<=', $request->to_date . ' 23:59:59'));

        return response()->json($query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 30));
    }

    public function show(AuditLog $auditLog): JsonResponse
    {
        return response()->json($auditLog->load('user'));
    }

    public function modelHistory(Request $request): JsonResponse
    {
        $request->validate([
            'model' => 'required|string',
            'id' => 'required|integer',
        ]);

        $history = AuditLog::with('user')
            ->where('auditable_type', $request->model)
            ->where('auditable_id', $request->id)
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($history);
    }
}
