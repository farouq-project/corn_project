"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuthStore } from "@/store/authStore";

const profileSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid"),
  phone: z.string().optional(),
  institution: z.string().optional(),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, "Password lama wajib diisi"),
  password: z.string().min(8, "Password baru minimal 8 karakter"),
  password_confirmation: z.string().min(1, "Konfirmasi password wajib diisi"),
}).refine((d) => d.password === d.password_confirmation, {
  message: "Konfirmasi password tidak cocok",
  path: ["password_confirmation"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema) as never,
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: (user as { phone?: string })?.phone ?? "",
      institution: (user as { institution?: string })?.institution ?? "",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema) as never,
    defaultValues: { current_password: "", password: "", password_confirmation: "" },
  });

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.put("/v1/auth/profile", data),
    onSuccess: (res) => {
      toast.success("Profil berhasil diperbarui");
      if (setUser) setUser((res.data as { user: typeof user }).user ?? res.data);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) => api.post("/v1/auth/change-password", data),
    onSuccess: () => {
      toast.success("Password berhasil diubah");
      passwordForm.reset();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    principal_researcher: "Peneliti Utama",
    field_researcher: "Peneliti Lapang",
    storage_officer: "Petugas Gudang",
    finance_staff: "Staf Keuangan",
  };

  const userRole = user?.roles?.[0] ?? "";
  const roleLabel = typeof userRole === "string"
    ? (roleLabels[userRole] ?? userRole)
    : (roleLabels[(userRole as { name?: string })?.name ?? ""] ?? "");

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Pengaturan Akun"
        description="Kelola profil dan keamanan akun Anda"
      />

      {/* Current account info */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-bold text-green-700">{user?.name?.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          {roleLabel && (
            <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">{roleLabel}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {([["profile", "Profil", User], ["password", "Password", Lock]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-green-600" />
            Informasi Profil
          </h3>
          <form onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                <input
                  {...profileForm.register("name")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {profileForm.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  {...profileForm.register("email")}
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {profileForm.formState.errors.email && (
                  <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.email.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                <input
                  {...profileForm.register("phone")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="+62..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institusi</label>
                <input
                  {...profileForm.register("institution")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="UNPAD"
                />
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={profileMutation.isPending}
                className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {profileMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password tab */}
      {activeTab === "password" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-green-600" />
            Ubah Password
          </h3>
          <form onSubmit={passwordForm.handleSubmit((d) => passwordMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama *</label>
              <input
                {...passwordForm.register("current_password")}
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {passwordForm.formState.errors.current_password && (
                <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.current_password.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru *</label>
              <input
                {...passwordForm.register("password")}
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {passwordForm.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru *</label>
              <input
                {...passwordForm.register("password_confirmation")}
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {passwordForm.formState.errors.password_confirmation && (
                <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.password_confirmation.message}</p>
              )}
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordMutation.isPending}
                className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {passwordMutation.isPending ? "Mengubah..." : "Ubah Password"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
