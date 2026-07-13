"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { Plus, CheckCircle2, X, Loader2, Eye, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/lib/axios";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate, cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";
import type { ColumnDef } from "@tanstack/react-table";

const RESISTANCE_COLORS: Record<string, string> = {
  tahan: "bg-green-100 text-green-800",
  agak_tahan: "bg-lime-100 text-lime-800",
  moderat: "bg-yellow-100 text-yellow-800",
  rentan: "bg-orange-100 text-orange-800",
  sangat_rentan: "bg-red-100 text-red-800",
};
const RESISTANCE_LABELS: Record<string, string> = {
  tahan: "T", agak_tahan: "AT", moderat: "M", rentan: "R", sangat_rentan: "SR",
};
const RESISTANCE_FULL: Record<string, string> = {
  tahan: "Tahan", agak_tahan: "Agak Tahan", moderat: "Moderat",
  rentan: "Rentan", sangat_rentan: "Sangat Rentan",
};

const toOptionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

const evalSchema = z.object({
  trial_id: z.preprocess(Number, z.number()),
  environment_id: z.preprocess(Number, z.number()),
  disease_type_id: z.preprocess(toOptionalNumber, z.number().optional()),
  days_after_planting: z.preprocess(toOptionalNumber, z.number().optional()),
  evaluation_date: z.string(),
  growth_stage: z.string().optional(),
  weather_notes: z.string().optional(),
  general_observations: z.string().optional(),
});

interface DiseaseType { id: number; disease_code: string; disease_name: string; }
interface DiseaseEval {
  id: number; evaluation_code: string;
  trial?: { trial_name: string; trial_code: string };
  environment?: { location?: { field_name: string }; season?: { season_name: string } };
  diseaseType?: { disease_name: string; disease_code: string };
  disease_type_ids?: number[];
  evaluation_date: string; growth_stage?: string;
  status: string; scores_count: number;
  weather_notes?: string; general_observations?: string;
  evaluator?: { name: string };
}
interface DiseaseScore {
  id: number; genotype?: { genotype_code: string; genotype_name: string };
  incidence_percent?: number; severity_score?: number; intensity_percent?: number;
  resistance_category?: string; notes?: string;
  block?: { block_label: string };
}

