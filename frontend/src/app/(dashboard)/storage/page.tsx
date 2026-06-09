"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, Thermometer, Droplets, AlertTriangle, Eye, ArrowRightLeft, RefreshCw, X, QrCode, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { storageService } from "@/services/storage.service";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { SeedInventory, StorageUnit } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { getApiErrorMessage } from "@/lib/axios";
import { formatDate, formatWeight, cn } from "@/lib/utils";
import api from "@/lib/axios";

const toOptionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

const inventorySchema = z.object({
  genotype_id: z.preprocess(Number, z.number().min(1, "Pilih genotipe")),
  storage_unit_id: z.preprocess(Number, z.number().min(1, "Pilih unit penyimpanan")),
  rack_label: z.string().optional(),
  box_number: z.string().optional(),
  storage_date: z.string().min(1, "Tanggal penyimpanan wajib diisi"),
  harvest_date: z.string().optional(),
  expiry_date: z.string().optional(),
  initial_weight_g: z.preprocess(Number, z.number().min(0.01, "Berat awal wajib diisi")),
  remaining_weight_g: z.preprocess(Number, z.number().min(0)),
  moisture_content: z.preprocess(toOptionalNumber, z.number().min(0).max(100).optional()),
  germination_percentage: z.preprocess(toOptionalNumber, z.number().min(0).max(100).optional()),
  seed_count: z.preprocess(toOptionalNumber, z.number().optional()),
  notes: z.string().optional(),
});

const unitSchema = z.object({
  unit_name: z.string().min(1, "Nama unit wajib diisi"),
  unit_type: z.string().min(1, "Tipe unit wajib dipilih"),
  room_name: z.string().optional(),
  temperature_min: z.preprocess(toOptionalNumber, z.number().optional()),
  temperature_max: z.preprocess(toOptionalNumber, z.number().optional()),
  humidity_min: z.preprocess(toOptionalNumber, z.number().optional()),
  humidity_max: z.preprocess(toOptionalNumber, z.number().optional()),
  capacity_racks: z.preprocess(toOptionalNumber, z.number().optional()),
  capacity_boxes_per_rack: z.preprocess(toOptionalNumber, z.number().optional()),
});

type UnitForm = z.infer<typeof unitSchema>;

