<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\AuditService;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ExpenseController extends Controller
{
    public function __construct(private FileUploadService $fileUploadService) {}

    public function categoryIndex(): JsonResponse
    {
        return response()->json(ExpenseCategory::where('is_active', true)->orderBy('category_name')->get());
    }

    public function budgetIndex(Request $request): JsonResponse
    {
        $query = Budget::with(['season', 'trial', 'creator'])
            ->when($request->season_id, fn($q) => $q->where('season_id', $request->season_id))
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->when($request->status, fn($q) => $q->where('status', $request->status));

        return response()->json($query->orderBy('created_at', 'desc')->paginate(20));
    }

    public function budgetStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'budget_code' => ['required', 'string', 'unique:budgets'],
            'budget_name' => ['required', 'string'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'trial_id' => ['nullable', 'exists:trials,id'],
            'funding_source' => ['required', 'string'],
            'total_amount' => ['required', 'numeric', 'min:0'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['created_by'] = $request->user()->id;
        $budget = Budget::create($data);
        AuditService::logCreated($budget);

        return response()->json($budget, 201);
    }

    public function expenseIndex(Request $request): JsonResponse
    {
        $query = Expense::with(['category', 'trial', 'budget', 'submitter'])
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('title', 'ilike', "%{$request->search}%")
                  ->orWhere('expense_code', 'ilike', "%{$request->search}%");
            }))
            ->when($request->category_id, fn($q) => $q->where('category_id', $request->category_id))
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->when($request->approval_status, fn($q) => $q->where('approval_status', $request->approval_status))
            ->when($request->from_date, fn($q) => $q->where('payment_date', '>=', $request->from_date))
            ->when($request->to_date, fn($q) => $q->where('payment_date', '<=', $request->to_date));

        return response()->json($query->orderBy('payment_date', 'desc')->paginate($request->per_page ?? 20));
    }

    public function expenseStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'exists:expense_categories,id'],
            'budget_id' => ['nullable', 'exists:budgets,id'],
            'trial_id' => ['nullable', 'exists:trials,id'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'amount' => ['required', 'numeric', 'min:0'],
            'payment_date' => ['required', 'date'],
            'vendor' => ['nullable', 'string'],
            'vendor_contact' => ['nullable', 'string'],
            'funding_source' => ['nullable', 'string'],
            'payment_method' => ['nullable', 'string'],
            'reference_number' => ['nullable', 'string'],
            'attachments.*' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240'],
        ]);

        $data['expense_code'] = 'EXP-' . date('Ym') . '-' . strtoupper(Str::random(6));
        $data['submitted_by'] = $request->user()->id;
        $data['attachments'] = [];

        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $attachment = $this->fileUploadService->upload($file, 'expenses/receipts', null, 'receipt');
                $data['attachments'][] = $attachment->path;
            }
        }

        $expense = Expense::create($data);
        AuditService::logCreated($expense);

        return response()->json($expense->load(['category', 'submitter']), 201);
    }

    public function expenseShow(Expense $expense): JsonResponse
    {
        return response()->json($expense->load(['category', 'trial', 'budget', 'submitter', 'approver']));
    }

    public function expenseUpdate(Request $request, Expense $expense): JsonResponse
    {
        if ($expense->approval_status === 'approved') {
            return response()->json(['message' => 'Cannot edit an approved expense'], 422);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string'],
            'description' => ['nullable', 'string'],
            'amount' => ['sometimes', 'numeric'],
            'payment_date' => ['sometimes', 'date'],
            'vendor' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $original = $expense->getAttributes();
        $expense->update($data);
        AuditService::logUpdated($expense, $original);

        return response()->json($expense);
    }

    public function approveExpense(Request $request, Expense $expense): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:approved,rejected,revision_needed'],
            'approval_notes' => ['nullable', 'string'],
        ]);

        $expense->update([
            'approval_status' => $data['status'],
            'approval_notes' => $data['approval_notes'] ?? null,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        AuditService::logAction("expense_{$data['status']}", $expense);

        return response()->json($expense->load(['approver']));
    }

    public function monthlyReport(Request $request): JsonResponse
    {
        $year = $request->year ?? date('Y');

        $monthly = Expense::where('approval_status', 'approved')
            ->whereYear('payment_date', $year)
            ->selectRaw("DATE_TRUNC('month', payment_date) as month, SUM(amount) as total, COUNT(*) as count")
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $byCategory = Expense::with('category')
            ->where('approval_status', 'approved')
            ->whereYear('payment_date', $year)
            ->selectRaw('category_id, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('category_id')
            ->get();

        return response()->json(compact('monthly', 'byCategory'));
    }

    public function dashboard(): JsonResponse
    {
        $currentMonth = now()->format('Y-m');

        $monthlyTotal = Expense::where('approval_status', 'approved')
            ->whereRaw("TO_CHAR(payment_date, 'YYYY-MM') = ?", [$currentMonth])
            ->sum('amount');

        $pendingCount = Expense::where('approval_status', 'pending')->count();

        $budgetUtilization = Budget::where('status', 'active')
            ->with(['expenses' => fn($q) => $q->where('approval_status', 'approved')])
            ->get()
            ->map(fn($b) => [
                'id' => $b->id,
                'name' => $b->budget_name,
                'total' => $b->total_amount,
                'spent' => $b->spent_amount,
                'remaining' => $b->remaining_amount,
                'utilization' => $b->utilization_rate,
            ]);

        return response()->json(compact('monthlyTotal', 'pendingCount', 'budgetUtilization'));
    }
}
