"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Edit2, Key, X, Clock, CheckCircle, XCircle, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/lib/axios";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDateTime } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";

function roleName(r: unknown): string {
  if (!r) return "";
  if (typeof r === "string") return r;
  if (typeof r === "object" && r !== null && "name" in r) return String((r as { name: unknown }).name);
  return String(r);
}

// New role system (4 roles, replacing the old 5)
const NEW_ROLES: Record<string, { label: string; color: string; desc: string }> = {
  super_admin:  { label: "Super Admin",  color: "bg-purple-100 text-purple-700",  desc: "Akses penuh ke semua fitur" },
  researcher:   { label: "Researcher",   color: "bg-blue-100 text-blue-700",    desc: "Utama, Master Data, Pengamatan" },
  field_team:   { label: "Field Team",   color: "bg-green-100 text-green-700",  desc: "Pengamatan saja" },
  colaborator:  { label: "Colaborator",  color: "bg-teal-100 text-teal-700",    desc: "Pengamatan (lihat saja)" },
};

// Fallback display for legacy roles still in the DB
const LEGACY_ROLE_LABELS: Record<string, string> = {
  principal_researcher: "Peneliti Utama (lama)",
  field_researcher: "Peneliti Lapang (lama)",
  storage_officer: "Petugas Gudang (lama)",
  finance_staff: "Staf Keuangan (lama)",
};

function getRoleLabel(role: string): string {
  return NEW_ROLES[role]?.label ?? LEGACY_ROLE_LABELS[role] ?? role;
}
function getRoleColor(role: string): string {
  return NEW_ROLES[role]?.color ?? "bg-gray-100 text-gray-500";
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

const createSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  employee_id: z.string().optional(),
  phone: z.string().optional(),
  institution: z.string().optional(),
  role: z.string().min(1, "Pilih role"),
});

const editSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  employee_id: z.string().optional(),
  phone: z.string().optional(),
  institution: z.string().optional(),
  role: z.string().min(1, "Pilih role"),
  status: z.enum(["active", "inactive", "suspended"]),
});

