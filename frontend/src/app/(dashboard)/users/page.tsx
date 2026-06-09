"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Edit2, Key, X } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/lib/axios";

// Spatie may return full Role objects OR plain strings depending on the endpoint.
// This helper normalises either shape to a plain string.
function roleName(r: unknown): string {
  if (!r) return "";
  if (typeof r === "string") return r;
  if (typeof r === "object" && r !== null && "name" in r) return String((r as { name: unknown }).name);
  return String(r);
}
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { User } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDateTime } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password minimal 8 karakter"),
  employee_id: z.string().optional(),
  phone: z.string().optional(),
  institution: z.string().optional(),
  role: z.string().min(1, "Pilih role"),
});

type CreateForm = z.infer<typeof createSchema>;

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  principal_researcher: "Peneliti Utama",
  field_researcher: "Peneliti Lapang",
  storage_officer: "Petugas Gudang",
  finance_staff: "Staf Keuangan",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  principal_researcher: "bg-blue-100 text-blue-700",
  field_researcher: "bg-green-100 text-green-700",
  storage_officer: "bg-yellow-100 text-yellow-700",
  finance_staff: "bg-orange-100 text-orange-700",
};

export default function UsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ data: User[] }>("/v1/users", { params: { per_page: 50 } }).then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => api.post("/v1/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Pengguna berhasil dibuat");
      setIsModalOpen(false);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/v1/users/${id}`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success("Status diperbarui"); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const users = data?.data ?? [];

  const columns: ColumnDef<User, unknown>[] = [
    {
      header: "Pengguna",
      id: "user",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-green-700">{row.original.name?.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium text-sm">{row.original.name}</p>
            <p className="text-xs text-gray-400">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "ID Karyawan",
      accessorKey: "employee_id",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string ?? "-"}</span>,
    },
    {
      header: "Institusi",
      accessorKey: "institution",
      cell: ({ getValue }) => <span className="text-xs">{getValue() as string ?? "-"}</span>,
    },
    {
      header: "Role",
      id: "role",
      cell: ({ row }) => {
        const role = roleName(row.original.roles?.[0]);
        return role ? (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColors[role] ?? "bg-gray-100 text-gray-600"}`}>
            {roleLabels[role] ?? role}
          </span>
        ) : <span className="text-gray-300">-</span>;
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      header: "Login Terakhir",
      accessorKey: "last_login_at",
      cell: ({ getValue }) => <span className="text-xs text-gray-400">{formatDateTime(getValue() as string)}</span>,
    },
    {
      header: "Aksi",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded hover:bg-orange-50 text-orange-500 transition" title="Reset Password"><Key className="w-3.5 h-3.5" /></button>
          {row.original.status === "active" ? (
            <button onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: "inactive" })} className="p-1.5 rounded hover:bg-red-50 text-red-400 transition text-xs">Nonaktifkan</button>
          ) : (
            <button onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: "active" })} className="p-1.5 rounded hover:bg-green-50 text-green-600 transition text-xs">Aktifkan</button>
          )}
        </div>
      ),
    },
  ];

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    const role = roleName(u.roles?.[0]) || "unknown";
    acc[role] = (acc[role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Manajemen Pengguna"
        description="Kelola akun dan hak akses pengguna sistem"
        actions={
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Tambah Pengguna
          </button>
        }
      />

      {/* Role summary */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(roleLabels).map(([role, label]) => (
          <div key={role} className={`rounded-xl border p-3 text-center ${roleColors[role]?.replace("text-", "border-") ?? "border-gray-200"} border-opacity-50`}>
            <p className="text-xl font-bold">{roleCounts[role] ?? 0}</p>
            <p className="text-xs mt-0.5 opacity-80">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold text-gray-800">Daftar Pengguna</h2>
          <span className="ml-auto text-sm text-gray-400">{users.length} pengguna</span>
        </div>
        <DataTable
          data={users}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Cari nama atau email..."
          emptyMessage="Belum ada pengguna"
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Tambah Pengguna Baru</h3>
              <button onClick={() => { setIsModalOpen(false); reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                  <input {...register("name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Karyawan</label>
                  <input {...register("employee_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="EMP001" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input {...register("email")} type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input {...register("password")} type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institusi</label>
                  <input {...register("institution")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="UNPAD" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select {...register("role")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Role --</option>
                    {Object.entries(roleLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsModalOpen(false); reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {isSubmitting ? "Menyimpan..." : "Buat Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
