"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, User, Clock } from "lucide-react";
import api from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import type { AuditLog } from "@/types";
import { formatDateTime, cn } from "@/lib/utils";

const eventColors: Record<string, string> = {
  created: "bg-green-100 text-green-700",
  updated: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  login: "bg-purple-100 text-purple-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-orange-100 text-orange-700",
};

const modelLabels: Record<string, string> = {
  "App\\Models\\Genotype": "Genotipe",
  "App\\Models\\Trial": "Trial",
  "App\\Models\\SeedInventory": "Inventaris Benih",
  "App\\Models\\PhenotypeObservation": "Pengamatan",
  "App\\Models\\FieldActivity": "Kegiatan Lapang",
  "App\\Models\\Expense": "Pengeluaran",
  "App\\Models\\User": "Pengguna",
};

export default function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => api.get<{ data: AuditLog[] }>("/v1/audit", { params: { per_page: 50 } }).then((r) => r.data),
  });

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Audit Trail"
        description="Riwayat aktivitas dan perubahan data sistem"
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Log Aktivitas</h2>
          <span className="ml-auto text-sm text-gray-400">{logs.length} entri terbaru</span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Belum ada aktivitas tercatat</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-4 hover:bg-gray-50 transition">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{log.user_name ?? "System"}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", eventColors[log.event] ?? "bg-gray-100 text-gray-600")}>
                        {log.event}
                      </span>
                      <span className="text-xs text-gray-500">
                        {modelLabels[log.auditable_type] ?? log.auditable_type?.split("\\").pop()}
                        {log.auditable_id && ` #${log.auditable_id}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(log.created_at)}
                      </span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                    </div>
                    {(log.old_values || log.new_values) && (
                      <div className="mt-2 flex gap-3">
                        {log.old_values && Object.keys(log.old_values).length > 0 && (
                          <div className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded max-w-xs truncate">
                            <span className="font-medium">Sebelum: </span>
                            {Object.entries(log.old_values).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ")}
                          </div>
                        )}
                        {log.new_values && Object.keys(log.new_values).length > 0 && (
                          <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded max-w-xs truncate">
                            <span className="font-medium">Sesudah: </span>
                            {Object.entries(log.new_values).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
