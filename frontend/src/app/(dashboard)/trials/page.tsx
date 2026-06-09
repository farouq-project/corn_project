"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, MapPin, Calendar, Users, X, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trialService } from "@/services/trial.service";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Trial } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { getApiErrorMessage } from "@/lib/axios";
import { formatDate, cn } from "@/lib/utils";
import api from "@/lib/axios";

const schema = z.object({
  trial_code: z.string().min(1, "Kode trial wajib diisi").max(30),
  trial_name: z.string().min(1, "Nama trial wajib diisi"),
  season_id: z.coerce.number().min(1, "Pilih musim"),
  location_id: z.coerce.number().min(1, "Pilih lokasi"),
  objective: z.string().optional(),
  layout_design: z.enum(["RCBD", "CRD", "split_plot", "factorial", "augmented", "alpha_lattice"]).default("RCBD"),
  replications: z.coerce.number().min(1).max(20).default(3),
  plot_size_m2: z.coerce.number().optional(),
  planting_date: z.string().optional(),
  harvest_date: z.string().optional(),
  status: z.enum(["planned", "active", "harvested", "completed", "cancelled"]).default("planned"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const statusColors: Record<string, string> = {
  planned: "border-blue-200 bg-blue-50",
  active: "border-green-200 bg-green-50",
  harvested: "border-purple-200 bg-purple-50",
  completed: "border-emerald-200 bg-emerald-50",
  cancelled: "border-gray-200 bg-gray-50",
};

export default function TrialsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrial, setEditingTrial] = useState<Trial | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["trials"],
    queryFn: () => trialService.getAll({ per_page: 100 }).then((r) => r.data as { data: Trial[] }),
  });

  const { data: seasons } = useQuery({
    queryKey: ["seasons-simple"],
    queryFn: () => api.get("/v1/seasons?all=true").then((r) => r.data as Array<{ id: number; season_code: string; season_name: string }>),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations-simple"],
    queryFn: () => api.get("/v1/locations?all=true").then((r) => r.data as Array<{ id: number; field_code: string; field_name: string }>),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "planned", layout_design: "RCBD", replications: 3 },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => trialService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trials"] });
      toast.success("Trial berhasil dibuat");
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Trial> }) => trialService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trials"] });
      toast.success("Trial berhasil diperbarui");
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openCreate = () => {
    setEditingTrial(null);
    reset({ status: "planned", layout_design: "RCBD", replications: 3 });
    setIsModalOpen(true);
  };

  const openEdit = (t: Trial) => {
    setEditingTrial(t);
    reset({
      trial_code: t.trial_code, trial_name: t.trial_name,
      season_id: t.season_id, location_id: t.location_id,
      objective: t.objective ?? "", layout_design: t.layout_design as FormData["layout_design"],
      replications: t.replications, plot_size_m2: t.plot_size_m2 ?? undefined,
      planting_date: t.planting_date ?? "", harvest_date: t.harvest_date ?? "",
      status: t.status, notes: t.notes ?? "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTrial(null);
    reset();
  };

  const onSubmit = (data: FormData) => {
    if (editingTrial) {
      updateMutation.mutate({ id: editingTrial.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const trials = data?.data ?? [];

  const columns: ColumnDef<Trial, unknown>[] = [
    {
      header: "Kode Trial",
      accessorKey: "trial_code",
      cell: ({ getValue }) => <span className="font-mono font-semibold text-green-700">{getValue() as string}</span>,
    },
    { header: "Nama Trial", accessorKey: "trial_name" },
    {
      header: "Musim",
      accessorKey: "season.season_name",
      cell: ({ row }) => <span className="text-xs">{row.original.season?.season_name ?? "-"}</span>,
    },
    {
      header: "Lokasi",
      accessorKey: "location.field_name",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs">
          <MapPin className="w-3 h-3 text-gray-400" />
          {row.original.location?.field_name ?? "-"}
        </div>
      ),
    },
    { header: "Desain", accessorKey: "layout_design" },
    {
      header: "Genotipe",
      accessorKey: "genotypes_count",
      cell: ({ getValue }) => <span className="text-sm font-medium">{getValue() as number ?? 0} genotipe</span>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      header: "Tanam",
      accessorKey: "planting_date",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{formatDate(getValue() as string)}</span>,
    },
    {
      header: "Aksi",
      id: "actions",
      cell: ({ row }) => (
        <button onClick={() => openEdit(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const statusCounts = trials.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Manajemen Trial"
        description="Kelola penelitian dan percobaan jagung"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(["cards", "table"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn("px-3 py-1.5 text-xs font-medium transition", viewMode === mode ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50")}
                >
                  {mode === "cards" ? "Kartu" : "Tabel"}
                </button>
              ))}
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
              <Plus className="w-4 h-4" />
              Buat Trial
            </button>
          </div>
        }
      />

      {/* Status summary */}
      <div className="grid grid-cols-5 gap-3">
        {[["planned", "Direncanakan"], ["active", "Aktif"], ["harvested", "Dipanen"], ["completed", "Selesai"], ["cancelled", "Dibatalkan"]].map(([status, label]) => (
          <div key={status} className={cn("rounded-xl border p-3 text-center", statusColors[status])}>
            <p className="text-xl font-bold text-gray-800">{statusCounts[status] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            [...Array(6)].map((_, i) => <div key={i} className="h-48 bg-white rounded-xl animate-pulse border border-gray-100" />)
          ) : trials.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Belum ada trial. Klik Buat Trial untuk memulai.</p>
            </div>
          ) : (
            trials.map((trial) => (
              <div key={trial.id} className={cn("bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition cursor-pointer group", statusColors[trial.status])}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-xs text-gray-400">{trial.trial_code}</p>
                    <h3 className="font-semibold text-gray-900 mt-0.5 group-hover:text-green-700 transition">{trial.trial_name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <StatusBadge status={trial.status} />
                    <button onClick={() => openEdit(trial)} className="p-1 rounded hover:bg-white/60 text-gray-400 hover:text-blue-500 transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{trial.location?.field_name ?? "-"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{trial.season?.season_name ?? "-"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{trial.genotypes_count ?? 0} genotipe · {trial.replications} ulangan</span>
                  </div>
                </div>
                {trial.planting_date && (
                  <div className="mt-3 pt-3 border-t border-current/10 flex justify-between text-xs text-gray-400">
                    <span>Tanam: {formatDate(trial.planting_date)}</span>
                    {trial.harvest_date && <span>Panen: {formatDate(trial.harvest_date)}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <DataTable
            data={trials}
            columns={columns}
            isLoading={isLoading}
            searchPlaceholder="Cari kode atau nama trial..."
            emptyMessage="Belum ada trial"
          />
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingTrial ? "Edit Trial" : "Buat Trial Baru"}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode Trial *</label>
                  <input {...register("trial_code")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. T-MH2026-001" />
                  {errors.trial_code && <p className="text-red-500 text-xs mt-1">{errors.trial_code.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select {...register("status")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {[["planned", "Direncanakan"], ["active", "Aktif"], ["harvested", "Dipanen"], ["completed", "Selesai"], ["cancelled", "Dibatalkan"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Trial *</label>
                <input {...register("trial_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Judul lengkap penelitian" />
                {errors.trial_name && <p className="text-red-500 text-xs mt-1">{errors.trial_name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Musim Tanam *</label>
                  <select {...register("season_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Musim --</option>
                    {seasons?.map((s) => <option key={s.id} value={s.id}>{s.season_name}</option>)}
                  </select>
                  {errors.season_id && <p className="text-red-500 text-xs mt-1">{errors.season_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi *</label>
                  <select {...register("location_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Lokasi --</option>
                    {locations?.map((l) => <option key={l.id} value={l.id}>{l.field_name}</option>)}
                  </select>
                  {errors.location_id && <p className="text-red-500 text-xs mt-1">{errors.location_id.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desain Percobaan</label>
                  <select {...register("layout_design")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {[["RCBD", "RCBD"], ["CRD", "CRD"], ["split_plot", "Split Plot"], ["factorial", "Faktorial"], ["augmented", "Augmented"], ["alpha_lattice", "Alpha Lattice"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Ulangan</label>
                  <input {...register("replications")} type="number" min="1" max="20" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Tanam</label>
                  <input {...register("planting_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Panen</label>
                  <input {...register("harvest_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tujuan Penelitian</label>
                <textarea {...register("objective")} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="Tujuan dan hipotesis penelitian..." />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {isSubmitting ? "Menyimpan..." : editingTrial ? "Simpan Perubahan" : "Buat Trial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
