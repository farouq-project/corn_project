"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, CheckCircle, XCircle, AlertTriangle, RefreshCw, RotateCcw, FileSpreadsheet, Microscope } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface ImportBatch {
  id: number;
  batch_code: string;
  original_filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warning_rows: number;
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
  raw_data: Record<string, string>;
  normalized_data?: Record<string, unknown>;
  status: "pending" | "valid" | "warning" | "invalid";
  errors?: string[];
  warnings?: string[];
}

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Diunggah", parsing: "Parsing...", parsed: "Diparsing",
  validating: "Memvalidasi...", validated: "Siap Impor",
  importing: "Mengimpor...", completed: "Selesai",
  partial: "Sebagian", failed: "Gagal", rolled_back: "Di-rollback",
};

const STATUS_COLOR: Record<string, string> = {
  uploaded: "bg-blue-50 text-blue-700", parsed: "bg-yellow-50 text-yellow-700",
  validating: "bg-yellow-50 text-yellow-700", validated: "bg-green-50 text-green-700",
  completed: "bg-emerald-50 text-emerald-700", failed: "bg-red-50 text-red-700",
  rolled_back: "bg-gray-100 text-gray-500",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function PhenotypingImportPage() {
  const [activeTab, setActiveTab] = useState<"observation" | "characteristic">("observation");
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [previewFilter, setPreviewFilter] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const charFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // ── Observation import queries ────────────────────────────────────────────

  const { data: batchesData, isLoading: loadingBatches } = useQuery({
    queryKey: ["import-batches"],
    queryFn: () => api.get<{ data: ImportBatch[] }>("/v1/phenotyping/import/batches").then((r) => r.data.data),
    refetchInterval: 5000,
  });
  const batches: ImportBatch[] = batchesData ?? [];

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  const { data: previewData, isLoading: loadingPreview } = useQuery({
    queryKey: ["import-preview", selectedBatchId, previewFilter],
    queryFn: () =>
      api.get(`/v1/phenotyping/import/batches/${selectedBatchId}/preview`, {
        params: { status: previewFilter || undefined, per_page: 50 },
      }).then((r) => r.data),
    enabled: !!selectedBatchId && !!selectedBatch && ["validated", "completed"].includes(selectedBatch.status),
  });

  // ── Observation mutations ────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post<{ batch: ImportBatch }>("/v1/phenotyping/import/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      setSelectedBatchId(res.data.batch.id);
      toast.success(`File diupload: ${res.data.batch.total_rows} baris`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const validateMutation = useMutation({
    mutationFn: (batchId: number) => api.post(`/v1/phenotyping/import/batches/${batchId}/validate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["import-preview"] });
      toast.success("Validasi selesai");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const confirmMutation = useMutation({
    mutationFn: (batchId: number) => api.post(`/v1/phenotyping/import/batches/${batchId}/confirm`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["observation-records"] });
      toast.success((res.data as { message?: string })?.message ?? "Import selesai");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const rollbackMutation = useMutation({
    mutationFn: (batchId: number) => api.post(`/v1/phenotyping/import/batches/${batchId}/rollback`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["observation-records"] });
      toast.success((res.data as { message?: string })?.message ?? "Rollback selesai");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  // ── Characteristic import mutation ────────────────────────────────────────

  const [charImportResult, setCharImportResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  const charImportMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post("/v1/phenotyping/characteristics/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["characteristics-all"] });
      queryClient.invalidateQueries({ queryKey: ["characteristics"] });
      setCharImportResult(res.data as typeof charImportResult);
      toast.success((res.data as { message?: string })?.message ?? "Import karakteristik selesai");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const handleObservationFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  const handleCharFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) charImportMutation.mutate(file);
    e.target.value = "";
  };

  const rows: StagingRow[] = previewData?.rows ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Import Data" description="Import massal data pengamatan dan master pengamatan dari Excel" />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {([["observation", "Data Pengamatan", FileSpreadsheet], ["characteristic", "Master Pengamatan", Microscope]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
              activeTab === key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Data Pengamatan ──────────────────────────────────────────── */}
      {activeTab === "observation" && (
        <div className="space-y-4">
          {/* Upload area */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Langkah 1 — Upload File Excel</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/v1/phenotyping/import/template"
                download
                className="flex items-center gap-2 px-4 py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition"
              >
                <Download className="w-4 h-4" />
                Download Template
              </a>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploadMutation.isPending ? "Mengupload..." : "Upload File"}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleObservationFile} />
            </div>
          </div>

          {/* Batch list */}
          {batches.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Riwayat Import</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {batches.slice(0, 10).map((batch) => (
                  <div
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id === selectedBatchId ? null : batch.id)}
                    className={cn("flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition", selectedBatchId === batch.id && "bg-green-50")}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{batch.original_filename}</p>
                      <p className="text-xs text-gray-400">{batch.batch_code} · {batch.total_rows} baris</p>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", STATUS_COLOR[batch.status] ?? "bg-gray-100 text-gray-500")}>
                      {STATUS_LABEL[batch.status] ?? batch.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected batch actions + preview */}
          {selectedBatch && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{selectedBatch.original_filename}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedBatch.batch_code}</p>
                </div>
                <div className="flex gap-2">
                  {selectedBatch.status === "parsed" && (
                    <button
                      onClick={() => validateMutation.mutate(selectedBatch.id)}
                      disabled={validateMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {validateMutation.isPending ? "Memvalidasi..." : "Validasi"}
                    </button>
                  )}
                  {selectedBatch.status === "validated" && (
                    <button
                      onClick={() => { if (confirm(`Import ${selectedBatch.valid_rows} baris valid?`)) confirmMutation.mutate(selectedBatch.id); }}
                      disabled={confirmMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {confirmMutation.isPending ? "Mengimpor..." : `Konfirmasi Import (${selectedBatch.valid_rows} baris)`}
                    </button>
                  )}
                  {selectedBatch.status === "completed" && !selectedBatch.is_rolled_back && (
                    <button
                      onClick={() => { if (confirm("Rollback akan menghapus semua data yang diimpor dari batch ini. Lanjutkan?")) rollbackMutation.mutate(selectedBatch.id); }}
                      disabled={rollbackMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rollback
                    </button>
                  )}
                </div>
              </div>

              {/* Row counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: selectedBatch.total_rows, cls: "bg-gray-50" },
                  { label: "Valid", value: selectedBatch.valid_rows, cls: "bg-green-50 text-green-700" },
                  { label: "Peringatan", value: selectedBatch.warning_rows, cls: "bg-yellow-50 text-yellow-700" },
                  { label: "Error", value: selectedBatch.invalid_rows, cls: "bg-red-50 text-red-700" },
                ].map((c) => (
                  <div key={c.label} className={cn("rounded-lg p-3 text-center", c.cls)}>
                    <p className="text-xl font-bold">{c.value}</p>
                    <p className="text-xs mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>

              {/* Preview table */}
              {["validated", "completed"].includes(selectedBatch.status) && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Preview Baris</h4>
                    <select
                      value={previewFilter}
                      onChange={(e) => setPreviewFilter(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded"
                    >
                      <option value="">Semua</option>
                      <option value="valid">Valid</option>
                      <option value="warning">Peringatan</option>
                      <option value="invalid">Error</option>
                    </select>
                  </div>
                  <div className="overflow-auto max-h-64 rounded-lg border border-gray-200 text-xs">
                    {loadingPreview ? (
                      <div className="p-6 text-center text-gray-400">Memuat preview...</div>
                    ) : rows.length === 0 ? (
                      <div className="p-6 text-center text-gray-400">Tidak ada baris</div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">#</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Status</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">No Plot</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Kode Gen</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Environment</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">R</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Pesan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white">
                          {rows.map((row) => (
                            <tr key={row.id} className={cn(row.status === "invalid" && "bg-red-50/30", row.status === "warning" && "bg-yellow-50/30")}>
                              <td className="px-3 py-2 text-gray-400">{row.row_number}</td>
                              <td className="px-3 py-2">
                                {row.status === "valid" && <CheckCircle className="w-4 h-4 text-green-500" />}
                                {row.status === "warning" && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                                {row.status === "invalid" && <XCircle className="w-4 h-4 text-red-500" />}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">{row.raw_data["No Plot"] ?? row.raw_data["no_plot"] ?? "—"}</td>
                              <td className="px-3 py-2 font-mono whitespace-nowrap">{row.raw_data["Kode Gen"] ?? row.raw_data["kode_gen"] ?? "—"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{row.raw_data["Environment"] ?? row.raw_data["environment"] ?? "—"}</td>
                              <td className="px-3 py-2">{row.raw_data["R"] ?? row.raw_data["r"] ?? "—"}</td>
                              <td className="px-3 py-2 text-red-600">
                                {[...(row.errors ?? []), ...(row.warnings ?? [])].join("; ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Master Pengamatan ───────────────────────────────────────── */}
      {activeTab === "characteristic" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2">Import Master Pengamatan</h3>
            <p className="text-sm text-gray-500 mb-4">
              Jika Kode sudah ada: <strong>Update</strong>. Jika belum ada: <strong>Buat baru</strong>. Kode tidak berubah setelah dibuat.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/v1/phenotyping/characteristics/import/template"
                download
                className="flex items-center gap-2 px-4 py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition"
              >
                <Download className="w-4 h-4" />
                Download Template
              </a>
              <button
                onClick={() => charFileInputRef.current?.click()}
                disabled={charImportMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {charImportMutation.isPending ? "Mengimpor..." : "Upload & Import"}
              </button>
              <input ref={charFileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleCharFile} />
            </div>

            {charImportResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-700">{charImportResult.created}</p>
                    <p className="text-xs text-gray-500">Dibuat</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-700">{charImportResult.updated}</p>
                    <p className="text-xs text-gray-500">Diperbarui</p>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-600">{charImportResult.skipped}</p>
                    <p className="text-xs text-gray-500">Dilewati</p>
                  </div>
                </div>
                {charImportResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-600 space-y-0.5">
                    {charImportResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">Kolom template</p>
            <p className="text-xs text-blue-600">Kelompok Pengamatan · Karakter · Kode · Satuan · Metode Pengamatan · Desimal · Urutan</p>
          </div>
        </div>
      )}
    </div>
  );
}
