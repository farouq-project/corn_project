"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Award, TrendingUp, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import api from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";

const STATUS_STYLES: Record<string, string> = {
  under_evaluation: "bg-blue-50 text-blue-700 border-blue-200",
  proposed: "bg-yellow-50 text-yellow-700 border-yellow-200",
  submitted_to_board: "bg-orange-50 text-orange-700 border-orange-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  released: "bg-emerald-50 text-emerald-700 border-emerald-200",
  withdrawn: "bg-gray-50 text-gray-500 border-gray-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  under_evaluation: "Evaluasi",
  proposed: "Diusulkan",
  submitted_to_board: "Diajukan ke Tim",
  approved: "Disetujui",
  released: "Dirilis",
  withdrawn: "Ditarik",
  rejected: "Ditolak",
};

const RESISTANCE_COLORS: Record<string, string> = {
  tahan: "text-green-700", agak_tahan: "text-lime-700",
  moderat: "text-yellow-700", rentan: "text-orange-700", sangat_rentan: "text-red-700",
};

export default function VarietyCandidatesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["variety-candidates"],
    queryFn: () => api.get<{ data: Array<Record<string, unknown>> }>("/v1/variety-candidates", { params: { per_page: 50 } }).then((r) => r.data),
  });

  const { data: genotypes } = useQuery({
    queryKey: ["genotypes-simple"],
    queryFn: () => api.get("/v1/genotypes?all=true").then((r) => r.data as Array<{ id: number; genotype_code: string; genotype_name: string }>),
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { target_release_year: new Date().getFullYear() + 2 },
  });

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post("/v1/variety-candidates", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variety-candidates"] });
      toast.success("Kandidat varietas ditambahkan");
      setIsModalOpen(false);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const calcSummaryMutation = useMutation({
    mutationFn: (id: number) => api.post(`/v1/variety-candidates/${id}/calculate-summary`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variety-candidates"] });
      toast.success("Ringkasan kinerja diperbarui");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const candidates = data?.data ?? [];

  const pipelineStages = Object.entries(STATUS_LABELS).map(([status, label]) => ({
    status, label,
    count: candidates.filter((c) => c.status === status).length,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Pipeline Pelepasan Varietas"
        description="Pantau kandidat varietas jagung dari evaluasi hingga pelepasan resmi"
        actions={
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Tambah Kandidat
          </button>
        }
      />

      {/* Pipeline visualization */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        {pipelineStages.map((stage) => (
          <div key={stage.status} className={cn("border rounded-xl p-3 text-center", STATUS_STYLES[stage.status] ?? "bg-gray-50 border-gray-200")}>
            <p className="text-xl font-bold">{stage.count}</p>
            <p className="text-[10px] mt-0.5 leading-tight">{stage.label}</p>
          </div>
        ))}
      </div>

      {/* Candidate cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-white rounded-xl animate-pulse border border-gray-100" />)}
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada kandidat varietas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {candidates.map((c) => {
            const candidate = c as {
              id: number; candidate_code: string; proposed_variety_name?: string; status: string;
              target_release_year?: number; num_trial_locations?: number; num_trial_years?: number;
              avg_yield_t_ha?: number; yield_superiority_percent?: number;
              genotype?: { genotype_code: string; genotype_name: string };
              disease_resistance_summary?: Array<{ disease_code: string; resistance_category: string }>;
            };
            return (
              <div key={candidate.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border inline-block mb-1", STATUS_STYLES[candidate.status] ?? "")}>
                      {STATUS_LABELS[candidate.status] ?? candidate.status}
                    </span>
                    <h3 className="font-bold text-gray-900">{candidate.proposed_variety_name ?? candidate.genotype?.genotype_code}</h3>
                    <p className="text-xs text-gray-400 font-mono">{candidate.genotype?.genotype_code} · {candidate.candidate_code}</p>
                  </div>
                  <button
                    onClick={() => calcSummaryMutation.mutate(candidate.id)}
                    disabled={calcSummaryMutation.isPending}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                    title="Hitung ulang ringkasan"
                  >
                    <RefreshCw className={cn("w-4 h-4", calcSummaryMutation.isPending && "animate-spin")} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: "Lokasi", value: candidate.num_trial_locations ?? 0 },
                    { label: "Hasil (t/ha)", value: candidate.avg_yield_t_ha ? `${candidate.avg_yield_t_ha}` : "—" },
                    { label: "Target Rilis", value: candidate.target_release_year ?? "—" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-gray-800">{stat.value}</p>
                      <p className="text-[10px] text-gray-400">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {candidate.disease_resistance_summary && candidate.disease_resistance_summary.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Ketahanan Penyakit</p>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.disease_resistance_summary.map((d) => (
                        <span key={d.disease_code} className={cn("text-[10px] font-medium", RESISTANCE_COLORS[d.resistance_category] ?? "text-gray-600")}>
                          {d.disease_code}: {d.resistance_category?.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Tambah Kandidat Varietas</h3>
              <button onClick={() => { setIsModalOpen(false); reset(); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d as Record<string, unknown>))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genotipe *</label>
                <select {...register("genotype_id", { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">-- Pilih Genotipe --</option>
                  {genotypes?.map((g) => <option key={g.id} value={g.id}>{g.genotype_code} — {g.genotype_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Varietas yang Diusulkan</label>
                <input {...register("proposed_variety_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. Hibrida Unpad 1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mulai Evaluasi</label>
                  <input {...register("evaluation_start_year")} type="number" min="2020" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="2024" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Rilis</label>
                  <input {...register("target_release_year")} type="number" min="2025" max="2035" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona Adaptasi</label>
                <input {...register("adaptation_zones")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Jawa Barat, dataran rendah" />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsModalOpen(false); reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                  {createMutation.isPending ? "Menyimpan..." : "Tambah Kandidat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
