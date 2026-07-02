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
            'budget_name' => ['required', 'string'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'trial_id' => ['nullable', 'exists:trials,id'],
            'funding_source' => ['nullable', 'string'],
            'total_amount' => ['required', 'numeric', 'min:1'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['budget_code'] = 'BGT-' . date('Ym') . '-' . strtoupper(Str::random(6));
        $data['status'] = 'active';
        $data['created_by'] = $request->user()->id;
        $budget = Budget::create($data);
        AuditService::logCreated($budget);

        return response()->json($budget, 201);
    }

    public function budgetUpdate(Request $request, Budget $budget): JsonResponse
    {
        $data = $request->validate([
            'budget_name' => ['sometimes', 'string'],
            'funding_source' => ['nullable', 'string'],
            'total_amount' => ['sometimes', 'numeric', 'min:0'],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['sometimes', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $original = $budget->getAttributes();
        $budget->update($data);
        AuditService::logUpdated($budget, $original);

        return response()->json($budget);
    }

    public function budgetDestroy(Budget $budget): JsonResponse
    {
        if ($budget->expenses()->exists()) {
            return response()->json(['message' => 'Anggaran tidak dapat dihapus karena masih memiliki pengeluaran terkait.'], 422);
        }

        AuditService::logDeleted($budget);
        $budget->delete();

        return response()->json(['message' => 'Anggaran berhasil dihapus.']);
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

    /**
     * Batch create multiple expense rows from one form submission.
     * Shared fields (trial_id, payment_date, payment_method, receipt_urls, category_name)
     * are applied to all items; each item provides title, vendor, and amount.
     */
    public function batchStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_id' => ['nullable', 'exists:trials,id'],
            'budget_id' => ['nullable', 'exists:budgets,id'],
            'payment_date' => ['required', 'date'],
            'payment_method' => ['nullable', 'string'],
            'category_name' => ['nullable', 'string', 'max:100'],
            'receipt_urls' => ['nullable', 'array'],
            'receipt_urls.*' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.title' => ['required', 'string', 'max:255'],
            'items.*.vendor' => ['nullable', 'string', 'max:255'],
            'items.*.amount' => ['required', 'numeric', 'min:0'],
            'items.*.description' => ['nullable', 'string'],
        ]);

        // Resolve or create category — use explicit find+create to avoid NOT NULL on category_code
        $categoryId = null;
        if (!empty($data['category_name'])) {
            $category = ExpenseCategory::where('category_name', $data['category_name'])->first();
            if (!$category) {
                $category = ExpenseCategory::create([
                    'category_code' => 'CAT-' . strtoupper(Str::random(8)),
                    'category_name' => $data['category_name'],
                    'color' => '#6366f1',
                    'is_active' => true,
                ]);
            }
            $categoryId = $category->id;
        }

        $created = [];
        foreach ($data['items'] as $item) {
            $expense = Expense::create([
                'expense_code' => 'EXP-' . date('Ym') . '-' . strtoupper(Str::random(6)),
                'category_id' => $categoryId,
                'category_name_custom' => $data['category_name'] ?? null,
                'trial_id' => $data['trial_id'] ?? null,
                'budget_id' => $data['budget_id'] ?? null,
                'title' => $item['title'],
                'description' => $item['description'] ?? null,
                'amount' => $item['amount'],
                'payment_date' => $data['payment_date'],
                'vendor' => $item['vendor'] ?? null,
                'payment_method' => $data['payment_method'] ?? null,
                'attachments' => $data['receipt_urls'] ?? [],
                'submitted_by' => $request->user()->id,
                'approval_status' => 'pending',
            ]);
            AuditService::logCreated($expense);
            $created[] = $expense->id;
        }

        return response()->json([
            'message' => count($created) . ' pengeluaran berhasil dicatat.',
            'count' => count($created),
            'ids' => $created,
        ], 201);
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

    public function expenseDestroy(Expense $expense): JsonResponse
    {
        AuditService::logDeleted($expense);
        $expense->delete();

        return response()->json(['message' => 'Pengeluaran berhasil dihapus.']);
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
                'budget_name' => $b->budget_name,
                'total_amount' => $b->total_amount,
                'spent_amount' => $b->spent_amount,
                'remaining_amount' => $b->remaining_amount,
                'utilization_rate' => $b->utilization_rate,
            ]);

        return response()->json(compact('monthlyTotal', 'pendingCount', 'budgetUtilization'));
    }
}
