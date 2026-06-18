"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Thermometer, Cloud, Droplets, Plus, X, Edit2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { formatDate, cn } from "@/lib/utils";
import type { Environment, Season, Location } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";

const schema = z.object({
  location_id: z.coerce.number({ message: "Pilih lokasi" }).int().positive(),
  season_id: z.coerce.number({ message: "Pilih musim" }).int().positive(),
  elevation_m: z.coerce.number().int().optional().nullable(),
  avg_temperature_c: z.coerce.number().optional().nullable(),
  total_rainfall_mm: z.coerce.number().optional().nullable(),
  irrigation_type: z.string().optional(),
  planting_date: z.string().optional(),
  harvest_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EnvironmentsPage() {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Environment | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["environments"],
    queryFn: () => api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 100 } }).then((r) => r.data),
  });
  const envs = data?.data ?? [];

  const { data: seasons = [] } = useQuery({
    queryKey: ["seasons-simple"],
    queryFn: () => api.get<Array<{ id: number; season_code: string; season_name: string }>>("/v1/seasons?all=true").then((r) => r.data),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-simple"],
    queryFn: () => api.get<Array<{ id: number; field_code: string; field_name: string }>>("/v1/locations?all=true").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post("/v1/environments", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["environments"] }); toast.success("Environment berhasil dibuat"); closeModal(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormData> }) => api.put(`/v1/environments/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["environments"] }); toast.success("Environment berhasil diperbarui"); closeModal(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/environments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["environments"] }); toast.success("Environment berhasil dihapus"); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api.delete(`/v1/environments/${id}`))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["environments"] }); toast.success("Environment terpilih berhasil dihapus"); },
    onError: () => toast.error("Sebagian environment gagal dihapus (mungkin masih memiliki data pengamatan)"),
  });

  const openCreate = () => { setEditing(null); reset({}); setIsModalOpen(true); };
  const openEdit = (env: Environment) => {
    setEditing(env);
    reset({
      location_id: (env as Environment & { location_id?: number }).location_id,
      season_id: (env as Environment & { season_id?: number }).season_id,
      elevation_m: env.elevation_m,
      avg_temperature_c: env.avg_temperature_c,
      total_rainfall_mm: env.total_rainfall_mm,
      irrigation_type: env.irrigation_type ?? "",
      planting_date: env.planting_date ?? "",
      harvest_date: env.harvest_date ?? "",
      notes: (env as Environment & { notes?: string }).notes ?? "",
    });
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); reset(); };

  const onSubmit = (data: FormData) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const columns: ColumnDef<Environment, unknown>[] = [
    {
      header: "Kode",
      accessorKey: "environment_code",
      cell: ({ getValue }) => <span className="font-mono font-semibold text-green-700">{getValue() as string}</span>,
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
    {
      header: "Musim",
      accessorKey: "season.season_name",
      cell: ({ row }) => <span className="text-xs">{row.original.season?.season_name ?? "-"}</span>,
    },
    {
      header: "Elevasi",
      accessorKey: "elevation_m",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() ? `${getValue()} m` : "—"}</span>,
    },
    {
      header: "Suhu",
      accessorKey: "avg_temperature_c",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() ? `${getValue()}°C` : "—"}</span>,
    },
    {
      header: "Curah Hujan",
      accessorKey: "total_rainfall_mm",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() ? `${getValue()} mm` : "—"}</span>,
    },
    {
      header: "Irigasi",
      accessorKey: "irrigation_type",
      cell: ({ getValue }) => <span className="text-xs text-gray-500 capitalize">{(getValue() as string)?.replace("_", " ") || "—"}</span>,
    },
    {
      header: "Tanam",
      accessorKey: "planting_date",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() ? formatDate(getValue() as string) : "—"}</span>,
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
            onClick={() => { if (confirm(`Hapus environment "${row.original.environment_code}"?`)) deleteMutation.mutate(row.original.id); }}
            className="p-1.5 rounded hover:bg-red-50 text-red-400 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const IRRIGATION_TYPES = ["rainfed", "irrigated", "supplemental", "drip", "sprinkler"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Lingkungan Percobaan"
        description="Kombinasi Lokasi × Musim dengan data lingkungan terintegrasi"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(["table", "cards"] as const).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={cn("px-3 py-1.5 text-xs font-medium transition", viewMode === mode ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50")}
                >
                  {mode === "cards" ? "Kartu" : "Tabel"}
                </button>
              ))}
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
              <Plus className="w-4 h-4" />
              Tambah
            </button>
          </div>
        }
      />

      {viewMode === "table" ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <DataTable data={envs} columns={columns} isLoading={isLoading}
            searchPlaceholder="Cari kode environment..."
            emptyMessage="Belum ada environment"
            getRowId={(row) => String(row.id)}
            onBulkDelete={(rows) => bulkDeleteMutation.mutate(rows.map((r) => r.id))}
            isBulkDeleting={bulkDeleteMutation.isPending}
          />
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-white rounded-xl animate-pulse border border-gray-100" />)}
        </div>
      ) : envs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada environment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {envs.map((env) => (
            <div key={env.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition relative group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-gray-400">{env.environment_code}</p>
                  <h3 className="font-semibold text-gray-900 mt-0.5">{env.location?.field_name}</h3>
                  <p className="text-sm text-blue-600">{env.season?.season_name}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(env)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm(`Hapus ${env.environment_code}?`)) deleteMutation.mutate(env.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                {env.elevation_m && <div className="flex items-center gap-1.5"><span className="text-gray-300">↑</span><span>{env.elevation_m} m dpl</span></div>}
                {env.avg_temperature_c && <div className="flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5 text-red-400" /><span>{env.avg_temperature_c}°C</span></div>}
                {env.total_rainfall_mm && <div className="flex items-center gap-1.5"><Cloud className="w-3.5 h-3.5 text-blue-400" /><span>{env.total_rainfall_mm} mm</span></div>}
                {env.irrigation_type && <div className="flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-cyan-400" /><span className="capitalize">{env.irrigation_type.replace("_", " ")}</span></div>}
              </div>
              {(env.planting_date || env.harvest_date) && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-xs text-gray-400">
                  {env.planting_date && <span>Tanam: {formatDate(env.planting_date)}</span>}
                  {env.harvest_date && <span>Panen: {formatDate(env.harvest_date)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editing ? "Edit Environment" : "Tambah Environment"}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi *</label>
                  <select {...register("location_id")} disabled={!!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
                  >
                    <option value="">-- Pilih Lokasi --</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.field_name}</option>)}
                  </select>
                  {errors.location_id && <p className="text-red-500 text-xs mt-1">{errors.location_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Musim *</label>
                  <select {...register("season_id")} disabled={!!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
                  >
                    <option value="">-- Pilih Musim --</option>
                    {seasons.map((s) => <option key={s.id} value={s.id}>{s.season_name}</option>)}
                  </select>
                  {errors.season_id && <p className="text-red-500 text-xs mt-1">{errors.season_id.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Elevasi (m)</label>
                  <input {...register("elevation_m")} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suhu Rata (°C)</label>
                  <input {...register("avg_temperature_c")} type="number" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Curah Hujan (mm)</label>
                  <input {...register("total_rainfall_mm")} type="number" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Irigasi</label>
                <select {...register("irrigation_type")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">-- Pilih --</option>
                  {IRRIGATION_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace("_", " ")}</option>)}
                </select>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <textarea {...register("notes")} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>

              {editing && <p className="text-xs text-gray-400">Lokasi dan musim tidak dapat diubah setelah environment dibuat.</p>}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition"
                >
                  {editing ? "Simpan Perubahan" : "Buat Environment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
