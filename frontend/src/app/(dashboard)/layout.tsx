"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Leaf, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

function HydrationSkeleton() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center animate-pulse">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm text-gray-400">Memuat sistem...</p>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "true"
  );

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };
  // Fallback: if hydration takes > 3s, force a re-check (handles rare localStorage race)
  const [hydrationTimeout, setHydrationTimeout] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHydrationTimeout(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (!_hasHydrated && !hydrationTimeout) return <HydrationSkeleton />;

  // After timeout: if still not hydrated or not authenticated, redirect
  if (hydrationTimeout && !isAuthenticated) {
    router.replace("/login");
    return null;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} collapsed={sidebarCollapsed} />

      {/* Desktop sidebar toggle strip */}
      <button
        onClick={toggleSidebar}
        className="hidden md:flex items-center justify-center w-3.5 bg-gray-100 hover:bg-gray-200 border-r border-gray-200 transition flex-shrink-0 group"
        title={sidebarCollapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
      >
        <ChevronLeft className={cn("w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-transform", sidebarCollapsed && "rotate-180")} />
      </button>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
      {/* Mobile bottom nav — only visible on small screens */}
      <MobileBottomNav />
    </div>
  );
}
