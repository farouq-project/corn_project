"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Map, Calendar, Package, X } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/lib/axios";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Season, Location, StorageUnit } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate, cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";

type TabType = "seasons" | "locations" | "storage_units";

const seasonSchema = z.object({
  season_code: z.string().min(1),
  season_name: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  status: z.enum(["upcoming", "active", "completed", "cancelled"]).default("upcoming"),
  description: z.string().optional(),
});

const toOptionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

const locationSchema = z.object({
  field_code: z.string().min(1),
  field_name: z.string().min(1),
  latitude: z.preprocess(toOptionalNumber, z.number().optional()),
  longitude: z.preprocess(toOptionalNumber, z.number().optional()),
  altitude: z.preprocess(toOptionalNumber, z.number().optional()),
  area_hectares: z.preprocess(toOptionalNumber, z.number().optional()),
  village: z.string().optional(),
  district: z.string().optional(),
  regency: z.string().optional(),
  province: z.string().min(1, "Provinsi wajib diisi"),
  soil_type: z.string().optional(),
});

const storageUnitSchema = z.object({
  unit_code: z.string().min(1),
  unit_name: z.string().min(1),
  unit_type: z.enum(["refrigerator", "freezer", "cold_room", "dry_room", "cabinet", "shelf"]),
  room_name: z.string().optional(),
  building: z.string().optional(),
  temperature_min: z.preprocess(toOptionalNumber, z.number().optional()),
  temperature_max: z.preprocess(toOptionalNumber, z.number().optional()),
  humidity_min: z.preprocess(toOptionalNumber, z.number().optional()),
  humidity_max: z.preprocess(toOptionalNumber, z.number().optional()),
  capacity_racks: z.preprocess(toOptionalNumber, z.number().optional()),
  capacity_boxes_per_rack: z.preprocess(toOptionalNumber, z.number().optional()),
});

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabType>("seasons");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: seasons, isLoading: seasonsLoading } = useQuery({
    queryKey: ["seasons"],
    queryFn: () => api.get<Season[]>("/v1/seasons?all=false&per_page=50").then((r) => r.data as unknown as { data: Season[] }),
  });

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/v1/locations?per_page=50").then((r) => r.data as unknown as { data: Location[] }),
  });

  const { data: storageUnits, isLoading: unitsLoading } = useQuery({
    queryKey: ["storage-units-all"],
    queryFn: () => api.get("/v1/storage/units?per_page=50").then((r) => r.data as unknown as { data: StorageUnit[] }),
  });

  const seasonForm = useForm({ resolver: zodResolver(seasonSchema), defaultValues: { status: "upcoming" as const } });
  const locationForm = useForm({ resolver: zodResolver(locationSchema) });
  const storageForm = useForm({ resolver: zodResolver(storageUnitSchema), defaultValues: { unit_type: "refrigerator" as const } });

  const createSeasonMutation = useMutation({
    mutationFn: (data: z.infer<typeof seasonSchema>) => api.post("/v1/seasons", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["seasons"] }); toast.success("Musim berhasil ditambahkan"); setIsModalOpen(false); seasonForm.reset(); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const createLocationMutation = useMutation({
    mutationFn: (data: z.infer<typeof locationSchema>) => api.post("/v1/locations", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["locations"] }); toast.success("Lokasi berhasil ditambahkan"); setIsModalOpen(false); locationForm.reset(); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const createStorageMutation = useMutation({
    mutationFn: (data: z.infer<typeof storageUnitSchema>) => api.post("/v1/storage/units", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["storage-units-all"] }); toast.success("Unit penyimpanan berhasil ditambahkan"); setIsModalOpen(false); storageForm.reset(); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const bulkDeleteSeasonsMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api.delete(`/v1/seasons/${id}`))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["seasons"] }); toast.success("Musim terpilih berhasil dihapus"); },
    onError: () => toast.error("Sebagian musim gagal dihapus"),
  });

  const bulkDeleteLocationsMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api.delete(`/v1/locations/${id}`))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["locations"] }); toast.success("Lokasi terpilih berhasil dihapus"); },
    onError: () => toast.error("Sebagian lokasi gagal dihapus"),
  });

  const bulkDeleteStorageMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api.delete(`/v1/storage/units/${id}`))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["storage-units-all"] }); toast.success("Unit penyimpanan terpilih berhasil dihapus"); },
    onError: () => toast.error("Sebagian unit penyimpanan gagal dihapus (mungkin masih memiliki inventaris)"),
  });

  const tabs = [
    { id: "seasons" as TabType, label: "Musim Tanam", icon: Calendar, count: (seasons as unknown as { data: Season[] })?.data?.length ?? 0 },
    { id: "locations" as TabType, label: "Lokasi", icon: Map, count: (locations as unknown as { data: Location[] })?.data?.length ?? 0 },
    { id: "storage_units" as TabType, label: "Unit Penyimpanan", icon: Package, count: (storageUnits as unknown as { data: StorageUnit[] })?.data?.length ?? 0 },
  ];

  const seasonColumns: ColumnDef<Season, unknown>[] = [
    { header: "Kode", accessorKey: "season_code", cell: ({ getValue }) => <span className="font-mono font-semibold text-green-700">{getValue() as string}</span> },
    { header: "Nama Musim", accessorKey: "season_name" },
    { header: "Mulai", accessorKey: "start_date", cell: ({ getValue }) => <span className="text-xs">{formatDate(getValue() as string)}</span> },
    { header: "Akhir", accessorKey: "end_date", cell: ({ getValue }) => <span className="text-xs">{formatDate(getValue() as string)}</span> },
    { header: "Status", accessorKey: "status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];

  const locationColumns: ColumnDef<Location, unknown>[] = [
    { header: "Kode", accessorKey: "field_code", cell: ({ getValue }) => <span className="font-mono font-semibold text-green-700">{getValue() as string}</span> },
    { header: "Nama Kebun", accessorKey: "field_name" },
    { header: "Distrik/Kabupaten", id: "district", cell: ({ row }) => <span className="text-sm">{[row.original.district, row.original.regency].filter(Boolean).join(", ")}</span> },
    { header: "Provinsi", accessorKey: "province" },
    { header: "Luas (ha)", accessorKey: "area_hectares" },
    { header: "Status", accessorKey: "is_active", cell: ({ getValue }) => <StatusBadge status={getValue() ? "active" : "inactive"} /> },
  ];

  const storageColumns: ColumnDef<StorageUnit, unknown>[] = [
    { header: "Kode", accessorKey: "unit_code", cell: ({ getValue }) => <span className="font-mono font-semibold text-blue-700">{getValue() as string}</span> },
    { header: "Nama Unit", accessorKey: "unit_name" },
    { header: "Tipe", accessorKey: "unit_type" },
    { header: "Ruangan", accessorKey: "room_name" },
    { header: "Suhu (°C)", id: "temp", cell: ({ row }) => <span className="text-xs">{row.original.temperature_min} – {row.original.temperature_max}</span> },
    { header: "Status", accessorKey: "is_active", cell: ({ getValue }) => <StatusBadge status={getValue() ? "active" : "inactive"} /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Master Data"
        description="Kelola data referensi sistem: musim, lokasi, dan unit penyimpanan"
        actions={
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Tambah Data
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition whitespace-nowrap",
                activeTab === tab.id ? "text-green-700 border-b-2 border-green-600 bg-green-50/50" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "seasons" && (
            <DataTable
              data={(seasons as unknown as { data: Season[] })?.data ?? []}
              columns={seasonColumns}
              isLoading={seasonsLoading}
              searchPlaceholder="Cari musim..."
              emptyMessage="Belum ada data musim"
              getRowId={(row) => String(row.id)}
              onBulkDelete={(rows) => bulkDeleteSeasonsMutation.mutate(rows.map((r) => r.id))}
              isBulkDeleting={bulkDeleteSeasonsMutation.isPending}
            />
          )}
          {activeTab === "locations" && (
            <DataTable
              data={(locations as unknown as { data: Location[] })?.data ?? []}
              columns={locationColumns}
              isLoading={locationsLoading}
              searchPlaceholder="Cari lokasi..."
              emptyMessage="Belum ada data lokasi"
              getRowId={(row) => String(row.id)}
              onBulkDelete={(rows) => bulkDeleteLocationsMutation.mutate(rows.map((r) => r.id))}
              isBulkDeleting={bulkDeleteLocationsMutation.isPending}
            />
          )}
          {activeTab === "storage_units" && (
            <DataTable
              data={(storageUnits as unknown as { data: StorageUnit[] })?.data ?? []}
              columns={storageColumns}
              isLoading={unitsLoading}
              searchPlaceholder="Cari unit penyimpanan..."
              emptyMessage="Belum ada unit penyimpanan"
              getRowId={(row) => String(row.id)}
              onBulkDelete={(rows) => bulkDeleteStorageMutation.mutate(rows.map((r) => r.id))}
              isBulkDeleting={bulkDeleteStorageMutation.isPending}
            />
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">
                Tambah {activeTab === "seasons" ? "Musim Tanam" : activeTab === "locations" ? "Lokasi" : "Unit Penyimpanan"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              {activeTab === "seasons" && (
                <form onSubmit={seasonForm.handleSubmit((d) => createSeasonMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kode Musim *</label>
                      <input {...seasonForm.register("season_code")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="MH2026" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select {...seasonForm.register("status")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="upcoming">Akan Datang</option>
                        <option value="active">Aktif</option>
                        <option value="completed">Selesai</option>
                        <option value="cancelled">Dibatalkan</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Musim *</label>
                    <input {...seasonForm.register("season_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Musim Hujan 2026/2027" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mulai *</label>
                      <input {...seasonForm.register("start_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Akhir *</label>
                      <input {...seasonForm.register("end_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                    <button type="submit" disabled={createSeasonMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                      {createSeasonMutation.isPending ? "Menyimpan..." : "Tambah Musim"}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === "locations" && (
                <form onSubmit={locationForm.handleSubmit((d) => createLocationMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kode Lokasi *</label>
                      <input {...locationForm.register("field_code")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="JTIC002" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Provinsi *</label>
                      <input {...locationForm.register("province")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Jawa Barat" />
                      {locationForm.formState.errors.province && <p className="text-red-500 text-xs mt-1">{locationForm.formState.errors.province.message}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kebun/Lokasi *</label>
                    <input {...locationForm.register("field_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Kebun Percobaan ..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                      <input {...locationForm.register("latitude")} type="number" step="0.0000001" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="-6.9272" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                      <input {...locationForm.register("longitude")} type="number" step="0.0000001" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="107.7705" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kabupaten/Kota</label>
                      <input {...locationForm.register("regency")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Luas (ha)</label>
                      <input {...locationForm.register("area_hectares")} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                    <button type="submit" disabled={createLocationMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                      {createLocationMutation.isPending ? "Menyimpan..." : "Tambah Lokasi"}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === "storage_units" && (
                <form onSubmit={storageForm.handleSubmit((d) => createStorageMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kode Unit *</label>
                      <input {...storageForm.register("unit_code")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="RF003" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipe *</label>
                      <select {...storageForm.register("unit_type")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        {[["refrigerator", "Kulkas"], ["freezer", "Freezer"], ["cold_room", "Cold Room"], ["dry_room", "Ruang Kering"], ["cabinet", "Kabinet"], ["shelf", "Rak"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Unit *</label>
                    <input {...storageForm.register("unit_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Kulkas Lab Benih 3" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Suhu Min (°C)</label>
                      <input {...storageForm.register("temperature_min")} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Suhu Max (°C)</label>
                      <input {...storageForm.register("temperature_max")} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Rak</label>
                      <input {...storageForm.register("capacity_racks")} type="number" min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kotak per Rak</label>
                      <input {...storageForm.register("capacity_boxes_per_rack")} type="number" min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                    <button type="submit" disabled={createStorageMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                      {createStorageMutation.isPending ? "Menyimpan..." : "Tambah Unit"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
