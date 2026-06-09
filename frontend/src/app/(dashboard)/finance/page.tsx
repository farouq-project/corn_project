"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, TrendingUp, CheckCircle2, XCircle, Clock, X, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/axios";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Expense, ExpenseCategory, Budget } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { getApiErrorMessage } from "@/lib/axios";
import { formatDate, formatCurrency, cn } from "@/lib/utils";

const toOptionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

const expenseSchema = z.object({
  category_id: z.preprocess(Number, z.number().min(1, "Pilih kategori")),
  budget_id: z.preprocess(toOptionalNumber, z.number().optional()),
  trial_id: z.preprocess(toOptionalNumber, z.number().optional()),
  title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().optional(),
  amount: z.preprocess(Number, z.number().min(1, "Jumlah wajib diisi")),
  payment_date: z.string().min(1, "Tanggal wajib diisi"),
  vendor: z.string().optional(),
  payment_method: z.string().optional(),
  reference_number: z.string().optional(),
});

const budgetSchema = z.object({
  budget_name: z.string().min(1, "Nama anggaran wajib diisi"),
  funding_source: z.string().optional(),
  total_amount: z.preprocess(Number, z.number().min(1, "Jumlah anggaran wajib diisi")),
  start_date: z.string().min(1, "Tanggal mulai wajib diisi"),
  end_date: z.string().min(1, "Tanggal berakhir wajib diisi"),
});

