"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Thermometer, Cloud, Droplets } from "lucide-react";
import api from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate, cn } from "@/lib/utils";
import type { Environment } from "@/types";

export default function EnvironmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["environments"],
    queryFn: () => api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 50 } }).then((r) => r.data),
  });

  const envs = data?.data ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Lingkungan Percobaan"
        description="Kombinasi Lokasi × Musim dengan data lingkungan terintegrasi"
      />

      {isLoading ? (
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
