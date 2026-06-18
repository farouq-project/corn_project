"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat2, Edit2, X, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";
import type { Trial } from "@/types";

export default function UlanganPage() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState(3);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["trials"],
    queryFn: () => api.get<{ data: Trial[] }>("/v1/trials", { params: { per_page: 100 } }).then((r) => r.data),
  });
  const trials = data?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, replications }: { id: number; replications: number }) =>
      api.put(`/v1/trials/${id}`, { replications }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trials"] });
      toast.success("Jumlah ulangan berhasil diperbarui");
      setEditingId(null);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (trial: Trial) => {
    setEditingId(trial.id);
    setEditValue(trial.replications ?? 3);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Ulangan (R)"
        description="Jumlah ulangan per project/trial. Menentukan R1, R2, ..., Rn yang tersedia saat entri Data Pengamatan."
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : trials.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <Repeat2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada trial. Buat trial terlebih dahulu.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {trials.map((trial) => {
              const isExp = expanded.has(trial.id);
              const reps = trial.replications ?? 3;
              const repArray = Array.from({ length: reps }, (_, i) => i + 1);

              return (
                <div key={trial.id}>
                  <div className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50/50 transition">
                    <button
                      onClick={() => toggleExpand(trial.id)}
                      className="text-gray-400 hover:text-gray-600 transition flex-shrink-0"
                    >
                      {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{trial.trial_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{trial.trial_code}</p>
                    </div>

                    {editingId === trial.id ? (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Jumlah ulangan:</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          className="w-16 px-2 py-1 border border-green-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                          autoFocus
                        />
                        <button
                          onClick={() => updateMutation.mutate({ id: trial.id, replications: editValue })}
                          disabled={updateMutation.isPending}
                          className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition disabled:opacity-50"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-gray-400 hover:text-gray-600 text-xs rounded hover:bg-gray-100 transition"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex gap-1">
                          {repArray.map((r) => (
                            <span key={r} className="w-7 h-7 rounded-full bg-green-50 text-green-700 text-xs font-semibold flex items-center justify-center">
                              R{r}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">{reps} ulangan</span>
                        <button onClick={() => startEdit(trial)} className="p-1.5 rounded hover:bg-blue-50 text-blue-400 transition">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isExp && (
                    <div className="px-12 pb-4 pt-0 bg-gray-50/30">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {repArray.map((r) => (
                          <div key={r} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              R{r}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700">Ulangan {r}</p>
                              <p className="text-[10px] text-gray-400">{trial.trial_name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">Cara kerja ulangan</p>
        <p className="text-xs text-blue-600">Jumlah ulangan per trial menentukan opsi R1, R2, ... Rn yang muncul secara otomatis saat input Data Pengamatan. Mengubah jumlah ulangan tidak menghapus data yang sudah ada.</p>
      </div>
    </div>
  );
}
