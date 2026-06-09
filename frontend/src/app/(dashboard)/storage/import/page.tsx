"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Download, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, RefreshCw, Loader2, FileSpreadsheet,
  RotateCcw, Eye, ArrowLeft, Info, Copy
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/lib/axios";
import { formatDateTime, cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Batch {
  id: number;
  batch_code: string;
  import_type: "seed_inventory" | "storage_unit";
  original_filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warning_rows: number;
  duplicate_rows: number;
  imported_rows: number;
  status: string;
  status_message?: string;
  is_rolled_back: boolean;
  uploader?: { name: string };
  created_at: string;
}

interface StagingRow {
  id: number;
  row_number: number;
  raw_package_code?: string;
  raw_genotype_code?: string;
  raw_storage_unit_code?: string;
  raw_storage_date?: string;
  raw_initial_weight_g?: string;
  raw_remaining_weight_g?: string;
  raw_moisture_content?: string;
  raw_storage_status?: string;
  norm_package_code?: string;
  norm_genotype_code?: string;
  norm_storage_date?: string;
  norm_initial_weight_g?: number;
  validation_status: "pending" | "valid" | "warning" | "invalid" | "duplicate";
  validation_errors?: Array<{ field: string; rule: string; message: string }>;
  validation_warnings?: Array<{ field: string; rule: string; message: string }>;
  import_status: "pending" | "imported" | "skipped" | "failed";
}

// ── Status badges ─────────────────────────────────────────────────────────────
const VALIDATION_BADGE: Record<string, { label: string; cls: string }> = {
  valid: { label: "Valid", cls: "bg-green-100 text-green-800" },
  warning: { label: "Peringatan", cls: "bg-yellow-100 text-yellow-800" },
  invalid: { label: "Tidak Valid", cls: "bg-red-100 text-red-800" },
  duplicate: { label: "Duplikat", cls: "bg-orange-100 text-orange-800" },
  pending: { label: "Menunggu", cls: "bg-gray-100 text-gray-600" },
};

const IMPORT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-gray-100 text-gray-600" },
  imported: { label: "Diimport", cls: "bg-green-100 text-green-700" },
  skipped: { label: "Dilewati", cls: "bg-gray-100 text-gray-500" },
  failed: { label: "Gagal", cls: "bg-red-100 text-red-700" },
};

const BATCH_STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-50 border-blue-200 text-blue-700",
  parsing: "bg-blue-50 border-blue-200 text-blue-700",
  parsed: "bg-yellow-50 border-yellow-200 text-yellow-700",
  validating: "bg-yellow-50 border-yellow-200 text-yellow-700",
  validated: "bg-indigo-50 border-indigo-200 text-indigo-700",
  confirmed: "bg-purple-50 border-purple-200 text-purple-700",
  importing: "bg-purple-50 border-purple-200 text-purple-700",
  completed: "bg-green-50 border-green-200 text-green-700",
  partial: "bg-orange-50 border-orange-200 text-orange-700",
  failed: "bg-red-50 border-red-200 text-red-700",
  rolled_back: "bg-gray-50 border-gray-200 text-gray-500",
};

const BATCH_STATUS_LABELS: Record<string, string> = {
  uploaded: "File Diupload", parsing: "Parsing...", parsed: "Terparsing",
  validating: "Validasi...", validated: "Tervalidasi", confirmed: "Dikonfirmasi",
  importing: "Mengimport...", completed: "Selesai", partial: "Sebagian",
  failed: "Gagal", rolled_back: "Di-rollback",
};

// ── Pipeline Steps ────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { id: 1, label: "Upload File", statuses: ["uploaded", "parsing", "parsed"] },
  { id: 2, label: "Validasi", statuses: ["validating", "validated"] },
  { id: 3, label: "Preview & Review", statuses: ["validated"] },
  { id: 4, label: "Konfirmasi Import", statuses: ["importing", "completed", "partial"] },
];

