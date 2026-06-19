"use client";

import { useState } from "react";
import { Table2, Sigma } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load the two heavy sub-pages to avoid loading both at once
import dynamic from "next/dynamic";

const DataPengamatanContent = dynamic(
  () => import("@/app/(dashboard)/phenotyping/data-pengamatan/page"),
  { loading: () => <div className="p-10 text-center text-gray-400 text-sm animate-pulse">Memuat Data Pengamatan...</div> }
);

const DataRataRataContent = dynamic(
  () => import("@/app/(dashboard)/phenotyping/data-rata-rata/page"),
  { loading: () => <div className="p-10 text-center text-gray-400 text-sm animate-pulse">Memuat Data Rata-Rata...</div> }
);

export default function KarakteristikPage() {
  const [tab, setTab] = useState<"pengamatan" | "rata-rata">("pengamatan");

  return (
    <div className="space-y-0">
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-xl w-fit">
        {([
          ["pengamatan", "Data Pengamatan", Table2],
          ["rata-rata",  "Data Rata-Rata",  Sigma],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
              tab === key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content — each sub-page manages its own state and queries */}
      {tab === "pengamatan" && <DataPengamatanContent />}
      {tab === "rata-rata"  && <DataRataRataContent />}
    </div>
  );
}