const movementSchema = z.object({
  movement_type: z.enum(["out_planting", "out_laboratory", "out_distribution", "out_discard", "in_return", "adjustment"]),
  quantity_g: z.preprocess(Number, z.number().min(0.01, "Jumlah wajib diisi")),
  movement_date: z.string().min(1, "Tanggal wajib diisi"),
  destination: z.string().optional(),
  recipient_name: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type InventoryForm = z.infer<typeof inventorySchema>;
type MovementForm = z.infer<typeof movementSchema>;

const movementTypeLabels: Record<string, string> = {
  out_planting: "Digunakan untuk Tanam",
  out_laboratory: "Penggunaan Lab",
  out_distribution: "Distribusi",
  out_discard: "Dibuang",
  in_return: "Pengembalian",
  adjustment: "Penyesuaian",
};

export default function StoragePage() {
  const [activeTab, setActiveTab] = useState<"inventory" | "units">("inventory");
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<SeedInventory | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<SeedInventory | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<StorageUnit | null>(null);
  const queryClient = useQueryClient();

  const { data: dashboardData } = useQuery({
    queryKey: ["storage-dashboard"],
    queryFn: () => storageService.getDashboard().then((r) => r.data),
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ["storage-inventory"],
    queryFn: () => storageService.getInventory({ per_page: 100 }).then((r) => r.data as { data: SeedInventory[] }),
  });

  const { data: unitsData, isLoading: unitsLoading } = useQuery({
    queryKey: ["storage-units"],
    queryFn: () => storageService.getUnits({ all: true }).then((r) => r.data as StorageUnit[]),
  });

  const { data: genotypesData } = useQuery({
    queryKey: ["genotypes-simple"],
    queryFn: () => api.get("/v1/genotypes?all=true").then((r) => r.data as Array<{ id: number; genotype_code: string; genotype_name: string }>),
  });

  const inventoryForm = useForm<InventoryForm>({
    resolver: zodResolver(inventorySchema),
    defaultValues: { remaining_weight_g: 0, storage_date: new Date().toISOString().slice(0, 10) },
  });

  const movementForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { movement_date: new Date().toISOString().slice(0, 10) },
  });

  const unitForm = useForm<UnitForm>({
    resolver: zodResolver(unitSchema),
  });

  const createInventoryMutation = useMutation({
    mutationFn: (data: InventoryForm) => storageService.createInventory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
      toast.success("Inventaris berhasil ditambahkan");
      setIsInventoryModalOpen(false);
      inventoryForm.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateInventoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InventoryForm> }) =>
      api.put(`/v1/storage/inventory/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
      toast.success("Inventaris diperbarui");
      setIsInventoryModalOpen(false);
      setEditingInventory(null);
      inventoryForm.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEditInventory = (inv: SeedInventory) => {
    setEditingInventory(inv);
    inventoryForm.reset({
      genotype_id: inv.genotype?.id ?? 0,
      storage_unit_id: inv.storage_unit?.id ?? 0,
      rack_label: inv.rack_label ?? "",
      box_number: inv.box_number ?? "",
      storage_date: inv.storage_date ?? "",
      harvest_date: inv.harvest_date ?? "",
      expiry_date: inv.expiry_date ?? "",
      initial_weight_g: parseFloat(String(inv.initial_weight_g ?? 0)),
      remaining_weight_g: parseFloat(String(inv.remaining_weight_g ?? 0)),
      moisture_content: inv.moisture_content ? parseFloat(String(inv.moisture_content)) : undefined,
      germination_percentage: inv.germination_percentage ? parseFloat(String(inv.germination_percentage)) : undefined,
      notes: inv.notes ?? "",
    });
    setIsInventoryModalOpen(true);
  };

  const createUnitMutation = useMutation({
    mutationFn: (data: UnitForm) => api.post("/v1/storage/units", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-units"] });
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
      toast.success("Unit penyimpanan dibuat");
      setIsUnitModalOpen(false);
      setEditingUnit(null);
      unitForm.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UnitForm> }) =>
      api.put(`/v1/storage/units/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-units"] });
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
      toast.success("Unit penyimpanan diperbarui");
      setIsUnitModalOpen(false);
      setEditingUnit(null);
      unitForm.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEditUnit = (unit: StorageUnit) => {
    setEditingUnit(unit);
    unitForm.reset({
      unit_name: unit.unit_name,
      unit_type: unit.unit_type,
      room_name: unit.room_name ?? "",
      temperature_min: unit.temperature_min ?? undefined,
      temperature_max: unit.temperature_max ?? undefined,
      humidity_min: unit.humidity_min ?? undefined,
      humidity_max: unit.humidity_max ?? undefined,
      capacity_racks: unit.capacity_racks ?? undefined,
      capacity_boxes_per_rack: unit.capacity_boxes_per_rack ?? undefined,
    });
    setIsUnitModalOpen(true);
  };

  const recordMovementMutation = useMutation({
    mutationFn: (data: MovementForm) => storageService.recordMovement(selectedInventory!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["storage-dashboard"] });
      toast.success("Pergerakan benih berhasil dicatat");
      setIsMovementModalOpen(false);
      setSelectedInventory(null);
      movementForm.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const inventory = inventoryData?.data ?? [];
  const units = (unitsData as StorageUnit[]) ?? [];

  const inventoryColumns: ColumnDef<SeedInventory, unknown>[] = [
    {
      header: "Kode Paket",
      accessorKey: "package_code",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <QrCode className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-mono text-xs font-semibold text-blue-700">{row.original.package_code}</span>
        </div>
      ),
    },
    {
      header: "Genotipe",
      accessorKey: "genotype.genotype_name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.genotype?.genotype_name}</p>
          <p className="text-xs text-gray-400 font-mono">{row.original.genotype?.genotype_code}</p>
        </div>
      ),
    },
    {
      header: "Lokasi",
      id: "location",
      cell: ({ row }) => (
        <div className="text-xs">
          <p className="font-medium">{row.original.storage_unit?.unit_name}</p>
          <p className="text-gray-400">
            {[row.original.rack_label, row.original.box_number].filter(Boolean).join(" / ") || "-"}
          </p>
        </div>
      ),
    },
    {
      header: "Berat Sisa",
      id: "remaining",
      cell: ({ row }) => {
        const remaining = parseFloat(String(row.original.remaining_weight_g ?? 0));
        const initial   = parseFloat(String(row.original.initial_weight_g   ?? 0));
        const ratio = initial > 0 ? remaining / initial : 0;
        return (
          <div>
            <p className="font-semibold">{formatWeight(remaining)}</p>
            <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
              <div
                className={cn("h-full rounded-full", ratio > 0.5 ? "bg-green-500" : ratio > 0.2 ? "bg-yellow-500" : "bg-red-500")}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: "Kadar Air",
      accessorKey: "moisture_content",
      cell: ({ getValue }) => {
        const v = getValue() as number | undefined;
        if (!v) return <span className="text-gray-300">-</span>;
        return (
          <span className={cn("text-sm font-medium", v > 14 ? "text-red-600" : "text-green-600")}>
            {v}%
          </span>
        );
      },
    },
    {
      header: "Kecambah",
      accessorKey: "germination_percentage",
      cell: ({ getValue }) => {
        const v = getValue() as number | undefined;
        return v ? <span className="text-sm">{v}%</span> : <span className="text-gray-300">-</span>;
      },
    },
    {
      header: "Status",
      accessorKey: "storage_status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      header: "Simpan",
      accessorKey: "storage_date",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{formatDate(getValue() as string)}</span>,
    },
    {
      header: "Aksi",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditInventory(row.original)}
            className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600 transition"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setSelectedInventory(row.original); setIsMovementModalOpen(true); }}
            className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition"
            title="Catat Pergerakan"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setSelectedInventory(row.original); setIsDetailOpen(true); }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition"
            title="Lihat Detail"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Monitoring Penyimpanan Benih"
        description="Pantau inventaris, kondisi, dan pergerakan benih jagung"
        actions={
          <button onClick={() => setIsInventoryModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Tambah Inventaris
          </button>
        }
      />

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Inventaris", value: dashboardData?.totalInventory ?? 0, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
          { title: "Stok Rendah", value: dashboardData?.lowStock ?? 0, icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
          { title: "Kadar Air Tinggi", value: dashboardData?.highMoisture ?? 0, icon: Droplets, color: "text-red-600", bg: "bg-red-50" },
          { title: "Segera Kadaluarsa", value: dashboardData?.expiredSoon ?? 0, icon: RefreshCw, color: "text-orange-600", bg: "bg-orange-50" },
        ].map((card) => (
          <div key={card.title} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{card.value}</p>
              </div>
              <div className={cn("p-2 rounded-lg", card.bg)}>
                <card.icon className={cn("w-5 h-5", card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Storage Units Occupancy */}
      {(dashboardData?.storageUnits ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-blue-500" />
            Kapasitas Unit Penyimpanan
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboardData?.storageUnits?.map((unit) => (
              <div key={unit.id} className="p-3 border border-gray-100 rounded-lg">
                <p className="text-sm font-medium text-gray-800 truncate">{unit.name}</p>
                <p className="text-xs text-gray-400 font-mono">{unit.code}</p>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{unit.used}/{unit.capacity}</span>
                    <span>{unit.occupancy_rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div
                      className={cn("h-full rounded-full transition-all", unit.occupancy_rate > 80 ? "bg-red-500" : unit.occupancy_rate > 60 ? "bg-yellow-500" : "bg-green-500")}
                      style={{ width: `${unit.occupancy_rate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(["inventory", "units"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-3.5 text-sm font-medium transition",
                activeTab === tab ? "text-green-700 border-b-2 border-green-600 bg-green-50/50" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab === "inventory" ? "Inventaris Benih" : "Unit Penyimpanan"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "inventory" && (
            <DataTable
              data={inventory}
              columns={inventoryColumns}
              isLoading={inventoryLoading}
              searchPlaceholder="Cari kode paket atau genotipe..."
              emptyMessage="Belum ada inventaris benih"
            />
          )}

          {activeTab === "units" && (
            <>
              <div className="flex justify-end mb-4">
                <button onClick={() => { setEditingUnit(null); unitForm.reset(); setIsUnitModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
                  <Plus className="w-4 h-4" /> Tambah Unit
                </button>
              </div>
              <DataTable
                data={units}
                columns={[
                  { header: "Kode", accessorKey: "unit_code", cell: ({ getValue }) => <span className="font-mono font-semibold text-blue-700">{getValue() as string}</span> },
                  { header: "Nama Unit", accessorKey: "unit_name" },
                  { header: "Tipe", accessorKey: "unit_type" },
                  { header: "Ruangan", accessorKey: "room_name" },
                  {
                    header: "Suhu Range",
                    id: "temp",
                    cell: ({ row }) => (
                      row.original.temperature_min || row.original.temperature_max
                        ? <span className="text-sm"><Thermometer className="w-3 h-3 inline text-blue-400" /> {row.original.temperature_min}°C – {row.original.temperature_max}°C</span>
                        : <span className="text-gray-300">-</span>
                    ),
                  },
                  {
                    header: "Kapasitas",
                    id: "capacity",
                    cell: ({ row }) => (
                      <span className="text-sm">{row.original.active_inventory_count ?? 0} / {(row.original.capacity_racks ?? 0) * (row.original.capacity_boxes_per_rack ?? 1)}</span>
                    ),
                  },
                  { header: "Status", accessorKey: "is_active", cell: ({ getValue }) => <StatusBadge status={getValue() ? "active" : "inactive"} /> },
                  {
                    header: "Aksi",
                    id: "unit_actions",
                    cell: ({ row }) => (
                      <button onClick={() => openEditUnit(row.original)} className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600 transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    ),
                  },
                ]}
                isLoading={unitsLoading}
                emptyMessage="Belum ada unit penyimpanan"
              />
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Inventory Modal */}
      {isInventoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingInventory ? "Edit Inventaris Benih" : "Tambah Inventaris Benih"}</h3>
              <button onClick={() => { setIsInventoryModalOpen(false); setEditingInventory(null); inventoryForm.reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={inventoryForm.handleSubmit((d) => {
              const data = d as InventoryForm;
              if (editingInventory) updateInventoryMutation.mutate({ id: editingInventory.id, data });
              else createInventoryMutation.mutate(data);
            })} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Genotipe *</label>
                  <select {...inventoryForm.register("genotype_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Genotipe --</option>
                    {genotypesData?.map((g) => <option key={g.id} value={g.id}>{g.genotype_code} - {g.genotype_name}</option>)}
                  </select>
                  {inventoryForm.formState.errors.genotype_id && <p className="text-red-500 text-xs mt-1">{inventoryForm.formState.errors.genotype_id.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Penyimpanan *</label>
                  <select {...inventoryForm.register("storage_unit_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Unit --</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.unit_code} - {u.unit_name}</option>)}
                  </select>
                  {inventoryForm.formState.errors.storage_unit_id && <p className="text-red-500 text-xs mt-1">{inventoryForm.formState.errors.storage_unit_id.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rak</label>
                  <input {...inventoryForm.register("rack_label")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. A1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Kotak</label>
                  <input {...inventoryForm.register("box_number")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. B-03" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Simpan *</label>
                  <input {...inventoryForm.register("storage_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  {inventoryForm.formState.errors.storage_date && <p className="text-red-500 text-xs mt-1">{inventoryForm.formState.errors.storage_date.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Panen</label>
                  <input {...inventoryForm.register("harvest_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Berat Awal (g) *</label>
                  <input {...inventoryForm.register("initial_weight_g")} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" onChange={(e) => { inventoryForm.setValue("remaining_weight_g", parseFloat(e.target.value) || 0); }} />
                  {inventoryForm.formState.errors.initial_weight_g && <p className="text-red-500 text-xs mt-1">{inventoryForm.formState.errors.initial_weight_g.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Berat Sisa (g) *</label>
                  <input {...inventoryForm.register("remaining_weight_g")} type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kadar Air (%)</label>
                  <input {...inventoryForm.register("moisture_content")} type="number" step="0.01" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daya Kecambah (%)</label>
                  <input {...inventoryForm.register("germination_percentage")} type="number" step="0.1" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.0" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <textarea {...inventoryForm.register("notes")} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="Catatan tambahan..." />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsInventoryModalOpen(false); setEditingInventory(null); inventoryForm.reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createInventoryMutation.isPending || updateInventoryMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {(createInventoryMutation.isPending || updateInventoryMutation.isPending) ? "Menyimpan..." : editingInventory ? "Simpan Perubahan" : "Tambah Inventaris"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {isMovementModalOpen && selectedInventory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold">Catat Pergerakan Benih</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selectedInventory.package_code} · Sisa: {formatWeight(selectedInventory.remaining_weight_g)}</p>
              </div>
              <button onClick={() => { setIsMovementModalOpen(false); setSelectedInventory(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={movementForm.handleSubmit((d) => recordMovementMutation.mutate(d))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Pergerakan *</label>
                <select {...movementForm.register("movement_type")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {Object.entries(movementTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (g) *</label>
                  <input {...movementForm.register("quantity_g")} type="number" step="0.01" min="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                  {movementForm.formState.errors.quantity_g && <p className="text-red-500 text-xs mt-1">{movementForm.formState.errors.quantity_g.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                  <input {...movementForm.register("movement_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tujuan/Penerima</label>
                <input {...movementForm.register("destination")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Lab / Kebun / Institusi" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alasan</label>
                <textarea {...movementForm.register("reason")} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="Alasan pergerakan benih..." />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsMovementModalOpen(false); setSelectedInventory(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={recordMovementMutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition">
                  {recordMovementMutation.isPending ? "Menyimpan..." : "Catat Pergerakan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit Create / Edit Modal */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingUnit ? "Edit Unit Penyimpanan" : "Tambah Unit Penyimpanan"}</h3>
              <button onClick={() => { setIsUnitModalOpen(false); setEditingUnit(null); unitForm.reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={unitForm.handleSubmit((d) => {
              const data = d as UnitForm;
              if (editingUnit) updateUnitMutation.mutate({ id: editingUnit.id, data });
              else createUnitMutation.mutate(data);
            })} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Unit *</label>
                  <input {...unitForm.register("unit_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. Cold Room A" />
                  {unitForm.formState.errors.unit_name && <p className="text-red-500 text-xs mt-1">{unitForm.formState.errors.unit_name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Unit *</label>
                  <select {...unitForm.register("unit_type")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Tipe --</option>
                    <option value="cold_room">Cold Room</option>
                    <option value="freezer">Freezer</option>
                    <option value="refrigerator">Kulkas</option>
                    <option value="dry_room">Gudang Kering</option>
                    <option value="cabinet">Lemari</option>
                    <option value="shelf">Rak</option>
                  </select>
                  {unitForm.formState.errors.unit_type && <p className="text-red-500 text-xs mt-1">{unitForm.formState.errors.unit_type.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Ruangan</label>
                <input {...unitForm.register("room_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. Gedung Pascapanen Lt. 2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suhu Min (°C)</label>
                  <input {...unitForm.register("temperature_min")} type="number" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suhu Max (°C)</label>
                  <input {...unitForm.register("temperature_max")} type="number" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kapasitas Rak</label>
                  <input {...unitForm.register("capacity_racks")} type="number" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kotak per Rak</label>
                  <input {...unitForm.register("capacity_boxes_per_rack")} type="number" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsUnitModalOpen(false); setEditingUnit(null); unitForm.reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createUnitMutation.isPending || updateUnitMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {(createUnitMutation.isPending || updateUnitMutation.isPending) ? "Menyimpan..." : editingUnit ? "Simpan Perubahan" : "Buat Unit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Detail Modal */}
      {isDetailOpen && selectedInventory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between p-6 border-b">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-blue-700 font-bold">{selectedInventory.package_code}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", selectedInventory.storage_status === "good" ? "bg-green-100 text-green-700" : selectedInventory.storage_status === "warning" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                    {selectedInventory.storage_status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold">{selectedInventory.genotype?.genotype_name}</h3>
                <p className="text-sm text-gray-500 font-mono">{selectedInventory.genotype?.genotype_code}</p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Location */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Lokasi Penyimpanan</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    ["Unit", selectedInventory.storage_unit?.unit_name ?? "—"],
                    ["Rak", selectedInventory.rack_label ?? "—"],
                    ["Kotak", selectedInventory.box_number ?? "—"],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-blue-50 rounded-lg p-2.5">
                      <p className="text-blue-400">{l}</p>
                      <p className="font-semibold text-blue-800">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weight */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Data Berat</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ["Berat Awal", formatWeight(selectedInventory.initial_weight_g)],
                    ["Berat Sisa", formatWeight(selectedInventory.remaining_weight_g)],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400">{l}</p>
                      <p className="font-bold text-lg text-gray-800">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Penggunaan</span>
                    <span>{selectedInventory.usage_percentage?.toFixed(1) ?? "0"}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: Math.min(100, parseFloat(String(selectedInventory.usage_percentage ?? 0))) + "%" }} />
                  </div>
                </div>
              </div>

              {/* Quality */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Kualitas Benih</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    ["Kadar Air", selectedInventory.moisture_content ? selectedInventory.moisture_content + "%" : "—"],
                    ["Daya Kecambah", selectedInventory.germination_percentage ? selectedInventory.germination_percentage + "%" : "—"],
                    ["Vigor Index", selectedInventory.vigor_index ? String(selectedInventory.vigor_index) : "—"],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400">{l}</p>
                      <p className="font-semibold text-gray-800">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Tanggal</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    ["Panen", formatDate(selectedInventory.harvest_date)],
                    ["Simpan", formatDate(selectedInventory.storage_date)],
                    ["Kadaluarsa", formatDate(selectedInventory.expiry_date)],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-gray-400">{l}</p>
                      <p className="font-semibold text-gray-800">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* QR/Barcode */}
              <div className="flex gap-3">
                {selectedInventory.qr_code && (
                  <div className="bg-gray-50 rounded-lg p-2.5 text-xs flex-1">
                    <p className="text-gray-400">QR Code</p>
                    <p className="font-mono text-gray-700">{selectedInventory.qr_code}</p>
                  </div>
                )}
                {selectedInventory.barcode && (
                  <div className="bg-gray-50 rounded-lg p-2.5 text-xs flex-1">
                    <p className="text-gray-400">Barcode</p>
                    <p className="font-mono text-gray-700">{selectedInventory.barcode}</p>
                  </div>
                )}
              </div>

              {selectedInventory.notes && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                  <p className="font-semibold text-xs mb-1">Catatan</p>
                  {selectedInventory.notes}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => { setIsDetailOpen(false); setIsMovementModalOpen(true); }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Catat Pergerakan
                </button>
                <button onClick={() => setIsDetailOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
