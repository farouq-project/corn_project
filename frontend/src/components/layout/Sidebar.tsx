"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dna,
  Package,
  FlaskConical,
  Activity,
  Wallet,
  Map,
  Users,
  Settings,
  BookOpen,
  Leaf,
  ChevronRight,
  BarChart3,
  Bug,
  FileText,
  CalendarClock,
  Award,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const navigation = [
  {
    label: "Utama",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Percobaan & Trial",
    items: [
      { name: "Manajemen Trial", href: "/trials", icon: BookOpen },
      { name: "Genotipe", href: "/genotypes", icon: Dna },
      { name: "Lingkungan (Env)", href: "/environments", icon: MapPin },
    ],
  },
  {
    label: "Pengamatan",
    items: [
      { name: "Fenotipe (Plot-level)", href: "/phenotype", icon: FlaskConical },
      { name: "Evaluasi Penyakit", href: "/disease", icon: Bug },
      { name: "Jadwal Pengamatan", href: "/schedules", icon: CalendarClock },
    ],
  },
  {
    label: "Lapangan",
    items: [
      { name: "Kegiatan Lapang", href: "/field-activities", icon: Activity },
    ],
  },
  {
    label: "Penyimpanan",
    items: [
      { name: "Inventaris Benih", href: "/storage", icon: Package },
      { name: "Import Data Historis", href: "/storage/import", icon: FileText },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { name: "Keuangan & Anggaran", href: "/finance", icon: Wallet },
    ],
  },
  {
    label: "Administrasi",
    items: [
      { name: "Dokumen Penelitian", href: "/documents", icon: FileText },
      { name: "Pelepasan Varietas", href: "/variety-candidates", icon: Award },
      { name: "Master Data", href: "/master-data", icon: Map },
    ],
  },
  {
    label: "Sistem",
    items: [
      { name: "Pengguna", href: "/users", icon: Users },
      { name: "Audit Trail", href: "/audit", icon: BarChart3 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">Corn Breed</p>
            <p className="text-xs text-gray-400 leading-tight">UNPAD 2026</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navigation.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    isActive
                      ? "bg-green-50 text-green-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-green-600" : "text-gray-400 group-hover:text-gray-600")} />
                  <span className="flex-1 truncate">{item.name}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-green-500" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-200 p-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
        >
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-green-700">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-[10px] text-gray-400 truncate">{user?.roles?.[0]?.replace("_", " ")}</p>
          </div>
          <Settings className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        </Link>
      </div>
    </div>
  );
}
