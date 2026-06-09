"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Dna, X, List, CheckCircle2, Download, Upload } from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/axios";
import axios from "axios";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { genotypeService } from "@/services/genotype.service";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Genotype } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";


const toOptionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

const schema = z.object({
  genotype_code: z.string().min(1, "Kode genotipe wajib diisi").max(30),
  old_code: z.string().optional(),
  genotype_name: z.string().min(1, "Nama genotipe wajib diisi"),
  category: z.enum(["inbred_line", "hybrid", "variety", "population", "germplasm"]),
  trial_type: z.enum(["drought", "shade", "normal", "feed", "sweet_corn", "multi"]),
  origin: z.string().optional(),
  breeder: z.string().optional(),
  release_year: z.preprocess(toOptionalNumber, z.number().optional()),
  breeder_notes: z.string().optional(),
  pedigree: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
});

type FormData = z.infer<typeof schema>;

const categoryLabels: Record<string, string> = {
  inbred_line: "Galur Murni", hybrid: "Hibrida", variety: "Varietas",
  population: "Populasi", germplasm: "Plasma Nutfah",
};

const trialTypeLabels: Record<string, string> = {
  drought: "Kekeringan", shade: "Naungan", normal: "Normal",
  feed: "Pakan", sweet_corn: "Jagung Manis", multi: "Multi",
};

