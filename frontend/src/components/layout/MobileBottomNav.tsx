"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Microscope, CalendarClock, Wallet, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";

const mainItems = [
  { name: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { name: "Pengamatan", href: "/phenotyping/data-pengamatan", icon: Microscope },
  { name: "Jadwal", href: "/schedules", icon: CalendarClock },
  { name: "Keuangan", href: "/finance", icon: Wallet },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuthStore();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16">
          {mainItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition flex-1",
                  active ? "text-green-600" : "text-gray-400"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition", active && "scale-110")} />
                <span className="text-[10px] font-medium leading-none">{item.name}</span>
                {active && <span className="absolute bottom-0 w-8 h-0.5 bg-green-500 rounded-full" />}
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(v => !v)}
            className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl flex-1", showMore ? "text-green-600" : "text-gray-400")}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">Lainnya</span>
          </button>
        </div>
      </nav>

      {/* More menu drawer */}
      {showMore && (
        <>
          <div className="md:hidden fixed inset-0 z-30 bg-black/20" onClick={() => setShowMore(false)} />
          <div className="md:hidden fixed bottom-16 inset-x-0 z-40 bg-white border-t border-gray-100 rounded-t-2xl shadow-2xl p-4">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3 px-1">Semua Menu</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { name: "Master Data", href: "/master-data", emoji: "🗺️" },
                { name: "Inventaris", href: "/pengamatan/inventory", emoji: "📦" },
                { name: "Penyakit", href: "/disease", emoji: "🦠" },
                { name: "Log Aktivitas", href: "/pengamatan/logbook", emoji: "📋" },
                { name: "Storage", href: "/pengamatan/storage-monitor", emoji: "🌡️" },
                { name: "Dokumen", href: "/documents", emoji: "📄" },
                { name: "Genotype", href: "/genotypes", emoji: "🌽" },
                { name: "Pengguna", href: "/users", emoji: "👥" },
                { name: "Audit", href: "/audit", emoji: "📊" },
                { name: "Data Rata²", href: "/phenotyping/data-rata-rata", emoji: "📈" },
                { name: "Pengaturan", href: "/settings", emoji: "⚙️" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition",
                    pathname.startsWith(item.href)
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-100 text-gray-600"
                  )}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-[10px] text-center leading-tight font-medium">{item.name}</span>
                </Link>
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">{user?.name}</p>
          </div>
        </>
      )}
    </>
  );
}