export default function StorageImportPage() {
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  const [previewFilter, setPreviewFilter] = useState<string>("");
  const [selectedImportType, setSelectedImportType] = useState<"seed_inventory" | "storage_unit">("seed_inventory");
  const [skippedRows, setSkippedRows] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch batch list
  const { data: batchList, isLoading: batchListLoading } = useQuery({
    queryKey: ["import-batches"],
    queryFn: () => api.get<{ data: Batch[] }>("/v1/import/batches", { params: { per_page: 20 } }).then(r => r.data),
  });

  // Active batch detail
  const { data: activeBatch } = useQuery({
    queryKey: ["import-batch", activeBatchId],
    queryFn: () => api.get<Batch>(`/v1/import/batches/${activeBatchId}`).then(r => r.data),
    enabled: !!activeBatchId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return ["parsing", "validating", "importing"].includes(status ?? "") ? 2000 : false;
    },
  });

  // Preview rows
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ["import-preview", activeBatchId, previewFilter],
    queryFn: () => api.get(`/v1/import/batches/${activeBatchId}/preview`, {
      params: { validation_status: previewFilter || undefined, per_page: 50 }
    }).then(r => r.data),
    enabled: !!activeBatchId && ["validated", "completed", "partial"].includes(activeBatch?.status ?? ""),
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => api.post("/v1/import/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      setActiveBatchId(r.data.batch.id);
      toast.success(r.data.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const validateMutation = useMutation({
    mutationFn: (batchId: number) => api.post(`/v1/import/batches/${batchId}/validate`),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["import-batch", activeBatchId] });
      queryClient.invalidateQueries({ queryKey: ["import-preview", activeBatchId] });
      toast.success(`Validasi selesai. ${r.data.summary.valid} baris valid.`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ batchId, skipRows }: { batchId: number; skipRows: number[] }) =>
      api.post(`/v1/import/batches/${batchId}/confirm`, { skip_row_numbers: skipRows }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["import-batch", activeBatchId] });
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["storage-inventory"] });
      toast.success(r.data.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const rollbackMutation = useMutation({
    mutationFn: (batchId: number) => api.post(`/v1/import/batches/${batchId}/rollback`),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["import-batch", activeBatchId] });
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      toast.success(r.data.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("import_type", selectedImportType);
    uploadMutation.mutate(formData);

    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleSkipRow = (rowNumber: number) => {
    setSkippedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const batches = batchList?.data ?? [];
  const rows = (previewData as Record<string, unknown>)?.rows as { data: StagingRow[] } | undefined;
  const previewSummary = (previewData as Record<string, unknown>)?.summary as Record<string, number> | undefined;

  const currentStep = activeBatch ? PIPELINE_STEPS.findIndex(s => s.statuses.includes(activeBatch.status)) + 1 : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/storage" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-3 transition">
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Storage
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Import Data Inventaris</h1>
        <p className="text-sm text-gray-500 mt-1">Pipeline profesional migrasi data historis dari spreadsheet Excel</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Upload panel + batch history */}
        <div className="space-y-4">
          {/* Download templates */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-500" />
              Template Resmi
            </h2>
            <p className="text-xs text-gray-500 mb-3">Download template Excel resmi sebelum mengisi data. Format kolom sudah ditentukan.</p>
            <div className="space-y-2">
              {[
                { label: "Template Inventaris Benih", type: "seed_inventory", color: "bg-green-50 text-green-700 hover:bg-green-100" },
                { label: "Template Unit Penyimpanan", type: "storage_unit", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
              ].map((t) => (
                <a
                  key={t.type}
                  href={`/api/v1/import/template?type=${t.type}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition", t.color)}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {t.label}
                  <Download className="w-3.5 h-3.5 ml-auto" />
                </a>
              ))}
            </div>
          </div>

          {/* Upload panel */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-green-500" />
              Upload File Excel
            </h2>

            {/* Import type selector */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-3">
              {(["seed_inventory", "storage_unit"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedImportType(type)}
                  className={cn("flex-1 py-2 text-xs font-medium transition", selectedImportType === type ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50")}
                >
                  {type === "seed_inventory" ? "Inventaris Benih" : "Unit Penyimpanan"}
                </button>
              ))}
            </div>

            <label className={cn("flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition",
              uploadMutation.isPending ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-green-400 hover:bg-green-50"
            )}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" disabled={uploadMutation.isPending} />
              {uploadMutation.isPending ? (
                <><Loader2 className="w-8 h-8 text-green-500 animate-spin mb-2" /><p className="text-sm text-green-600">Mengupload dan parsing...</p></>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Klik atau seret file Excel</p>
                  <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv — maks. 10MB</p>
                </>
              )}
            </label>

            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Data tidak langsung dimasukkan ke database. Anda akan preview dan konfirmasi terlebih dahulu.
              </p>
            </div>
          </div>

          {/* Batch history */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm">Riwayat Import</h2>
            </div>
            {batchListLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded animate-pulse" />)}
              </div>
            ) : batches.length === 0 ? (
              <p className="p-6 text-center text-xs text-gray-400">Belum ada import</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {batches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setActiveBatchId(b.id); setPreviewFilter(""); setSkippedRows(new Set()); }}
                    className={cn("w-full text-left p-3 hover:bg-gray-50 transition", activeBatchId === b.id && "bg-green-50")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-gray-700">{b.batch_code}</p>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", BATCH_STATUS_COLORS[b.status] ?? "bg-gray-50 text-gray-500 border-gray-200")}>
                        {BATCH_STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{b.original_filename}</p>
                    <p className="text-[10px] text-gray-300">{b.total_rows} baris · {b.uploader?.name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Active batch pipeline */}
        <div className="lg:col-span-2 space-y-4">
          {!activeBatch ? (
            <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Upload file atau pilih batch dari riwayat untuk memulai</p>
            </div>
          ) : (
            <>
              {/* Pipeline progress indicator */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="font-semibold text-gray-800">{activeBatch.batch_code}</h2>
                  <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", BATCH_STATUS_COLORS[activeBatch.status] ?? "")}>
                    {BATCH_STATUS_LABELS[activeBatch.status] ?? activeBatch.status}
                  </span>
                  {activeBatch.is_rolled_back && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200 font-medium">ROLLED BACK</span>
                  )}
                </div>

                <p className="text-xs text-gray-400 mb-4 truncate">{activeBatch.original_filename}</p>

                {/* Step indicators */}
                <div className="flex items-center gap-1">
                  {PIPELINE_STEPS.map((step, i) => {
                    const done = currentStep > step.id;
                    const active = currentStep === step.id;
                    return (
                      <div key={step.id} className="flex items-center gap-1 flex-1">
                        <div className={cn("flex-1 flex flex-col items-center")}>
                          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                            done ? "bg-green-600 border-green-600 text-white" :
                            active ? "bg-white border-green-500 text-green-600" :
                            "bg-white border-gray-200 text-gray-300"
                          )}>
                            {done ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                          </div>
                          <p className={cn("text-[9px] mt-1 text-center leading-tight",
                            done ? "text-green-600" : active ? "text-green-500 font-semibold" : "text-gray-300"
                          )}>{step.label}</p>
                        </div>
                        {i < PIPELINE_STEPS.length - 1 && (
                          <div className={cn("h-0.5 flex-1 -mt-4", done ? "bg-green-400" : "bg-gray-100")} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Row stats */}
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {[
                    { label: "Total", value: activeBatch.total_rows, color: "text-gray-700 bg-gray-50" },
                    { label: "Valid", value: activeBatch.valid_rows, color: "text-green-700 bg-green-50" },
                    { label: "Peringatan", value: activeBatch.warning_rows, color: "text-yellow-700 bg-yellow-50" },
                    { label: "Tidak Valid", value: activeBatch.invalid_rows, color: "text-red-700 bg-red-50" },
                    { label: "Duplikat", value: activeBatch.duplicate_rows, color: "text-orange-700 bg-orange-50" },
                  ].map((s) => (
                    <div key={s.label} className={cn("rounded-lg p-2 text-center border border-current/10", s.color)}>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-[9px] mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {activeBatch.status_message && (
                  <p className="text-xs text-gray-500 mt-3 p-2 bg-gray-50 rounded">{activeBatch.status_message}</p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  {activeBatch.status === "parsed" && (
                    <button
                      onClick={() => validateMutation.mutate(activeBatch.id)}
                      disabled={validateMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition"
                    >
                      {validateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Jalankan Validasi
                    </button>
                  )}

                  {["validated"].includes(activeBatch.status) && activeBatch.valid_rows > 0 && (
                    <button
                      onClick={() => confirmMutation.mutate({ batchId: activeBatch.id, skipRows: Array.from(skippedRows) })}
                      disabled={confirmMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition"
                    >
                      {confirmMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                      Konfirmasi Import ({activeBatch.valid_rows - skippedRows.size} baris)
                    </button>
                  )}

                  {["completed", "partial"].includes(activeBatch.status) && !activeBatch.is_rolled_back && (
                    <button
                      onClick={() => { if (confirm("Yakin ingin rollback? Semua data dari batch ini akan dihapus dari database.")) rollbackMutation.mutate(activeBatch.id); }}
                      disabled={rollbackMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition border border-red-200"
                    >
                      {rollbackMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Rollback Batch Ini
                    </button>
                  )}

                  {["validated", "completed", "partial"].includes(activeBatch.status) && activeBatch.invalid_rows > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.get(`/v1/import/batches/${activeBatch.id}/error-report`);
                          const report = res.data;
                          const rows = [
                            ["Baris", "Kode Paket", "Errors"],
                            ...((report.error_report ?? []) as Array<{ row_number: number; package_code: string; errors: string }>).map(
                              (r) => [r.row_number, r.package_code, r.errors]
                            ),
                          ];
                          const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
                          const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `error_report_${report.batch_code}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error("Gagal mengunduh laporan error");
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-lg transition"
                    >
                      <Download className="w-4 h-4" />
                      Laporan Error ({activeBatch.invalid_rows})
                    </button>
                  )}
                </div>
              </div>

              {/* Preview table */}
              {["validated", "completed", "partial"].includes(activeBatch.status) && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-50 flex-wrap gap-2">
                    <h3 className="font-semibold text-gray-800 text-sm">Preview Data</h3>
                    <div className="flex gap-2">
                      {["", "valid", "warning", "invalid", "duplicate"].map((f) => {
                        const label = f === "" ? "Semua" : VALIDATION_BADGE[f]?.label ?? f;
                        const count = f === ""
                          ? activeBatch.total_rows
                          : f === "valid" ? (previewSummary?.valid ?? 0)
                          : f === "warning" ? (previewSummary?.warning ?? 0)
                          : f === "invalid" ? (previewSummary?.invalid ?? 0)
                          : (previewSummary?.duplicate ?? 0);
                        return (
                          <button
                            key={f}
                            onClick={() => setPreviewFilter(f)}
                            className={cn("text-xs px-2.5 py-1 rounded-full font-medium transition border", previewFilter === f ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400")}
                          >
                            {label} {count > 0 && `(${count})`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {previewLoading ? (
                    <div className="p-6 space-y-2">
                      {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}
                    </div>
                  ) : (rows?.data ?? []).length === 0 ? (
                    <p className="p-8 text-center text-sm text-gray-400">Tidak ada baris dengan filter ini</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {activeBatch.status === "validated" && <th className="px-3 py-2 text-gray-400">Lewati</th>}
                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Baris</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Kode Paket</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Genotipe (Raw → Norm)</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Unit Simpan</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Tgl Simpan</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Berat Awal</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Validasi</th>
                            {["completed", "partial"].includes(activeBatch.status) && (
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">Import</th>
                            )}
                            <th className="px-3 py-2 text-left text-gray-500 font-semibold">Issues</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(rows?.data ?? []).map((row) => {
                            const isSkipped = skippedRows.has(row.row_number);
                            const vBadge = VALIDATION_BADGE[row.validation_status];
                            const iBadge = IMPORT_STATUS_BADGE[row.import_status];
                            return (
                              <tr key={row.id} className={cn("hover:bg-gray-50 transition", isSkipped && "opacity-40")}>
                                {activeBatch.status === "validated" && (
                                  <td className="px-3 py-2 text-center">
                                    {row.validation_status !== "invalid" && row.validation_status !== "duplicate" && (
                                      <input
                                        type="checkbox"
                                        checked={isSkipped}
                                        onChange={() => toggleSkipRow(row.row_number)}
                                        className="w-3.5 h-3.5 accent-red-500"
                                        title="Lewati baris ini"
                                      />
                                    )}
                                  </td>
                                )}
                                <td className="px-3 py-2 text-gray-400">{row.row_number}</td>
                                <td className="px-3 py-2 font-mono text-blue-700">{row.norm_package_code || row.raw_package_code || "—"}</td>
                                <td className="px-3 py-2">
                                  <span className="text-gray-400">{row.raw_genotype_code}</span>
                                  {row.norm_genotype_code && row.norm_genotype_code !== row.raw_genotype_code && (
                                    <><span className="mx-1 text-gray-300">→</span><span className="text-green-700 font-medium">{row.norm_genotype_code}</span></>
                                  )}
                                </td>
                                <td className="px-3 py-2">{row.raw_storage_unit_code}</td>
                                <td className="px-3 py-2">{row.norm_storage_date || row.raw_storage_date}</td>
                                <td className="px-3 py-2">{row.norm_initial_weight_g ?? row.raw_initial_weight_g}g</td>
                                <td className="px-3 py-2">
                                  <span className={cn("px-1.5 py-0.5 rounded-full font-medium text-[10px]", vBadge?.cls)}>
                                    {vBadge?.label}
                                  </span>
                                </td>
                                {["completed", "partial"].includes(activeBatch.status) && (
                                  <td className="px-3 py-2">
                                    <span className={cn("px-1.5 py-0.5 rounded-full font-medium text-[10px]", iBadge?.cls)}>
                                      {iBadge?.label}
                                    </span>
                                  </td>
                                )}
                                <td className="px-3 py-2 max-w-xs">
                                  {(row.validation_errors ?? []).map((e, i) => (
                                    <p key={i} className="text-red-600 truncate" title={e.message}>
                                      ✗ {e.message}
                                    </p>
                                  ))}
                                  {(row.validation_warnings ?? []).map((w, i) => (
                                    <p key={i} className="text-yellow-600 truncate" title={w.message}>
                                      ⚠ {w.message}
                                    </p>
                                  ))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
