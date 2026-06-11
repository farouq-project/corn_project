"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Thermometer, Cloud, Droplets } from "lucide-react";
import api from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { formatDate, cn } from "@/lib/utils";
import type { Environment } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";

export default function EnvironmentsPage() {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const { data, isLoading } = useQuery({
    queryKey: ["environments"],
    queryFn: () => api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 50 } }).then((r) => r.data),
  });

  const envs = data?.data ?? [];

  const columns: ColumnDef<Environment, unknown>[] = [
    {
      header: "Kode",
      accessorKey: "environment_code",
      cell: ({ getValue }) => <span className="font-mono font-semibold text-green-700">{getValue() as string}</span>,
    },
    {
      header: "Lokasi",
      accessorKey: "location.field_name",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs">
          <MapPin className="w-3 h-3 text-gray-400" />
          {row.original.location?.field_name ?? "-"}
        </div>
      ),
    },
    {
      header: "Musim",
      accessorKey: "season.season_name",
      cell: ({ row }) => <span className="text-xs">{row.original.season?.season_name ?? "-"}</span>,
    },
    {
      header: "Elevasi",
      accessorKey: "elevation_m",
      cell: ({ getValue }) => {
        const v = getValue() as number | undefined;
        return <span className="text-xs text-gray-500">{v ? `${v} m dpl` : "-"}</span>;
      },
    },
    {
      header: "Suhu Rata-rata",
      accessorKey: "avg_temperature_c",
      cell: ({ getValue }) => {
        const v = getValue() as number | undefined;
        return <span className="text-xs text-gray-500">{v ? `${v}°C` : "-"}</span>;
      },
    },
    {
      header: "Curah Hujan",
      accessorKey: "total_rainfall_mm",
      cell: ({ getValue }) => {
        const v = getValue() as number | undefined;
        return <span className="text-xs text-gray-500">{v ? `${v} mm` : "-"}</span>;
      },
    },
    {
      header: "Irigasi",
      accessorKey: "irrigation_type",
      cell: ({ getValue }) => {
        const v = getValue() as string | undefined;
        return <span className="text-xs text-gray-500 capitalize">{v ? v.replace("_", " ") : "-"}</span>;
      },
    },
    {
      header: "Tanam",
      accessorKey: "planting_date",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() ? formatDate(getValue() as string) : "-"}</span>,
    },
    {
      header: "Panen",
      accessorKey: "harvest_date",
      cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue() ? formatDate(getValue() as string) : "-"}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Lingkungan Percobaan"
        description="Kombinasi Lokasi × Musim dengan data lingkungan terintegrasi"
        actions={
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["table", "cards"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn("px-3 py-1.5 text-xs font-medium transition", viewMode === mode ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50")}
              >
                {mode === "cards" ? "Kartu" : "Tabel"}
              </button>
            ))}
          </div>
        }
      />

      {viewMode === "table" ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <DataTable
            data={envs}
            columns={columns}
            isLoading={isLoading}
            searchPlaceholder="Cari kode environment..."
            emptyMessage="Belum ada environment"
          />
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-white rounded-xl animate-pulse border border-gray-100" />)}
        </div>
      ) : envs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada environment.</p>
          <p className="text-xs mt-1">Buka detail Trial dan tambahkan Lokasi Uji untuk membuat environment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {envs.map((env) => (
            <div key={env.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-gray-400">{env.environment_code}</p>
                  <h3 className="font-semibold text-gray-900 mt-0.5">{env.location?.field_name}</h3>
                  <p className="text-sm text-blue-600">{env.season?.season_name}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-gray-500">
                {env.elevation_m && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-300">↑</span>
                    <span>{env.elevation_m} m dpl</span>
                  </div>
                )}
                {env.avg_temperature_c && (
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-red-400" />
                    <span>{env.avg_temperature_c}°C rata-rata</span>
                  </div>
                )}
                {env.total_rainfall_mm && (
                  <div className="flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-blue-400" />
                    <span>{env.total_rainfall_mm} mm curah hujan</span>
                  </div>
                )}
                {env.irrigation_type && (
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="capitalize">{env.irrigation_type.replace('_', ' ')}</span>
                  </div>
                )}
              </div>

              {(env.planting_date || env.harvest_date) && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-xs text-gray-400">
                  {env.planting_date && <span>Tanam: {formatDate(env.planting_date)}</span>}
                  {env.harvest_date && <span>Panen: {formatDate(env.harvest_date)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
