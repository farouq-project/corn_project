"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Edit2, Microscope, ToggleLeft, ToggleRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";
import type { Characteristic } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";

const schema = z.object({
  code: z.string().min(1, "Kode wajib diisi").max(20).toUpperCase(),
  name: z.string().min(1, "Nama karakter wajib diisi"),
  group: z.string().optional(),
  unit: z.string().max(20).optional(),
  method_description: z.string().optional(),
  decimal_places: z.coerce.number().int().min(0).max(6).default(2),
  display_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

const GROUP_OPTIONS = ["Vegetatif", "Komponen Hasil", "Morfologi", "Fisiologi", "Kualitas"];

export default function PengamatanPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Characteristic | null>(null);
  const queryClient = useQueryClient();

  const { data: chars = [], isLoading } = useQuery({
    queryKey: ["characteristics-all"],
    queryFn: () => api.get<Characteristic[]>("/v1/phenotyping/characteristics").then((r) => r.data),
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { decimal_places: 2, display_order: 0, is_active: true },
  });

  const isActive = watch("is_active");

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post("/v1/phenotyping/characteristics", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["characteristics-all"] }); queryClient.invalidateQueries({ queryKey: ["characteristics"] }); toast.success("Karakter berhasil ditambahkan"); closeModal(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormData> }) => api.put(`/v1/phenotyping/characteristics/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["characteristics-all"] }); queryClient.invalidateQueries({ queryKey: ["characteristics"] }); toast.success("Karakter berhasil diperbarui"); closeModal(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/phenotyping/characteristics/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["characteristics-all"] });
      queryClient.invalidateQueries({ queryKey: ["characteristics"] });
      toast.success("Karakter dihapus (atau dinonaktifkan jika masih digunakan)");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const openCreate = () => {
    setEditing(null);
    reset({ decimal_places: 2, display_order: 0, is_active: true });
    setIsModalOpen(true);
  };

  const openEdit = (c: Characteristic) => {
    setEditing(c);
    reset({
      code: c.code,
      name: c.name,
      group: c.group ?? "",
      unit: c.unit ?? "",
      method_description: (c as Characteristic & { method_description?: string }).method_description ?? "",
      decimal_places: c.decimal_places,
      display_order: c.display_order,
      is_active: c.is_active,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditing(null); reset(); };

  const onSubmit = (data: FormData) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const columns: ColumnDef<Characteristic, unknown>[] = [
    {
      header: "Kode",
      accessorKey: "code",
      cell: ({ getValue }) => <span className="font-mono font-bold text-green-700">{getValue() as string}</span>,
    },
    { header: "Karakter", accessorKey: "name" },
    {
      header: "Kelompok",
      accessorKey: "group",
      cell: ({ getValue }) => {
        const g = getValue() as string | undefined;
        return g ? <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{g}</span> : <span className="text-gray-300">—</span>;
      },
    },
    {
      header: "Satuan",
      accessorKey: "unit",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{(getValue() as string) || "—"}</span>,
    },
    {
      header: "Desimal",
      accessorKey: "decimal_places",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() as number}</span>,
    },
    {
      header: "Status",
      accessorKey: "is_active",
      cell: ({ getValue }) => getValue()
        ? <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">Aktif</span>
        : <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">Nonaktif</span>,
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
            onClick={() => { if (confirm(`Hapus karakter "${row.original.code}"?`)) deleteMutation.mutate(row.original.id); }}
            className="p-1.5 rounded hover:bg-red-50 text-red-400 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const groups = Array.from(new Set(chars.map((c) => c.group).filter(Boolean)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Master Pengamatan"
        description="Daftar karakteristik/variabel pengamatan fenotipe. Menambah atau mengubah data di sini akan otomatis mengubah kolom pada grid Data Pengamatan."
        actions={
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
            <Plus className="w-4 h-4" />
            Tambah Karakter
          </button>
        }
      />

      {/* Group summary chips */}
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <span key={g} className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              {g} ({chars.filter((c) => c.group === g).length})
            </span>
          ))}
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs">
            Total: {chars.length} karakter · {chars.filter((c) => c.is_active).length} aktif
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <DataTable
          data={chars}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Cari kode atau nama karakter..."
          emptyMessage="Belum ada karakter pengamatan. Klik Tambah Karakter untuk memulai."
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <Microscope className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold">{editing ? "Edit Karakter" : "Tambah Karakter Baru"}</h3>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode *</label>
                  <input
                    {...register("code")}
                    disabled={!!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 uppercase disabled:bg-gray-50"
                    placeholder="TT"
                  />
                  {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kelompok</label>
                  <input
                    {...register("group")}
                    list="group-suggestions"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Vegetatif"
                  />
                  <datalist id="group-suggestions">
                    {GROUP_OPTIONS.map((g) => <option key={g} value={g} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Karakter *</label>
                <input
                  {...register("name")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Tinggi Tanaman"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pengamatan</label>
                <textarea
                  {...register("method_description")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Cara pengukuran, alat yang digunakan, kondisi pengukuran..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <input
                    {...register("unit")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="cm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desimal</label>
                  <input
                    {...register("decimal_places")}
                    type="number"
                    min="0"
                    max="6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
                  <input
                    {...register("display_order")}
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setValue("is_active", !isActive)}
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition", isActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500")}
                >
                  {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {isActive ? "Aktif" : "Nonaktif"}
                </button>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition"
                >
                  {editing ? "Simpan Perubahan" : "Tambah Karakter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
