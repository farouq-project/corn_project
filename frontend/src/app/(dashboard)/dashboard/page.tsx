"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Dna,
  MapPin,
  Sheet,
  Ruler,
  Activity,
  Table2,
  Sigma,
  ArrowRight,
} from "lucide-react";
import api from "@/lib/axios";
import { formatDate, getStatusColor, cn } from "@/lib/utils";
import type { DashboardStats, FieldActivity } from "@/types";

interface DashboardData {
  stats: DashboardStats;
  recent_activities: FieldActivity[];
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/v1/dashboard").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  const statCards = [
    {
      title: "Total Genotipe",
      value: stats?.total_genotypes ?? 0,
      icon: Dna,
      color: "text-purple-600",
      bg: "bg-purple-50",
      desc: "genotipe aktif",
    },
    {
      title: "Total Environment",
      value: stats?.total_environments ?? 0,
      icon: MapPin,
      color: "text-blue-600",
      bg: "bg-blue-50",
      desc: "lokasi × musim",
    },
    {
      title: "Data Pengamatan",
      value: stats?.total_observation_records ?? 0,
      icon: Sheet,
      color: "text-green-600",
      bg: "bg-green-50",
      desc: "baris pengamatan",
    },
    {
      title: "Total Karakteristik",
      value: stats?.total_characteristics ?? 0,
      icon: Ruler,
      color: "text-orange-600",
      bg: "bg-orange-50",
      desc: "karakteristik aktif",
    },
  ];

  const activityTypeLabels: Record<string, string> = {
    planting: "Tanam", pollination: "Penyerbukan", fertilizer_application: "Pemupukan",
    irrigation: "Irigasi", pesticide_application: "Pestisida", harvesting: "Panen",
    monitoring: "Monitoring", disease_observation: "Pengamatan Penyakit",
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Ikhtisar sistem penelitian pemuliaan jagung UNPAD</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">{card.desc}</p>
              </div>
              <div className={cn("p-2.5 rounded-lg", card.bg)}>
                <card.icon className={cn("w-5 h-5", card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Navigation to Phenotyping */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Phenotyping</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="/phenotyping/data-pengamatan"
            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-50">
                <Table2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Data Pengamatan</p>
                <p className="text-xs text-gray-400 mt-0.5">Entri data pengamatan per plot/replikasi</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 transition flex-shrink-0" />
          </a>
          <a
            href="/phenotyping/data-rata-rata"
            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-50">
                <Sigma className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Data Rata-Rata</p>
                <p className="text-xs text-gray-400 mt-0.5">Rata-rata nilai per Genotipe × Environment</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 transition flex-shrink-0" />
          </a>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-gray-800">Kegiatan Terbaru</h2>
          </div>
          <a href="/field-activities" className="text-sm text-green-600 hover:text-green-700 font-medium">
            Lihat semua →
          </a>
        </div>

        {(data?.recent_activities ?? []).length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada kegiatan lapang tercatat</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.recent_activities?.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-700 text-xs font-bold">
                    {activity.user?.name?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{activity.activity_title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activityTypeLabels[activity.activity_type] ?? activity.activity_type}
                    {activity.trial && ` · ${activity.trial.trial_name}`}
                    {" · "}{formatDate(activity.activity_date)}
                  </p>
                </div>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0", getStatusColor(activity.status))}>
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