type ExpenseForm = z.infer<typeof expenseSchema>;
type BudgetForm = z.infer<typeof budgetSchema>;

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<"expenses" | "budgets">("expenses");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const queryClient = useQueryClient();

  const { data: financeDashboard } = useQuery({
    queryKey: ["finance-dashboard"],
    queryFn: () => api.get("/v1/finance/dashboard").then((r) => r.data as { monthlyTotal: number; pendingCount: number; budgetUtilization: Budget[] }),
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.get<{ data: Expense[] }>("/v1/finance/expenses", { params: { per_page: 50 } }).then((r) => r.data),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => api.get<ExpenseCategory[]>("/v1/finance/categories").then((r) => r.data),
  });

  const { data: budgetsData } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => api.get<{ data: Budget[] }>("/v1/finance/budgets", { params: { per_page: 50 } }).then((r) => r.data),
  });

  const { data: trials } = useQuery({
    queryKey: ["trials-simple"],
    queryFn: () => api.get("/v1/trials?all=true").then((r) => r.data as Array<{ id: number; trial_code: string; trial_name: string }>),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema) as never,
    defaultValues: { payment_date: new Date().toISOString().slice(0, 10) },
  });

  const budgetForm = useForm<BudgetForm>({
    resolver: zodResolver(budgetSchema) as never,
  });

  const createMutation = useMutation({
    mutationFn: (data: ExpenseForm) => api.post("/v1/finance/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      toast.success("Pengeluaran berhasil dicatat");
      setIsExpenseModalOpen(false);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      api.post(`/v1/finance/expenses/${id}/approve`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      toast.success("Status pengeluaran diperbarui");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ExpenseForm> }) =>
      api.put(`/v1/finance/expenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      toast.success("Pengeluaran diperbarui");
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    reset({
      category_id: exp.category?.id ?? 0,
      trial_id: exp.trial?.id ?? undefined,
      budget_id: exp.budget?.id ?? undefined,
      title: exp.title,
      description: exp.description ?? "",
      amount: exp.amount,
      payment_date: exp.payment_date,
      vendor: exp.vendor ?? "",
      payment_method: exp.payment_method ?? "",
      reference_number: exp.reference_number ?? "",
    });
    setIsExpenseModalOpen(true);
  };

  const createBudgetMutation = useMutation({
    mutationFn: (data: BudgetForm) => api.post("/v1/finance/budgets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      toast.success("Anggaran dibuat");
      setIsBudgetModalOpen(false);
      setEditingBudget(null);
      budgetForm.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BudgetForm> }) =>
      api.put(`/v1/finance/budgets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      toast.success("Anggaran diperbarui");
      setIsBudgetModalOpen(false);
      setEditingBudget(null);
      budgetForm.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEditBudget = (b: Budget) => {
    setEditingBudget(b);
    budgetForm.reset({
      budget_name: b.budget_name,
      funding_source: b.funding_source ?? "",
      total_amount: b.total_amount,
      start_date: b.start_date ?? "",
      end_date: b.end_date ?? "",
    });
    setIsBudgetModalOpen(true);
  };

  const expenses = expensesData?.data ?? [];
  const budgets = budgetsData?.data ?? [];
  const categories = (categoriesData as unknown as ExpenseCategory[]) ?? [];

  const expenseColumns: ColumnDef<Expense, unknown>[] = [
    {
      header: "Kode",
      accessorKey: "expense_code",
      cell: ({ getValue }) => <span className="font-mono text-xs font-semibold text-blue-700">{getValue() as string}</span>,
    },
    {
      header: "Judul",
      accessorKey: "title",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.title}</p>
          {row.original.vendor && <p className="text-xs text-gray-400">{row.original.vendor}</p>}
        </div>
      ),
    },
    {
      header: "Kategori",
      accessorKey: "category.category_name",
      cell: ({ row }) => {
        const cat = row.original.category;
        return cat ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.color + "20", color: cat.color }}>
            {cat.category_name}
          </span>
        ) : <span className="text-gray-300">-</span>;
      },
    },
    {
      header: "Jumlah",
      accessorKey: "amount",
      cell: ({ getValue }) => <span className="font-semibold text-gray-900">{formatCurrency(getValue() as number)}</span>,
    },
    {
      header: "Tanggal",
      accessorKey: "payment_date",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{formatDate(getValue() as string)}</span>,
    },
    {
      header: "Status",
      accessorKey: "approval_status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      header: "Aksi",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.approval_status !== "approved" && (
            <button onClick={() => openEditExpense(row.original)} className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600 transition" title="Edit">
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {row.original.approval_status === "pending" && (
            <>
              <button onClick={() => approveMutation.mutate({ id: row.original.id, status: "approved" })} className="p-1.5 rounded hover:bg-green-50 text-green-500 transition" title="Setujui">
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button onClick={() => approveMutation.mutate({ id: row.original.id, status: "rejected" })} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition" title="Tolak">
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const totalApproved = expenses.filter((e) => e.approval_status === "approved").reduce((s, e) => s + e.amount, 0);
  const totalPending = expenses.filter((e) => e.approval_status === "pending").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Keuangan & Anggaran"
        description="Kelola pengeluaran penelitian dan monitoring anggaran"
        actions={
          <button onClick={() => setIsExpenseModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Catat Pengeluaran
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Pengeluaran Bulan Ini</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(financeDashboard?.monthlyTotal ?? 0)}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50"><Wallet className="w-5 h-5 text-blue-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Disetujui</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalApproved)}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-green-50"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Menunggu Persetujuan</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{totalPending} transaksi</p>
            </div>
            <div className="p-2.5 rounded-lg bg-orange-50"><Clock className="w-5 h-5 text-orange-600" /></div>
          </div>
        </div>
      </div>

      {/* Budget Utilization */}
      {(financeDashboard?.budgetUtilization ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Utilisasi Anggaran
          </h2>
          <div className="space-y-3">
            {financeDashboard?.budgetUtilization?.map((budget) => (
              <div key={budget.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{budget.budget_name}</span>
                  <span className="text-gray-500">
                    {formatCurrency(budget.spent_amount ?? 0)} / {formatCurrency(budget.total_amount)}
                    <span className="ml-2 font-semibold text-gray-700">({budget.utilization_rate}%)</span>
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full">
                  <div
                    className={cn("h-full rounded-full transition-all", (budget.utilization_rate ?? 0) > 90 ? "bg-red-500" : (budget.utilization_rate ?? 0) > 70 ? "bg-yellow-500" : "bg-green-500")}
                    style={{ width: `${Math.min(100, budget.utilization_rate ?? 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(["expenses", "budgets"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-6 py-3.5 text-sm font-medium transition", activeTab === tab ? "text-green-700 border-b-2 border-green-600 bg-green-50/50" : "text-gray-500 hover:text-gray-700")}>
              {tab === "expenses" ? "Daftar Pengeluaran" : "Manajemen Anggaran"}
            </button>
          ))}
        </div>
        <div className="p-6">
          {activeTab === "expenses" && (
            <DataTable
              data={expenses}
              columns={expenseColumns}
              isLoading={expensesLoading}
              searchPlaceholder="Cari pengeluaran..."
              emptyMessage="Belum ada pengeluaran"
            />
          )}
          {activeTab === "budgets" && (
            <>
              <div className="flex justify-end mb-4">
                <button onClick={() => { setEditingBudget(null); budgetForm.reset(); setIsBudgetModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
                  <Plus className="w-4 h-4" /> Buat Anggaran
                </button>
              </div>
              <DataTable
                data={budgets}
                columns={[
                  { header: "Kode", accessorKey: "budget_code", cell: ({ getValue }) => <span className="font-mono text-xs font-semibold text-blue-700">{getValue() as string}</span> },
                  { header: "Nama Anggaran", accessorKey: "budget_name" },
                  { header: "Sumber Dana", accessorKey: "funding_source" },
                  { header: "Total", accessorKey: "total_amount", cell: ({ getValue }) => <span className="font-semibold">{formatCurrency(getValue() as number)}</span> },
                  { header: "Masa Berlaku", id: "period", cell: ({ row }) => <span className="text-xs">{formatDate(row.original.start_date)} - {formatDate(row.original.end_date)}</span> },
                  { header: "Status", accessorKey: "status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
                  {
                    header: "Aksi",
                    id: "budget_actions",
                    cell: ({ row }) => (
                      <button onClick={() => openEditBudget(row.original)} className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600 transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    ),
                  },
                ]}
                isLoading={false}
                emptyMessage="Belum ada anggaran"
              />
            </>
          )}
        </div>
      </div>

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingExpense ? "Edit Pengeluaran" : "Catat Pengeluaran"}</h3>
              <button onClick={() => { setIsExpenseModalOpen(false); setEditingExpense(null); reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => {
              const data = d as ExpenseForm;
              if (editingExpense) updateExpenseMutation.mutate({ id: editingExpense.id, data });
              else createMutation.mutate(data);
            })} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                  <select {...register("category_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                  </select>
                  {errors.category_id && <p className="text-red-500 text-xs mt-1">{errors.category_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trial (opsional)</label>
                  <select {...register("trial_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Trial --</option>
                    {trials?.map((t) => <option key={t.id} value={t.id}>{t.trial_code}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Pengeluaran *</label>
                <input {...register("title")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Deskripsi singkat pengeluaran" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp) *</label>
                  <input {...register("amount")} type="number" min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0" />
                  {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pembayaran *</label>
                  <input {...register("payment_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor/Penyedia</label>
                  <input {...register("vendor")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Nama vendor" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                  <select {...register("payment_method")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih --</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="cash">Tunai</option>
                    <option value="check">Cek/Giro</option>
                    <option value="card">Kartu</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                <textarea {...register("description")} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="Keterangan tambahan..." />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsExpenseModalOpen(false); setEditingExpense(null); reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateExpenseMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {(isSubmitting || createMutation.isPending || updateExpenseMutation.isPending) ? "Menyimpan..." : editingExpense ? "Simpan Perubahan" : "Catat Pengeluaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingBudget ? "Edit Anggaran" : "Buat Anggaran Baru"}</h3>
              <button onClick={() => { setIsBudgetModalOpen(false); setEditingBudget(null); budgetForm.reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={budgetForm.handleSubmit((d) => {
              const data = d as BudgetForm;
              if (editingBudget) updateBudgetMutation.mutate({ id: editingBudget.id, data });
              else createBudgetMutation.mutate(data);
            })} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Anggaran *</label>
                <input {...budgetForm.register("budget_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. Anggaran Penelitian MH2026" />
                {budgetForm.formState.errors.budget_name && <p className="text-red-500 text-xs mt-1">{budgetForm.formState.errors.budget_name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sumber Dana</label>
                  <input {...budgetForm.register("funding_source")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. DIPA UNPAD 2026" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Anggaran (Rp) *</label>
                  <input {...budgetForm.register("total_amount")} type="number" min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0" />
                  {budgetForm.formState.errors.total_amount && <p className="text-red-500 text-xs mt-1">{budgetForm.formState.errors.total_amount.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai *</label>
                  <input {...budgetForm.register("start_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  {budgetForm.formState.errors.start_date && <p className="text-red-500 text-xs mt-1">{budgetForm.formState.errors.start_date.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Berakhir *</label>
                  <input {...budgetForm.register("end_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  {budgetForm.formState.errors.end_date && <p className="text-red-500 text-xs mt-1">{budgetForm.formState.errors.end_date.message}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsBudgetModalOpen(false); setEditingBudget(null); budgetForm.reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {(createBudgetMutation.isPending || updateBudgetMutation.isPending) ? "Menyimpan..." : editingBudget ? "Simpan Perubahan" : "Buat Anggaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
