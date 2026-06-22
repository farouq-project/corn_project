"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, TrendingUp, CheckCircle2, XCircle, Clock, X, Edit2, Upload, Trash2, Camera } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/axios";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Expense, Budget } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { getApiErrorMessage } from "@/lib/axios";
import { formatDate, formatCurrency, cn } from "@/lib/utils";

// ── Predefined categories + localStorage memory ─────────────────────────────

const PRESET_CATEGORIES = [
  "Honorarium", "Analisis Data", "Bahan", "Pengumpulan Data",
  "Sewa Peralatan", "Pelaporan Hasil Penelitian dan Luaran Wajib",
];

function useCategoryMemory() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("finance_categories") ?? "[]")); } catch {}
  }, []);
  const remember = (v: string) => {
    if (!v || PRESET_CATEGORIES.includes(v) || saved.includes(v)) return;
    const next = [v, ...saved].slice(0, 20);
    setSaved(next);
    localStorage.setItem("finance_categories", JSON.stringify(next));
  };
  return { suggestions: [...PRESET_CATEGORIES, ...saved.filter(s => !PRESET_CATEGORIES.includes(s))], remember };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ExpenseRow { title: string; vendor: string; amount: string; description: string; }

const budgetSchema = z.object({
  budget_name: z.string().min(1, "Nama anggaran wajib diisi"),
  funding_source: z.string().optional(),
  total_amount: z.preprocess(Number, z.number().min(1, "Jumlah anggaran wajib diisi")),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
});
type BudgetForm = z.infer<typeof budgetSchema>;

const toOptionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<"expenses" | "budgets">("expenses");
  const [trialFilter, setTrialFilter] = useState<string>("");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const queryClient = useQueryClient();
  const { suggestions: categorySuggestions, remember: rememberCategory } = useCategoryMemory();

  // Multi-row expense form state
  const [trialId, setTrialId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [receiptUrls, setReceiptUrls] = useState<string[]>([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [rows, setRows] = useState<ExpenseRow[]>([{ title: "", vendor: "", amount: "", description: "" }]);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const budgetForm = useForm<BudgetForm>({ resolver: zodResolver(budgetSchema) as never });

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: financeDashboard } = useQuery({
    queryKey: ["finance-dashboard"],
    queryFn: () => api.get("/v1/finance/dashboard").then(r => r.data as { monthlyTotal: number; pendingCount: number; budgetUtilization: Budget[] }),
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses", trialFilter],
    queryFn: () => api.get<{ data: Expense[] }>("/v1/finance/expenses", {
      params: { per_page: 100, ...(trialFilter ? { trial_id: trialFilter } : {}) },
    }).then(r => r.data),
  });

  const { data: budgetsData } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => api.get<{ data: Budget[] }>("/v1/finance/budgets", { params: { per_page: 50 } }).then(r => r.data),
  });

  const { data: trialsData } = useQuery({
    queryKey: ["trials-simple"],
    queryFn: () => api.get("/v1/trials?all=true").then(r => r.data as Array<{ id: number; trial_code: string; trial_name: string }>),
  });

  const expenses = expensesData?.data ?? [];
  const budgets = budgetsData?.data ?? [];
  const trials = trialsData ?? [];

  // ── Spend per trial (for money meter) ─────────────────────────────────────

  const trialSpend = trials.reduce<Record<number, number>>((acc, t) => {
    acc[t.id] = expenses.filter(e => (e.trial as { id?: number })?.id === t.id || (e as Expense & { trial_id?: number }).trial_id === t.id).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {});

  // ── Mutations ──────────────────────────────────────────────────────────────

  const batchMutation = useMutation({
    mutationFn: (payload: object) => api.post("/v1/finance/expenses/batch", payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      toast.success((res.data as { message?: string })?.message ?? "Pengeluaran berhasil dicatat");
      closeExpenseModal();
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      api.post(`/v1/finance/expenses/${id}/approve`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }); toast.success("Status diperbarui"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data: BudgetForm) => api.post("/v1/finance/budgets", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Anggaran dibuat"); setIsBudgetModalOpen(false); budgetForm.reset(); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BudgetForm> }) => api.put(`/v1/finance/budgets/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Anggaran diperbarui"); setIsBudgetModalOpen(false); setEditingBudget(null); budgetForm.reset(); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  // ── Receipt upload ─────────────────────────────────────────────────────────

  const handleReceiptUpload = async (file: File) => {
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "receipts");
      const res = await api.post<{ url: string }>("/v1/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setReceiptUrls(prev => [...prev, res.data.url]);
      toast.success("Foto bukti diunggah");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploadingReceipt(false);
    }
  };

  // ── Form helpers ───────────────────────────────────────────────────────────

  const addRow = () => setRows(r => [...r, { title: "", vendor: "", amount: "", description: "" }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof ExpenseRow, value: string) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  const closeExpenseModal = () => {
    setIsExpenseModalOpen(false);
    setRows([{ title: "", vendor: "", amount: "", description: "" }]);
    setReceiptUrls([]);
    setCategoryName("");
    setTrialId(trialFilter);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("");
  };

  const submitExpenses = () => {
    const validRows = rows.filter(r => r.title.trim() && r.amount && Number(r.amount) > 0);
    if (validRows.length === 0) { toast.error("Tambahkan minimal satu baris dengan judul dan jumlah"); return; }
    if (!paymentDate) { toast.error("Tanggal pembayaran wajib diisi"); return; }
    if (categoryName) rememberCategory(categoryName);
    batchMutation.mutate({
      trial_id: trialId || null,
      payment_date: paymentDate,
      payment_method: paymentMethod || null,
      category_name: categoryName || null,
      receipt_urls: receiptUrls,
      items: validRows.map(r => ({ title: r.title.trim(), vendor: r.vendor.trim() || null, amount: Number(r.amount), description: r.description.trim() || null })),
    });
  };

  // ── Columns ────────────────────────────────────────────────────────────────

  const expenseColumns: ColumnDef<Expense, unknown>[] = [
    {
      header: "Detail",
      accessorKey: "title",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.title}</p>
          {(row.original as Expense & { vendor?: string }).vendor && (
            <p className="text-xs text-gray-400">{(row.original as Expense & { vendor?: string }).vendor}</p>
          )}
        </div>
      ),
    },
    {
      header: "Kategori",
      id: "cat",
      cell: ({ row }) => {
        const cat = row.original.category;
        const custom = (row.original as Expense & { category_name_custom?: string }).category_name_custom;
        const label = cat?.category_name ?? custom ?? "—";
        const color = cat?.color ?? "#6366f1";
        return <span className="inline-flex text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "20", color }}>{label}</span>;
      },
    },
    {
      header: "Research Plan",
      id: "trial",
      cell: ({ row }) => <span className="text-xs">{row.original.trial?.trial_code ?? "—"}</span>,
    },
    {
      header: "Jumlah",
      accessorKey: "amount",
      cell: ({ getValue }) => <span className="font-semibold">{formatCurrency(getValue() as number)}</span>,
    },
    {
      header: "Tanggal",
      accessorKey: "payment_date",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{formatDate(getValue() as string)}</span>,
    },
    {
      header: "Bukti",
      id: "receipt",
      cell: ({ row }) => {
        const attachments = row.original.attachments as string[] | undefined;
        if (!attachments?.length) return <span className="text-gray-300 text-xs">—</span>;
        return (
          <div className="flex gap-1">
            {attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded border border-gray-200 overflow-hidden flex items-center justify-center hover:opacity-80 transition">
                {url.match(/\.(jpg|jpeg|png|webp)$/i)
                  ? <img src={url} alt="receipt" className="w-full h-full object-cover" />
                  : <Camera className="w-4 h-4 text-gray-400" />}
              </a>
            ))}
          </div>
        );
      },
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
          {row.original.approval_status === "pending" && (
            <>
              <button onClick={() => approveMutation.mutate({ id: row.original.id, status: "approved" })} className="p-1.5 rounded hover:bg-green-50 text-green-500 transition" title="Setujui"><CheckCircle2 className="w-4 h-4" /></button>
              <button onClick={() => approveMutation.mutate({ id: row.original.id, status: "rejected" })} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition" title="Tolak"><XCircle className="w-4 h-4" /></button>
            </>
          )}
        </div>
      ),
    },
  ];

  const totalApproved = expenses.filter(e => e.approval_status === "approved").reduce((s, e) => s + e.amount, 0);
  const totalPending = expenses.filter(e => e.approval_status === "pending").length;
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  const openEditBudget = (b: Budget) => {
    setEditingBudget(b);
    budgetForm.reset({ budget_name: b.budget_name, funding_source: b.funding_source ?? "", total_amount: b.total_amount, start_date: b.start_date ?? "", end_date: b.end_date ?? "" });
    setIsBudgetModalOpen(true);
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Keuangan & Anggaran"
        description="Kelola pengeluaran penelitian dan monitoring anggaran per Research Plan"
        actions={
          <button onClick={() => { setTrialId(trialFilter); setIsExpenseModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" /> Catat Pengeluaran
          </button>
        }
      />

      {/* Research Plan filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600 flex-shrink-0">Filter Research Plan:</label>
        <select value={trialFilter} onChange={e => setTrialFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-auto">
          <option value="">Semua Research Plan</option>
          {trials.map(t => <option key={t.id} value={t.id}>{t.trial_code} — {t.trial_name}</option>)}
        </select>
        {trialFilter && <button onClick={() => setTrialFilter("")} className="text-xs text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
      </div>

      {/* Money meter per Research Plan */}
      {trialFilter && (() => {
        const trial = trials.find(t => String(t.id) === trialFilter);
        const spent = trialSpend[Number(trialFilter)] ?? 0;
        const budget = budgets.find(b => (b as Budget & { trial_id?: number }).trial_id === Number(trialFilter));
        const total = budget?.total_amount ?? 0;
        const pct = total > 0 ? Math.min(100, (spent / total) * 100) : null;
        return trial ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-800">{trial.trial_name}</p>
                <p className="text-xs text-gray-400 font-mono">{trial.trial_code}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(spent)}</p>
                {total > 0 && <p className="text-xs text-gray-400">dari {formatCurrency(total)}</p>}
              </div>
            </div>
            {pct !== null && (
              <>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500")}
                    style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{pct.toFixed(1)}% anggaran terpakai</p>
              </>
            )}
          </div>
        ) : null;
      })()}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-gray-500">Total Pengeluaran</p><p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalAmount)}</p></div>
            <div className="p-2.5 rounded-lg bg-blue-50"><Wallet className="w-5 h-5 text-blue-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-gray-500">Disetujui</p><p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalApproved)}</p></div>
            <div className="p-2.5 rounded-lg bg-green-50"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-gray-500">Menunggu Persetujuan</p><p className="text-2xl font-bold text-orange-600 mt-1">{totalPending} transaksi</p></div>
            <div className="p-2.5 rounded-lg bg-orange-50"><Clock className="w-5 h-5 text-orange-600" /></div>
          </div>
        </div>
      </div>

      {/* Budget utilization bars */}
      {(financeDashboard?.budgetUtilization ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" /> Utilisasi Anggaran
          </h2>
          <div className="space-y-3">
            {financeDashboard?.budgetUtilization?.map(budget => (
              <div key={budget.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{budget.budget_name}</span>
                  <span className="text-gray-500">
                    {formatCurrency(budget.spent_amount ?? 0)} / {formatCurrency(budget.total_amount)}
                    <span className="ml-2 font-semibold text-gray-700">({budget.utilization_rate}%)</span>
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full">
                  <div className={cn("h-full rounded-full transition-all", (budget.utilization_rate ?? 0) > 90 ? "bg-red-500" : (budget.utilization_rate ?? 0) > 70 ? "bg-yellow-500" : "bg-green-500")}
                    style={{ width: `${Math.min(100, budget.utilization_rate ?? 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(["expenses", "budgets"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("px-6 py-3.5 text-sm font-medium transition", activeTab === tab ? "text-green-700 border-b-2 border-green-600 bg-green-50/50" : "text-gray-500 hover:text-gray-700")}>
              {tab === "expenses" ? "Daftar Pengeluaran" : "Manajemen Anggaran"}
            </button>
          ))}
        </div>
        <div className="p-6">
          {activeTab === "expenses" && (
            <DataTable data={expenses} columns={expenseColumns} isLoading={expensesLoading}
              searchPlaceholder="Cari pengeluaran..." emptyMessage="Belum ada pengeluaran" />
          )}
          {activeTab === "budgets" && (
            <>
              <div className="flex justify-end mb-4">
                <button onClick={() => { setEditingBudget(null); budgetForm.reset(); setIsBudgetModalOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
                  <Plus className="w-4 h-4" /> Buat Anggaran
                </button>
              </div>
              <DataTable data={budgets} isLoading={false} emptyMessage="Belum ada anggaran"
                columns={[
                  { header: "Kode", accessorKey: "budget_code", cell: ({ getValue }) => <span className="font-mono text-xs font-semibold text-blue-700">{getValue() as string}</span> },
                  { header: "Nama Anggaran", accessorKey: "budget_name" },
                  { header: "Sumber Dana", accessorKey: "funding_source" },
                  { header: "Total", accessorKey: "total_amount", cell: ({ getValue }) => <span className="font-semibold">{formatCurrency(getValue() as number)}</span> },
                  { header: "Masa Berlaku", id: "period", cell: ({ row }) => <span className="text-xs">{formatDate(row.original.start_date)} – {formatDate(row.original.end_date)}</span> },
                  { header: "Status", accessorKey: "status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
                  { header: "Aksi", id: "budgetAct", cell: ({ row }) => <button onClick={() => openEditBudget(row.original)} className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600"><Edit2 className="w-3.5 h-3.5" /></button> },
                ]} />
            </>
          )}
        </div>
      </div>

      {/* ── Expense Modal (multi-row) ─────────────────────────────────────── */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold">Catat Pengeluaran</h3>
              <button onClick={closeExpenseModal} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">

              {/* Shared header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Research Plan <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
                  <select value={trialId} onChange={e => setTrialId(e.target.value)} className={inputCls}>
                    <option value="">-- Pilih Research Plan --</option>
                    {trials.map(t => <option key={t.id} value={t.id}>{t.trial_code} — {t.trial_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pembayaran *</label>
                  <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
                  <input
                    list="cat-suggestions"
                    value={categoryName}
                    onChange={e => setCategoryName(e.target.value)}
                    placeholder="Ketik atau pilih kategori..."
                    className={inputCls}
                  />
                  <datalist id="cat-suggestions">
                    {categorySuggestions.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
                    <option value="">-- Pilih --</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="cash">Tunai</option>
                    <option value="check">Cek/Giro</option>
                    <option value="card">Kartu</option>
                  </select>
                </div>
              </div>

              {/* Receipt photo upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Foto Bukti / Kwitansi</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {receiptUrls.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg border border-gray-200 overflow-hidden group">
                      {url.match(/\.(jpg|jpeg|png|webp)$/i)
                        ? <img src={url} alt="receipt" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-gray-50"><Camera className="w-6 h-6 text-gray-400" /></div>}
                      <button onClick={() => setReceiptUrls(p => p.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => receiptInputRef.current?.click()} disabled={uploadingReceipt}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-600 transition disabled:opacity-50 text-xs gap-1">
                    <Upload className="w-5 h-5" />
                    {uploadingReceipt ? "..." : "Upload"}
                  </button>
                  <input ref={receiptInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f); e.target.value = ""; }} />
                </div>
              </div>

              {/* Multi-row table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Daftar Pengeluaran</label>
                  <button type="button" onClick={addRow}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded-lg hover:bg-green-50 transition">
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-[38%]">Detail Pengeluaran *</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-[30%]">Vendor/Penyedia</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-[22%]">Jumlah (Rp) *</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-2 py-1.5">
                            <input value={row.title} onChange={e => updateRow(i, "title", e.target.value)}
                              placeholder="Nama/deskripsi pengeluaran"
                              className="w-full px-2 py-1.5 border border-transparent rounded focus:border-green-300 focus:outline-none text-sm bg-transparent focus:bg-white hover:bg-white/60" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={row.vendor} onChange={e => updateRow(i, "vendor", e.target.value)}
                              placeholder="Opsional"
                              className="w-full px-2 py-1.5 border border-transparent rounded focus:border-green-300 focus:outline-none text-sm bg-transparent focus:bg-white hover:bg-white/60" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={row.amount} onChange={e => updateRow(i, "amount", e.target.value)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 border border-transparent rounded focus:border-green-300 focus:outline-none text-sm bg-transparent focus:bg-white hover:bg-white/60 text-right" />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {rows.length > 1 && (
                              <button type="button" onClick={() => removeRow(i)} className="p-1 text-gray-300 hover:text-red-400 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-600">Total ({rows.filter(r => r.amount).length} item)</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                          {formatCurrency(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeExpenseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="button" onClick={submitExpenses} disabled={batchMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {batchMutation.isPending ? "Menyimpan..." : "Catat Pengeluaran"}
                </button>
              </div>
            </div>
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
            <form onSubmit={budgetForm.handleSubmit(d => editingBudget ? updateBudgetMutation.mutate({ id: editingBudget.id, data: d }) : createBudgetMutation.mutate(d))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Anggaran *</label>
                <input {...budgetForm.register("budget_name")} className={inputCls} placeholder="Anggaran Penelitian MH2026" />
                {budgetForm.formState.errors.budget_name && <p className="text-red-500 text-xs mt-1">{budgetForm.formState.errors.budget_name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sumber Dana</label>
                  <input {...budgetForm.register("funding_source")} className={inputCls} placeholder="DIPA UNPAD 2026" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Anggaran (Rp) *</label>
                  <input {...budgetForm.register("total_amount")} type="number" min="1" className={inputCls} />
                  {budgetForm.formState.errors.total_amount && <p className="text-red-500 text-xs mt-1">{budgetForm.formState.errors.total_amount.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mulai *</label>
                  <input {...budgetForm.register("start_date")} type="date" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Berakhir *</label>
                  <input {...budgetForm.register("end_date")} type="date" className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsBudgetModalOpen(false); setEditingBudget(null); budgetForm.reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {createBudgetMutation.isPending || updateBudgetMutation.isPending ? "Menyimpan..." : editingBudget ? "Simpan" : "Buat Anggaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