export default function DiseasePage() {
  const { user } = useAuthStore();
  const canEdit = !user?.roles?.includes("colaborator");
  const [activeTab, setActiveTab] = useState<"evaluations" | "summary">("evaluations");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEval, setEditingEval] = useState<DiseaseEval | null>(null);
  const [selectedEval, setSelectedEval] = useState<DiseaseEval | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTrialId, setSelectedTrialId] = useState("");
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [selectedDiseaseTypeIds, setSelectedDiseaseTypeIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const { data: evaluations, isLoading } = useQuery({
    queryKey: ["disease-evaluations"],
    queryFn: () => api.get<{ data: DiseaseEval[] }>("/v1/disease/evaluations", {
      params: { per_page: 50 },
    }).then(r => r.data),
  });

  const { data: evalDetail } = useQuery({
    queryKey: ["disease-eval-detail", selectedEval?.id],
    queryFn: () => api.get<DiseaseEval & { scores: DiseaseScore[] }>(
      `/v1/disease/evaluations/${selectedEval!.id}`
    ).then(r => r.data),
    enabled: !!selectedEval && isDetailOpen,
  });

  const { data: diseaseTypes } = useQuery({
    queryKey: ["disease-types"],
    queryFn: () => api.get<DiseaseType[]>("/v1/disease/types").then(r => r.data),
  });

  const { data: trials } = useQuery({
    queryKey: ["trials-simple"],
    queryFn: () => api.get("/v1/trials?all=true").then(r => r.data as Array<{ id: number; trial_code: string; trial_name: string }>),
  });

  const { data: environments } = useQuery({
    queryKey: ["environments-all"],
    queryFn: () => api.get<{ data: Array<{ id: number; environment_code: string; location?: { field_name: string } }> }>("/v1/environments", {
      params: { per_page: 100 },
    }).then(r => r.data.data),
  });

  const { data: resistanceSummary } = useQuery({
    queryKey: ["resistance-summary", selectedTrialId],
    queryFn: () => api.get("/v1/disease/resistance-summary", {
      params: { trial_id: selectedTrialId },
    }).then(r => r.data),
    enabled: activeTab === "summary" && !!selectedTrialId,
  });

  type EvalFormData = z.infer<typeof evalSchema>;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EvalFormData>({
    resolver: zodResolver(evalSchema) as never,
    defaultValues: {
      evaluation_date: new Date().toISOString().slice(0, 10),
    },
  });

  const trialWatch = watch("trial_id");

  const createMutation = useMutation({
    mutationFn: (d: z.infer<typeof evalSchema>) => api.post("/v1/disease/evaluations", {
      ...d,
      disease_type_ids: selectedDiseaseTypeIds.length > 0 ? selectedDiseaseTypeIds : undefined,
      disease_type_id: selectedDiseaseTypeIds[0] ?? d.disease_type_id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disease-evaluations"] });
      toast.success("Sesi evaluasi dibuat");
      setIsModalOpen(false);
      setSelectedDiseaseTypeIds([]);
      reset();
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/disease/evaluations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["disease-evaluations"] }); toast.success("Evaluasi dihapus"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/v1/disease/evaluations/${id}`))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["disease-evaluations"] }); toast.success("Evaluasi terpilih dihapus"); },
    onError: () => toast.error("Sebagian evaluasi gagal dihapus"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/v1/disease/evaluations/${id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["disease-evaluations"] }); toast.success("Disetujui"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const addTypeMutation = useMutation({
    mutationFn: (name: string) => api.post<DiseaseType>("/v1/disease/types", { disease_name: name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["disease-types"] });
      setValue("disease_type_id", res.data.id);
      setNewTypeName("");
      setIsAddTypeOpen(false);
      toast.success("Jenis penyakit ditambahkan");
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<z.infer<typeof evalSchema>> }) =>
      api.put(`/v1/disease/evaluations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disease-evaluations"] });
      toast.success("Evaluasi diperbarui");
      setIsModalOpen(false);
      setEditingEval(null);
      reset();
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const openEdit = (ev: DiseaseEval) => {
    setEditingEval(ev);
    setSelectedDiseaseTypeIds(ev.disease_type_ids ?? (ev.diseaseType ? [] : []));
    reset({
      trial_id: ev.trial ? (trials?.find(t => t.trial_code === ev.trial?.trial_code)?.id ?? 0) : 0,
      environment_id: 0,
      disease_type_id: undefined,
      evaluation_date: ev.evaluation_date,
      weather_notes: ev.weather_notes ?? "",
      general_observations: ev.general_observations ?? "",
    });
    setIsModalOpen(true);
  };

  const evalList = evaluations?.data ?? [];

  const columns: ColumnDef<DiseaseEval, unknown>[] = [
    {
      header: "Kode",
      accessorKey: "evaluation_code",
      cell: ({ getValue }) => <span className="font-mono text-xs text-blue-700">{getValue() as string}</span>,
    },
    {
      header: "Trial / Lokasi",
      id: "trial_env",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.trial?.trial_code}</p>
          <p className="text-xs text-gray-400">
            {row.original.environment?.location?.field_name} · {row.original.environment?.season?.season_name}
          </p>
        </div>
      ),
    },
    {
      header: "Penyakit",
      id: "disease",
      cell: ({ row }) => {
        const typeIds = row.original.disease_type_ids;
        const allTypes = (diseaseTypes as unknown as DiseaseType[] | undefined) ?? [];
        if (typeIds && typeIds.length > 1) {
          return (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {typeIds.slice(0, 2).map(id => {
                const dt = allTypes.find(t => t.id === id);
                return dt ? (
                  <span key={id} className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                    {dt.disease_name}
                  </span>
                ) : null;
              })}
              {typeIds.length > 2 && <span className="text-xs text-gray-400">+{typeIds.length - 2}</span>}
            </div>
          );
        }
        return (
          <span className="text-sm font-semibold text-purple-700">
            {row.original.diseaseType?.disease_name ?? "—"}
          </span>
        );
      },
    },
    {
      header: "Tanggal",
      accessorKey: "evaluation_date",
      cell: ({ getValue }) => <span className="text-xs">{formatDate(getValue() as string)}</span>,
    },
    {
      header: "Plot Dinilai",
      accessorKey: "scores_count",
      cell: ({ getValue }) => {
        const n = getValue() as number;
        return (
          <span className={cn("font-semibold text-sm", n > 0 ? "text-green-700" : "text-gray-400")}>
            {n > 0 ? `${n} plot` : "Belum ada"}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      header: "Aksi",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSelectedEval(row.original); setIsDetailOpen(true); }}
            className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition"
            title="Lihat Detail Skor"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {canEdit && row.original.status !== "approved" && (
            <button
              onClick={() => openEdit(row.original)}
              className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600 transition"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canEdit && row.original.status !== "approved" && (
            <button
              onClick={() => approveMutation.mutate(row.original.id)}
              className="p-1.5 rounded hover:bg-green-50 text-green-500 transition"
              title="Setujui"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => { if (confirm(`Hapus evaluasi ${row.original.evaluation_code}? Tindakan ini tidak dapat dibatalkan.`)) deleteMutation.mutate(row.original.id); }}
              className="p-1.5 rounded hover:bg-red-50 text-red-400 transition"
              title="Hapus"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const scores: DiseaseScore[] = (evalDetail as unknown as { scores?: DiseaseScore[] })?.scores ?? [];
  const summary = Array.isArray(resistanceSummary) ? resistanceSummary : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Evaluasi Ketahanan Penyakit"
        description="Bulai · Hawar Daun · Karat Daun · Busuk Batang"
        actions={canEdit ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> Sesi Evaluasi Baru
          </button>
        ) : null}
      />

      {/* Disease type cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(diseaseTypes as unknown as DiseaseType[] | undefined)?.map(dt => {
          const count = evalList.filter(e => e.diseaseType?.disease_code === dt.disease_code).length;
          const scored = evalList.filter(e => e.diseaseType?.disease_code === dt.disease_code && (e.scores_count ?? 0) > 0).length;
          return (
            <div key={dt.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-gray-800">{dt.disease_name}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{dt.disease_code}</p>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <p className="text-2xl font-bold text-purple-600">{count}</p>
                  <p className="text-xs text-gray-400">sesi</p>
                </div>
                {count > 0 && (
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", scored === count ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                    {scored}/{count} ada skor
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[["evaluations", "Daftar Evaluasi"], ["summary", "Ringkasan Ketahanan"]].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id as typeof activeTab)}
              className={cn("px-5 py-3.5 text-sm font-medium transition", activeTab === id ? "text-green-700 border-b-2 border-green-600 bg-green-50/50" : "text-gray-500 hover:text-gray-700")}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "evaluations" && (
            <DataTable data={evalList} columns={columns} isLoading={isLoading}
              searchPlaceholder="Cari evaluasi..." emptyMessage="Belum ada evaluasi penyakit"
              getRowId={r => String(r.id)}
              onBulkDelete={canEdit ? rows => bulkDeleteMutation.mutate(rows.filter(r => r.status !== "approved").map(r => r.id)) : undefined}
              isBulkDeleting={bulkDeleteMutation.isPending} />
          )}

          {activeTab === "summary" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Trial</label>
                <select value={selectedTrialId} onChange={e => setSelectedTrialId(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">-- Pilih Trial --</option>
                  {trials?.map(t => <option key={t.id} value={t.id}>{t.trial_code} - {t.trial_name}</option>)}
                </select>
              </div>
              {summary.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs text-gray-500 font-semibold">Genotipe</th>
                        {(() => {
                          const diseaseResistance =
                            (summary[0] as {
                              disease_resistance?: Array<{ disease_name: string }>;
                            })?.disease_resistance ?? [];

                          return diseaseResistance.map((d) => (
                            <th
                              key={d.disease_name}
                              className="px-4 py-2 text-center text-xs text-gray-500 font-semibold whitespace-nowrap"
                            >
                              {d.disease_name}
                            </th>
                          ));
                        })()}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {summary.map((row: unknown) => {
                        const r = row as {
                          genotype_code: string; genotype_name: string;
                          disease_resistance: Array<{ disease_name: string; resistance_category: string; avg_severity_score: number; avg_incidence_percent: number }>;
                        };
                        return (
                          <tr key={r.genotype_code} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <span className="font-mono font-semibold text-green-700">{r.genotype_code}</span>
                              <p className="text-xs text-gray-400">{r.genotype_name}</p>
                            </td>
                            {r.disease_resistance.map(d => (
                              <td key={d.disease_name} className="px-4 py-2 text-center">
                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold", RESISTANCE_COLORS[d.resistance_category] ?? "bg-gray-100 text-gray-600")}>
                                  {RESISTANCE_LABELS[d.resistance_category] ?? d.resistance_category}
                                </span>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  Skor {d.avg_severity_score} · {d.avg_incidence_percent}%
                                </p>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : selectedTrialId ? (
                <p className="text-center text-gray-400 py-8 text-sm">Belum ada data evaluasi yang disetujui untuk trial ini.</p>
              ) : (
                <p className="text-center text-gray-400 py-8 text-sm">Pilih trial untuk melihat ringkasan ketahanan.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail / Scores Modal */}
      {isDetailOpen && selectedEval && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between p-6 border-b">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-gray-400">{selectedEval.evaluation_code}</span>
                  <StatusBadge status={selectedEval.status} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedEval.diseaseType?.disease_name ?? "Evaluasi Penyakit"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedEval.trial?.trial_code} · {selectedEval.environment?.location?.field_name} · {formatDate(selectedEval.evaluation_date)}
                </p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Context */}
              {(selectedEval.weather_notes || selectedEval.general_observations) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedEval.weather_notes && (
                    <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                      <p className="font-semibold text-xs mb-1">Kondisi Cuaca</p>
                      {selectedEval.weather_notes}
                    </div>
                  )}
                  {selectedEval.general_observations && (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                      <p className="font-semibold text-xs mb-1">Catatan Umum</p>
                      {selectedEval.general_observations}
                    </div>
                  )}
                </div>
              )}

              {/* Scores table */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  Skor per Plot
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
                    {scores.length} plot dinilai
                  </span>
                </h4>

                {scores.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    <p className="text-sm">Belum ada skor plot untuk sesi ini</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {["Genotipe", "Blok", "Insidensi (%)", "Skor Keparahan", "Intensitas (%)", "Klasifikasi", "Catatan"].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {scores.map(score => (
                          <tr key={score.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <span className="font-mono font-semibold text-green-700">{score.genotype?.genotype_code}</span>
                              <p className="text-gray-400 truncate max-w-[120px]">{score.genotype?.genotype_name}</p>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{score.block?.block_label ?? "R?"}</td>
                            <td className="px-3 py-2 font-medium">{score.incidence_percent ?? "—"}%</td>
                            <td className="px-3 py-2">
                              <span className="font-bold text-purple-700">{score.severity_score ?? "—"}</span>
                              <span className="text-gray-400"> /9</span>
                            </td>
                            <td className="px-3 py-2">{score.intensity_percent ?? "—"}%</td>
                            <td className="px-3 py-2">
                              {score.resistance_category ? (
                                <span className={cn("px-2 py-0.5 rounded-full font-semibold text-[11px]", RESISTANCE_COLORS[score.resistance_category] ?? "bg-gray-100 text-gray-600")}>
                                  {RESISTANCE_FULL[score.resistance_category] ?? score.resistance_category}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[150px] truncate text-gray-500" title={score.notes ?? ""}>
                              {score.notes ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Resistance summary for this eval */}
              {scores.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2 text-sm">Distribusi Kategori Ketahanan</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(RESISTANCE_FULL).map(([key, label]) => {
                      const count = scores.filter(s => s.resistance_category === key).length;
                      if (count === 0) return null;
                      return (
                        <div key={key} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border", RESISTANCE_COLORS[key])}>
                          {label}: <span className="font-bold">{count}</span> genotipe
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingEval ? "Edit Sesi Evaluasi" : "Buat Sesi Evaluasi Penyakit"}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingEval(null); reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(d => {
              if (editingEval) {
                updateMutation.mutate({ id: editingEval.id, data: { evaluation_date: d.evaluation_date, days_after_planting: d.days_after_planting, weather_notes: d.weather_notes, general_observations: d.general_observations, growth_stage: d.growth_stage } });
              } else {
                createMutation.mutate(d);
              }
            })} className="p-6 space-y-4">
              {!editingEval && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Jenis Penyakit *</label>
                      <button type="button" onClick={() => setIsAddTypeOpen(v => !v)}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 transition">
                        <Plus className="w-3 h-3" /> Tambah Jenis
                      </button>
                    </div>
                    {isAddTypeOpen && (
                      <div className="mb-2 p-3 border border-purple-200 rounded-lg bg-purple-50/30 space-y-2">
                        <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                          placeholder="Nama jenis penyakit (mis. Fusarium Wilt)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setIsAddTypeOpen(false); setNewTypeName(""); }}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Batal</button>
                          <button type="button" disabled={addTypeMutation.isPending || !newTypeName.trim()}
                            onClick={() => addTypeMutation.mutate(newTypeName.trim())}
                            className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                            {addTypeMutation.isPending ? "Menyimpan..." : "Tambah"}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-40 overflow-y-auto">
                      {((diseaseTypes as unknown as DiseaseType[] | undefined) ?? []).map(dt => {
                        const checked = selectedDiseaseTypeIds.includes(dt.id);
                        return (
                          <label key={dt.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-purple-50/40 transition">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedDiseaseTypeIds(prev =>
                                checked ? prev.filter(id => id !== dt.id) : [...prev, dt.id]
                              )}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-800 flex-1">{dt.disease_name}</span>
                            <span className="text-xs text-gray-400 font-mono">{dt.disease_code}</span>
                          </label>
                        );
                      })}
                    </div>
                    {selectedDiseaseTypeIds.length === 0 && <p className="text-amber-500 text-xs mt-1">Pilih minimal satu jenis penyakit</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trial *</label>
                      <select {...register("trial_id")} onChange={e => { setValue("trial_id", Number(e.target.value)); setSelectedTrialId(e.target.value); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">-- Pilih Trial --</option>
                        {trials?.map(t => <option key={t.id} value={t.id}>{t.trial_code}</option>)}
                      </select>
                      {errors.trial_id && <p className="text-red-500 text-xs mt-1">{errors.trial_id.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi *</label>
                      <select {...register("environment_id")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">-- Pilih Lokasi --</option>
                        {environments?.map(e => (
                          <option key={e.id} value={e.id}>{e.environment_code} — {e.location?.field_name}</option>
                        ))}
                      </select>
                      {errors.environment_id && <p className="text-red-500 text-xs mt-1">{errors.environment_id.message}</p>}
                    </div>
                  </div>
                </>
              )}

              {editingEval && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  <p><span className="font-semibold">Penyakit:</span> {editingEval.diseaseType?.disease_name}</p>
                  <p><span className="font-semibold">Trial:</span> {editingEval.trial?.trial_code} · {editingEval.environment?.location?.field_name}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                  <input {...register("evaluation_date")} type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HST</label>
                  <input {...register("days_after_planting")} type="number" min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Kondisi Cuaca</label>
                <textarea {...register("weather_notes")} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Kondisi cuaca, kelembaban, dll." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Pengamatan Umum</label>
                <textarea {...register("general_observations")} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingEval(null); reset(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {(createMutation.isPending || updateMutation.isPending)
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{editingEval ? "Menyimpan..." : "Membuat..."}</>
                    : editingEval ? "Simpan Perubahan" : "Buat Sesi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