export default function GenotypesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingGenotype, setEditingGenotype] = useState<Genotype | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkMode, setBulkMode] = useState<"text" | "file">("text");
  const [bulkResult, setBulkResult] = useState<{ created_count: number; skipped_count: number; failed_count: number; skipped: Array<{ code: string; reason: string }>; failed: Array<{ code: string; reason: string }> } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["genotypes"],
    queryFn: () => genotypeService.getAll({ all: true }).then((r) => r.data as Genotype[]),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { status: "active", category: "inbred_line", trial_type: "normal" },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => genotypeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genotypes"] });
      toast.success("Genotipe berhasil ditambahkan");
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Genotype> }) => genotypeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genotypes"] });
      toast.success("Genotipe berhasil diperbarui");
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => genotypeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genotypes"] });
      toast.success("Genotipe berhasil dihapus");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const handleBulkError = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
      if (data?.errors) {
        // Show first few field errors directly in the modal result
        const msgs = Object.entries(data.errors)
          .slice(0, 5)
          .map(([field, errs]) => `${field}: ${errs[0]}`)
          .join("\n");
        setBulkResult({
          created_count: 0,
          skipped_count: 0,
          failed_count: 1,
          skipped: [],
          failed: [{ code: "–", reason: msgs || data.message || "Validation error" }],
        });
        toast.error("Validasi gagal — lihat detail di bawah");
        return;
      }
    }
    toast.error(getApiErrorMessage(error));
  };

  const bulkMutation = useMutation({
    mutationFn: (genotypes: Array<{ genotype_code: string; genotype_name: string }>) =>
      api.post("/v1/genotypes/bulk", { genotypes }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["genotypes"] });
      setBulkResult(r.data);
      toast.success(r.data.message);
    },
    onError: handleBulkError,
  });

  const fileMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post("/v1/genotypes/import-file", fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["genotypes"] });
      setBulkResult(r.data);
      toast.success(r.data.message);
    },
    onError: handleBulkError,
  });

  const handleBulkSubmit = () => {
    setBulkResult(null);

    if (bulkMode === "file") {
      if (!bulkFile) { toast.error("Pilih file Excel terlebih dahulu"); return; }
      fileMutation.mutate(bulkFile);
      return;
    }

    const lines = bulkText
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error("Masukkan minimal satu kode genotipe");
      return;
    }

    const genotypes = lines.map((line) => {
      const parts = line.split(/\s*[-|]\s+/);
      return {
        genotype_code: parts[0].trim(),
        genotype_name: parts[1]?.trim() ?? parts[0].trim(),
      };
    });

    bulkMutation.mutate(genotypes);
  };

  const isPending = bulkMutation.isPending || fileMutation.isPending;

  const openCreate = () => {
    setEditingGenotype(null);
    reset({ status: "active", category: "inbred_line", trial_type: "normal" });
    setIsModalOpen(true);
  };

  const openEdit = (g: Genotype) => {
    setEditingGenotype(g);
    reset({ ...g, release_year: g.release_year ?? undefined });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGenotype(null);
    reset();
  };

  const onSubmit = (data: FormData) => {
    if (editingGenotype) {
      updateMutation.mutate({ id: editingGenotype.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns: ColumnDef<Genotype, unknown>[] = [
    {
      header: "Kode",
      accessorKey: "genotype_code",
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-semibold text-green-700">{row.original.genotype_code}</p>
          {row.original.old_code && <p className="text-xs text-gray-400">({row.original.old_code})</p>}
        </div>
      ),
    },
    { header: "Nama Genotipe", accessorKey: "genotype_name" },
    {
      header: "Kategori",
      accessorKey: "category",
      cell: ({ getValue }) => <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{categoryLabels[getValue() as string] ?? getValue() as string}</span>,
    },
    {
      header: "Tipe Uji",
      accessorKey: "trial_type",
      cell: ({ getValue }) => <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{trialTypeLabels[getValue() as string] ?? getValue() as string}</span>,
    },
    { header: "Pemulia", accessorKey: "breeder" },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      header: "Aksi",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (confirm("Hapus genotipe ini?")) deleteMutation.mutate(row.original.id); }}
            className="p-1.5 rounded hover:bg-red-50 text-red-500 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Manajemen Genotipe"
        description="Kelola data genotipe jagung penelitian UNPAD"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => { setIsBulkModalOpen(true); setBulkResult(null); setBulkText(""); }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition"
            >
              <List className="w-4 h-4" />
              Import Massal
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
              <Plus className="w-4 h-4" />
              Tambah Genotipe
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Dna className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold text-gray-800">Daftar Genotipe</h2>
          <span className="ml-auto text-sm text-gray-400">{(data as Genotype[])?.length ?? 0} total</span>
        </div>
        <DataTable
          data={(data as Genotype[]) ?? []}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Cari kode atau nama genotipe..."
          emptyMessage="Belum ada genotipe. Klik tombol Tambah untuk memulai."
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingGenotype ? "Edit Genotipe" : "Tambah Genotipe Baru"}
              </h3>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode Genotipe *</label>
                  <input {...register("genotype_code")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. UB-D-001" />
                  {errors.genotype_code && <p className="text-red-500 text-xs mt-1">{errors.genotype_code.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode Lama</label>
                  <input {...register("old_code")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Opsional" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Genotipe *</label>
                <input {...register("genotype_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Nama lengkap genotipe" />
                {errors.genotype_name && <p className="text-red-500 text-xs mt-1">{errors.genotype_name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                  <select {...register("category")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Uji *</label>
                  <select {...register("trial_type")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {Object.entries(trialTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asal/Origin</label>
                  <input {...register("origin")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Negara/lembaga asal" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pemulia</label>
                  <input {...register("breeder")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Nama pemulia" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Pelepasan</label>
                  <input {...register("release_year")} type="number" min="1990" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="2024" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select {...register("status")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="active">Aktif</option>
                    <option value="inactive">Tidak Aktif</option>
                    <option value="archived">Diarsipkan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Silsilah/Pedigree</label>
                <input {...register("pedigree")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. A × B" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Pemulia</label>
                <textarea {...register("breeder_notes")} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="Catatan tambahan..." />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {isSubmitting ? "Menyimpan..." : editingGenotype ? "Simpan Perubahan" : "Tambah Genotipe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Import Genotipe Massal</h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Download template */}
              <a
                href="/api/v1/genotypes/import-template"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition"
              >
                <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
                  <Download className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Download Template Excel</p>
                  <p className="text-xs text-green-600 mt-0.5">Isi kode genotipe di kolom A, lalu upload di bawah</p>
                </div>
              </a>

              {/* Mode toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(["file", "text"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setBulkMode(m)}
                    className={cn("flex-1 py-2 text-sm font-medium transition", bulkMode === m ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50")}
                  >
                    {m === "file" ? "Upload File Excel" : "Tempel Kode (Teks)"}
                  </button>
                ))}
              </div>

              {/* File upload */}
              {bulkMode === "file" && (
                <label className={cn("flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition",
                  bulkFile ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-green-400 hover:bg-green-50"
                )}>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                  />
                  {bulkFile ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm font-medium text-green-700">{bulkFile.name}</p>
                      <p className="text-xs text-green-500 mt-0.5">{(bulkFile.size / 1024).toFixed(1)} KB — klik untuk ganti</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Klik untuk pilih file Excel</p>
                      <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv</p>
                    </>
                  )}
                </label>
              )}

              {/* Text paste */}
              {bulkMode === "text" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tempel Kode Genotipe
                    <span className="ml-1 text-xs text-gray-400 font-normal">
                      ({bulkText.split(/[\n,;]+/).filter(l => l.trim()).length} kode terdeteksi)
                    </span>
                  </label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={10}
                    placeholder={"20001\n20002\n20003 - Galur Harapan 1\n20004 - Hibrida Unpad\n..."}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Satu kode per baris. Opsional tambah nama: <code className="bg-gray-100 px-1 rounded">20001 - Nama Genotipe</code>
                  </p>
                </div>
              )}

              {/* Result summary */}
              {bulkResult && (
                <div className="rounded-xl border p-4 space-y-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-2xl font-bold text-green-700">{bulkResult.created_count}</p>
                      <p className="text-xs text-green-600 mt-0.5">Dibuat</p>
                    </div>
                    <div className="text-center bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                      <p className="text-2xl font-bold text-yellow-700">{bulkResult.skipped_count}</p>
                      <p className="text-xs text-yellow-600 mt-0.5">Dilewati</p>
                    </div>
                    <div className="text-center bg-red-50 rounded-lg p-3 border border-red-100">
                      <p className="text-2xl font-bold text-red-700">{bulkResult.failed_count}</p>
                      <p className="text-xs text-red-600 mt-0.5">Gagal</p>
                    </div>
                  </div>
                  {bulkResult.skipped.length > 0 && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 rounded p-2 border border-yellow-100">
                      <span className="font-semibold">Sudah ada: </span>
                      <span className="font-mono">{bulkResult.skipped.map(s => s.code).join(", ")}</span>
                    </p>
                  )}
                  {bulkResult.failed.length > 0 && (
                    <div className="text-xs text-red-700 bg-red-50 rounded p-2 border border-red-100">
                      {bulkResult.failed.map((f, i) => <p key={i}><span className="font-mono font-semibold">{f.code}</span>: {f.reason}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Tutup
                </button>
                <button
                  onClick={handleBulkSubmit}
                  disabled={isPending || (bulkMode === "text" ? !bulkText.trim() : !bulkFile)}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  {isPending
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Mengimport...</>
                    : <><CheckCircle2 className="w-4 h-4" />Import Sekarang</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
