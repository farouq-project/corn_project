"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FlaskConical,
  Dna,
  Package,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  Wallet,
} from "lucide-react";
import api from "@/lib/axios";
import { formatCurrency, formatDate, getStatusColor, cn } from "@/lib/utils";
import type { DashboardStats, StorageAlerts, FieldActivity } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DashboardData {
  stats: DashboardStats;
  storage_alerts: StorageAlerts;
  recent_activities: FieldActivity[];
  monthly_expenses: Array<{ month: string; total: string }>;
  trial_status_breakdown: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  planned: "#3b82f6",
  harvested: "#a855f7",
  completed: "#10b981",
  cancelled: "#ef4444",
};

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
  const alerts = data?.storage_alerts;

  const statCards = [
    {
      title: "Trial Aktif",
      value: stats?.active_trials ?? 0,
      icon: FlaskConical,
      color: "text-blue-600",
      bg: "bg-blue-50",
      desc: "penelitian berjalan",
    },
    {
      title: "Total Genotipe",
      value: stats?.total_genotypes ?? 0,
      icon: Dna,
      color: "text-purple-600",
      bg: "bg-purple-50",
      desc: "genotipe aktif",
    },
    {
      title: "Inventaris Benih",
      value: stats?.total_seed_inventory ?? 0,
      icon: Package,
      color: "text-green-600",
      bg: "bg-green-50",
      desc: "paket benih tersimpan",
    },
    {
      title: "Perlu Persetujuan",
      value: (stats?.pending_phenotype_approvals ?? 0) + (stats?.pending_expenses ?? 0),
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
      desc: "menunggu approval",
    },
  ];

  const alertCards = [
    { title: "Stok Benih Rendah", value: alerts?.low_stock ?? 0, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
    { title: "Kadar Air Tinggi", value: alerts?.high_moisture ?? 0, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    { title: "Segera Kadaluarsa", value: alerts?.expiring_soon ?? 0, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  ];

  const trialPieData = Object.entries(data?.trial_status_breakdown ?? {}).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color: STATUS_COLORS[status] ?? "#9ca3af",
  }));

  const expenseChartData = (data?.monthly_expenses ?? []).map((m) => ({
    month: m.month?.slice(0, 7) ?? "",
    total: parseFloat(m.total ?? "0"),
  }));

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

      {/* Storage Alerts */}
      {((alerts?.low_stock ?? 0) + (alerts?.high_moisture ?? 0) + (alerts?.expiring_soon ?? 0)) > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-800">Peringatan Penyimpanan</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {alertCards.map((alert) => (
              <div key={alert.title} className={cn("rounded-lg p-3 border", alert.bg, alert.border)}>
                <p className={cn("text-2xl font-bold", alert.color)}>{alert.value}</p>
                <p className="text-xs text-gray-600 mt-0.5">{alert.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Expenses Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Wallet className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-800">Pengeluaran 6 Bulan Terakhir</h2>
          </div>
          {expenseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={expenseChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v || 0))} />
                <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Belum ada data pengeluaran
            </div>
          )}
        </div>

        {/* Trial Status Pie */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-gray-800">Status Trial</h2>
          </div>
          {trialPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={trialPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {trialPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Belum ada data trial
            </div>
          )}
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
