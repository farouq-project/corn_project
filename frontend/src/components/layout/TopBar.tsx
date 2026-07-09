"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, User } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";
import { InstallIconButton } from "@/components/pwa/InstallIconButton";

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
    } catch {}
    logout();
    toast.success("Berhasil keluar");
    router.replace("/login");
  };

  const roleBadge: Record<string, { label: string; color: string }> = {
    super_admin: { label: "Super Admin", color: "bg-purple-100 text-purple-700" },
    principal_researcher: { label: "Peneliti Utama", color: "bg-blue-100 text-blue-700" },
    field_researcher: { label: "Peneliti Lapang", color: "bg-green-100 text-green-700" },
    storage_officer: { label: "Petugas Gudang", color: "bg-yellow-100 text-yellow-700" },
    finance_staff: { label: "Staf Keuangan", color: "bg-orange-100 text-orange-700" },
  };

  const currentRole = user?.roles?.[0] ?? "";
  const roleInfo = roleBadge[currentRole] ?? { label: currentRole, color: "bg-gray-100 text-gray-700" };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-6 flex-shrink-0 shadow-sm gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 flex-shrink-0"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative min-w-0 flex-1 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari data..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-500 transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Role badge */}
        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium hidden md:inline-flex", roleInfo.color)}>
          {roleInfo.label}
        </span>

        {/* Install PWA */}
        <InstallIconButton />

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-green-700">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-1">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowDropdown(false); router.push("/settings"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  Profil & Pengaturan
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                  {isLoggingOut ? "Keluar..." : "Keluar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