const resetPwSchema = z.object({
  password: z.string().min(8, "Minimal 8 karakter"),
  password_confirmation: z.string().min(8),
}).refine(d => d.password === d.password_confirmation, {
  message: "Konfirmasi password tidak cocok", path: ["password_confirmation"],
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;
type ResetPwForm = z.infer<typeof resetPwSchema>;
type PendingApproveForm = { role: string };

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.roles?.includes("super_admin");

  const [tab, setTab] = useState<"active" | "pending">("active");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPwUser, setResetPwUser] = useState<User | null>(null);
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ data: User[] }>("/v1/users", { params: { per_page: 100 } }).then((r) => r.data),
  });
  const [roleSort, setRoleSort] = useState<"asc" | "desc" | null>(null);
  const rawUsers = data?.data ?? [];
  const users = roleSort
    ? [...rawUsers].sort((a, b) => {
        const ra = getRoleLabel(roleName(a.roles?.[0]));
        const rb = getRoleLabel(roleName(b.roles?.[0]));
        return roleSort === "asc" ? ra.localeCompare(rb) : rb.localeCompare(ra);
      })
    : rawUsers;

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["users-pending"],
    queryFn: () => api.get<{ data: User[] }>("/v1/users/pending", { params: { per_page: 50 } }).then((r) => r.data),
  });
  const pendingUsers = pendingData?.data ?? [];

  const approveForm = useForm<PendingApproveForm>({ defaultValues: { role: "field_team" } });

  const approveMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => api.post(`/v1/users/${id}/approve`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-pending"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Pengguna berhasil disetujui");
      setApprovingUser(null);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.post(`/v1/users/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-pending"] });
      toast.success("Pengguna ditolak");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Pengguna dihapus");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) as never });
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) as never });
  const resetPwForm = useForm<ResetPwForm>({ resolver: zodResolver(resetPwSchema) as never });

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => api.post("/v1/users", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success("Pengguna berhasil dibuat"); setIsCreateOpen(false); createForm.reset(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: EditForm }) => api.put(`/v1/users/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success("Pengguna berhasil diperbarui"); setEditingUser(null); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: ResetPwForm }) => api.post(`/v1/users/${id}/reset-password`, d),
    onSuccess: () => { toast.success("Password berhasil direset"); setResetPwUser(null); resetPwForm.reset(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const openEdit = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      name: user.name,
      employee_id: user.employee_id ?? "",
      phone: (user as User & { phone?: string }).phone ?? "",
      institution: (user as User & { institution?: string }).institution ?? "",
      role: roleName(user.roles?.[0]),
      status: (user.status as EditForm["status"]) ?? "active",
    });
  };

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
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) ?? "-"}</span>,
    },
    {
      header: "Institusi",
      accessorKey: "institution",
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) ?? "-"}</span>,
    },
    {
      id: "role",
      header: () => (
        <button
          onClick={() => setRoleSort(s => s === "asc" ? "desc" : s === "desc" ? null : "asc")}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 transition"
        >
          Role
          <span className="opacity-50 select-none">
            {roleSort === "asc" ? "↑" : roleSort === "desc" ? "↓" : "↕"}
          </span>
        </button>
      ),
      cell: ({ row }) => {
        const role = roleName(row.original.roles?.[0]);
        return role ? (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleColor(role)}`}>
            {getRoleLabel(role)}
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
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUser?.id;
        const targetIsSuperAdmin = roleName(row.original.roles?.[0]) === "super_admin";
        return (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setResetPwUser(row.original); resetPwForm.reset(); }} className="p-1.5 rounded hover:bg-orange-50 text-orange-500 transition" title="Reset Password">
              <Key className="w-3.5 h-3.5" />
            </button>
            {isSuperAdmin && !isSelf && !targetIsSuperAdmin && (
              <button
                onClick={() => {
                  if (confirm(`Hapus pengguna "${row.original.name}"? Tindakan ini tidak dapat dibatalkan.`))
                    deleteMutation.mutate(row.original.id);
                }}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded hover:bg-red-50 text-red-400 transition disabled:opacity-40"
                title="Hapus Pengguna"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    const role = roleName(u.roles?.[0]) || "unknown";
    acc[role] = (acc[role] ?? 0) + 1;
    return acc;
  }, {});

  const pendingColumns: ColumnDef<User, unknown>[] = [
    {
      header: "Pengguna",
      id: "user",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-amber-700">{row.original.name?.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium text-sm">{row.original.name}</p>
            <p className="text-xs text-gray-400">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Mendaftar",
      accessorKey: "created_at",
      cell: ({ getValue }) => <span className="text-xs text-gray-400">{formatDateTime(getValue() as string)}</span>,
    },
    {
      header: "Aksi",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setApprovingUser(row.original); approveForm.reset({ role: "field_team" }); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Setujui
          </button>
          <button
            onClick={() => { if (confirm(`Tolak pendaftaran ${row.original.name}?`)) rejectMutation.mutate(row.original.id); }}
            disabled={rejectMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
          >
            <XCircle className="w-3.5 h-3.5" /> Tolak
          </button>
        </div>
      ),
    },
  ];

  // Role options for dropdowns (new system only)
  const assignableRoles = Object.entries(NEW_ROLES).filter(([key]) => key !== "super_admin");

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Manajemen Pengguna"
        description="Kelola akun dan hak akses pengguna sistem"
        actions={
          tab === "active" && isSuperAdmin ? (
            <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
              <Plus className="w-4 h-4" /> Tambah Pengguna
            </button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("active")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "active" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Users className="w-4 h-4" /> Pengguna Aktif
        </button>
        <button
          onClick={() => setTab("pending")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "pending" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Clock className="w-4 h-4" /> Menunggu Persetujuan
          {pendingUsers.length > 0 && (
            <span className="ml-1 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingUsers.length}</span>
          )}
        </button>
      </div>

      {tab === "active" && (
        <>
          {/* Role summary — new 4-role system */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(NEW_ROLES).map(([role, info]) => (
              <div key={role} className={`rounded-xl border p-3 ${info.color} bg-opacity-30`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold">{roleCounts[role] ?? 0}</p>
                    <p className="text-xs font-semibold mt-0.5">{info.label}</p>
                  </div>
                  {role === "super_admin" && <ShieldAlert className="w-4 h-4 opacity-50 mt-0.5" />}
                </div>
                <p className="text-[10px] opacity-60 mt-1">{info.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-800">Daftar Pengguna</h2>
              <span className="ml-auto text-sm text-gray-400">{users.length} pengguna</span>
            </div>
            <DataTable data={users} columns={columns} isLoading={isLoading} searchPlaceholder="Cari nama atau email..." emptyMessage="Belum ada pengguna" />
          </div>
        </>
      )}

      {tab === "pending" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800">Pengguna Menunggu Persetujuan</h2>
            <span className="ml-auto text-sm text-gray-400">{pendingUsers.length} pengguna</span>
          </div>
          {pendingUsers.length === 0 && !pendingLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Tidak ada pengguna yang menunggu persetujuan</p>
          ) : (
            <DataTable data={pendingUsers} columns={pendingColumns} isLoading={pendingLoading} searchPlaceholder="Cari nama atau email..." emptyMessage="Tidak ada pengguna pending" />
          )}
        </div>
      )}

      {/* ── Create Modal ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Tambah Pengguna Baru</h3>
              <button onClick={() => { setIsCreateOpen(false); createForm.reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                  <input {...createForm.register("name")} className={inputCls} />
                  {createForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Karyawan</label>
                  <input {...createForm.register("employee_id")} className={inputCls} placeholder="EMP001" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input {...createForm.register("email")} type="email" className={inputCls} />
                {createForm.formState.errors.email && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input {...createForm.register("password")} type="password" className={inputCls} />
                {createForm.formState.errors.password && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.password.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institusi</label>
                  <input {...createForm.register("institution")} className={inputCls} placeholder="UNPAD" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select {...createForm.register("role")} className={inputCls}>
                    <option value="">-- Pilih Role --</option>
                    {assignableRoles.map(([v, info]) => <option key={v} value={v}>{info.label} — {info.desc}</option>)}
                  </select>
                  {createForm.formState.errors.role && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.role.message}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsCreateOpen(false); createForm.reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {createMutation.isPending ? "Menyimpan..." : "Buat Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold">Edit Pengguna</h3>
                <p className="text-sm text-gray-400 mt-0.5">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={editForm.handleSubmit(d => editMutation.mutate({ id: editingUser.id, d }))} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                  <input {...editForm.register("name")} className={inputCls} />
                  {editForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{editForm.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Karyawan</label>
                  <input {...editForm.register("employee_id")} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                  <input {...editForm.register("phone")} className={inputCls} placeholder="+62..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institusi</label>
                  <input {...editForm.register("institution")} className={inputCls} placeholder="UNPAD" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select {...editForm.register("role")} className={inputCls}>
                    {Object.entries(NEW_ROLES).map(([v, info]) => <option key={v} value={v}>{info.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select {...editForm.register("status")} className={inputCls}>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                    <option value="suspended">Ditangguhkan</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={editMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {editMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Approve Modal ── */}
      {approvingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold">Setujui Pengguna</h3>
                <p className="text-sm text-gray-400 mt-0.5">{approvingUser.name}</p>
              </div>
              <button onClick={() => setApprovingUser(null)} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={approveForm.handleSubmit(d => approveMutation.mutate({ id: approvingUser.id, role: d.role }))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Role *</label>
                <div className="space-y-2">
                  {assignableRoles.map(([v, info]) => (
                    <label key={v} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer has-[:checked]:border-green-500 has-[:checked]:bg-green-50 transition">
                      <input type="radio" {...approveForm.register("role")} value={v} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{info.label}</p>
                        <p className="text-xs text-gray-400">{info.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setApprovingUser(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={approveMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {approveMutation.isPending ? "Menyetujui..." : "Setujui"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetPwUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold">Reset Password</h3>
                <p className="text-sm text-gray-400 mt-0.5">{resetPwUser.name}</p>
              </div>
              <button onClick={() => { setResetPwUser(null); resetPwForm.reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={resetPwForm.handleSubmit(d => resetPwMutation.mutate({ id: resetPwUser.id, d }))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru *</label>
                <input {...resetPwForm.register("password")} type="password" className={inputCls} />
                {resetPwForm.formState.errors.password && <p className="text-red-500 text-xs mt-1">{resetPwForm.formState.errors.password.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password *</label>
                <input {...resetPwForm.register("password_confirmation")} type="password" className={inputCls} />
                {resetPwForm.formState.errors.password_confirmation && <p className="text-red-500 text-xs mt-1">{resetPwForm.formState.errors.password_confirmation.message}</p>}
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setResetPwUser(null); resetPwForm.reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={resetPwMutation.isPending} className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                  {resetPwMutation.isPending ? "Mereset..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
