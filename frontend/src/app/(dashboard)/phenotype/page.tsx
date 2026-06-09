"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, CheckCircle2, XCircle, X, BarChart3, Eye, Plus, Edit2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import api from "@/lib/axios";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { PhenotypeVariable } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate, cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";

const STAGE_LABELS: Record<string, string> = {
  pre_emergence: "Pra-Tumbuh", emergence_vE: "Tumbuh (VE)",
  vegetative_V1_V6: "V1-V6", vegetative_V7_V12: "V7-V12",
  tasseling_VT: "Tasseling (VT)", silking_R1: "Silking (R1)",
  blister_R2: "Blister (R2)", milk_R3: "Susu (R3)", dough_R4: "Adonan (R4)",
  dent_R5: "Dent (R5)", maturity_R6: "Masak (R6)", harvest: "Panen",
};
const CAT_LABELS: Record<string, string> = {
  vegetative: "Vegetatif", reproductive: "Reproduktif",
  ear_characteristics: "Karakter Tongkol", yield_components: "Komponen Hasil",
  stress_response: "Respons Cekaman", seed_characteristics: "Karakter Benih",
};
const CAT_COLORS: Record<string, string> = {
  vegetative: "bg-green-50 text-green-700", reproductive: "bg-pink-50 text-pink-700",
  ear_characteristics: "bg-yellow-50 text-yellow-700", yield_components: "bg-blue-50 text-blue-700",
  stress_response: "bg-red-50 text-red-700", seed_characteristics: "bg-purple-50 text-purple-700",
};

interface ObsValue {
  id: number;
  variable?: PhenotypeVariable;
  numeric_value?: string;
  text_value?: string;
  is_outlier: boolean;
}
interface PlotObs {
  id: number;
  observation_code: string;
  trial?: { trial_code: string };
  environment?: { location?: { field_name: string } };
  genotype?: { genotype_code: string; genotype_name: string };
  plot?: { plot_code: string; block?: { block_label: string } };
  observation_date: string;
  growth_stage?: string;
  days_after_planting?: number;
  status: string;
  general_notes?: string;
  total_variables_expected: number;
  total_variables_filled: number;
  recorder?: { name: string };
  values?: ObsValue[];
}

const toOptionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

const obsSchema = z.object({
  trial_id: z.preprocess(Number, z.number().min(1, "Pilih trial")),
  genotype_id: z.preprocess(Number, z.number().min(1, "Pilih genotipe")),
  season_id: z.preprocess(Number, z.number().min(1, "Pilih musim")),
  replication: z.preprocess(Number, z.number().min(1).max(20).default(1)),
  plot_number: z.preprocess(toOptionalNumber, z.number().optional()),
  observation_date: z.string().min(1, "Tanggal wajib diisi"),
  growth_stage: z.string().optional(),
  general_notes: z.string().optional(),
});
type ObsForm = z.infer<typeof obsSchema>;

export default function PhenotypePage() {
  const [activeTab, setActiveTab] = useState<"observations" | "variables">("observations");
  const [selectedObs, setSelectedObs] = useState<PlotObs | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingObs, setEditingObs] = useState<PlotObs | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const queryClient = useQueryClient();

  const { data: observations, isLoading } = useQuery({
    queryKey: ["plot-observations", filterStatus],
    queryFn: () =>
      api.get<{ data: PlotObs[] }>("/v1/plot-observations", {
        params: { per_page: 100, status: filterStatus || undefined },
      }).then((r) => r.data),
  });

  const { data: obsDetail } = useQuery({
    queryKey: ["plot-obs-detail", selectedObs?.id],
    queryFn: () =>
      api.get<PlotObs>("/v1/plot-observations/" + String(selectedObs!.id)).then((r) => r.data),
    enabled: !!selectedObs && isDetailOpen,
  });

  const { data: variables } = useQuery({
    queryKey: ["phenotype-variables"],
    queryFn: () =>
      api.get<PhenotypeVariable[]>("/v1/phenotype/variables?all=true").then((r) => r.data),
  });

  const { data: trials } = useQuery({
    queryKey: ["trials-simple"],
    queryFn: () => api.get("/v1/trials?all=true").then(r => r.data as Array<{ id: number; trial_code: string; trial_name: string }>),
  });
  const { data: genotypes } = useQuery({
    queryKey: ["genotypes-simple"],
    queryFn: () => api.get("/v1/genotypes?all=true").then(r => r.data as Array<{ id: number; genotype_code: string; genotype_name: string }>),
  });
  const { data: seasons } = useQuery({
    queryKey: ["seasons-simple"],
    queryFn: () => api.get("/v1/seasons?all=true").then(r => r.data as Array<{ id: number; season_name: string }>),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ObsForm>({
    resolver: zodResolver(obsSchema),
    defaultValues: { replication: 1, observation_date: new Date().toISOString().slice(0, 10) },
  });

  const createMutation = useMutation({
    mutationFn: (data: ObsForm) => api.post("/v1/plot-observations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plot-observations"] });
      toast.success("Pengamatan berhasil dicatat");
      setIsFormOpen(false);
      setEditingObs(null);
      reset();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ObsForm> }) =>
      api.put("/v1/plot-observations/" + String(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plot-observations"] });
      toast.success("Pengamatan diperbarui");
      setIsFormOpen(false);
      setEditingObs(null);
      reset();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const openCreate = () => { setEditingObs(null); reset({ replication: 1, observation_date: new Date().toISOString().slice(0, 10) }); setIsFormOpen(true); };
  const openEdit = (obs: PlotObs) => {
    setEditingObs(obs);
    reset({ observation_date: obs.observation_date, growth_stage: obs.growth_stage ?? "", general_notes: obs.general_notes ?? "" });
    setIsFormOpen(true);
  };
  const onSubmit = (data: ObsForm) => {
    if (editingObs) updateMutation.mutate({ id: editingObs.id, data });
    else createMutation.mutate(data);
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      api.post("/v1/plot-observations/" + String(id) + "/approve", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plot-observations"] });
      if (selectedObs) {
        queryClient.invalidateQueries({ queryKey: ["plot-obs-detail", selectedObs.id] });
      }
      toast.success("Status diperbarui");
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const obs = observations?.data ?? [];
  const vars = (variables as unknown as PhenotypeVariable[]) ?? [];
  const variablesByCategory = vars.reduce<Record<string, PhenotypeVariable[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {});
  const statusCounts = obs.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const columns: ColumnDef<PlotObs, unknown>[] = [
    {
      header: "Kode",
      accessorKey: "observation_code",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-blue-700">{getValue() as string}</span>
      ),
    },
    {
      header: "Trial / Lokasi",
      id: "ctx",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-xs text-gray-500">{row.original.trial?.trial_code}</p>
          <p className="text-xs text-gray-400 truncate max-w-[120px]">
            {row.original.environment?.location?.field_name}
          </p>
        </div>
      ),
    },
    {
      header: "Genotipe",
      id: "genotype",
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-semibold text-green-700 text-sm">
            {row.original.genotype?.genotype_code}
          </span>
          <p className="text-[10px] text-gray-400">{row.original.plot?.block?.block_label ?? ""}</p>
        </div>
      ),
    },
    {
      header: "Stadia",
      accessorKey: "growth_stage",
      cell: ({ getValue }) => {
        const v = getValue() as string | undefined;
        return v ? (
          <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">
            {STAGE_LABELS[v] ?? v}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        );
      },
    },
    {
      header: "Kelengkapan",
      id: "completion",
      cell: ({ row }) => {
        const filled = row.original.total_variables_filled;
        const expected = row.original.total_variables_expected;
        const pct = expected > 0 ? Math.round((filled / expected) * 100) : 0;
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-14 h-1.5 bg-gray-100 rounded-full">
              <div
                className={cn(
                  "h-full rounded-full",
                  pct === 100 ? "bg-green-500" : pct > 50 ? "bg-yellow-500" : "bg-red-400"
                )}
                style={{ width: pct + "%" }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {filled}/{expected}
            </span>
          </div>
        );
      },
    },
    {
      header: "Tgl",
      accessorKey: "observation_date",
      cell: ({ getValue }) => (
        <span className="text-xs text-gray-500">{formatDate(getValue() as string)}</span>
      ),
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
            onClick={() => {
              setSelectedObs(row.original);
              setIsDetailOpen(true);
            }}
            className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition"
            title="Lihat Detail & Nilai"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {(row.original.status === "draft" || row.original.status === "submitted") && (
            <button
              onClick={() => openEdit(row.original)}
              className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600 transition"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {row.original.status === "submitted" && (
            <>
              <button
                onClick={() => approveMutation.mutate({ id: row.original.id, status: "approved" })}
                className="p-1.5 rounded hover:bg-green-50 text-green-500 transition"
                title="Setujui"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => approveMutation.mutate({ id: row.original.id, status: "rejected" })}
                className="p-1.5 rounded hover:bg-red-50 text-red-500 transition"
                title="Tolak"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const detailValues: ObsValue[] = (obsDetail as PlotObs)?.values ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Daftar Pengamatan Fenotipe"
        description="Data pengamatan plot-level — siap untuk ANOVA / AMMI / GGE Biplot"
        actions={
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" /> Tambah Pengamatan
          </button>
        }
      />

      {/* Status summary */}
      <div className="grid grid-cols-5 gap-3">
        {(
          [
            ["Total", obs.length, "text-gray-800 bg-gray-50 border-gray-200"],
            ["Draft", statusCounts["draft"] ?? 0, "text-gray-600 bg-gray-50 border-gray-200"],
            ["Dikirim", statusCounts["submitted"] ?? 0, "text-blue-700 bg-blue-50 border-blue-200"],
            ["Disetujui", statusCounts["approved"] ?? 0, "text-green-700 bg-green-50 border-green-200"],
            ["Ditolak", statusCounts["rejected"] ?? 0, "text-red-700 bg-red-50 border-red-200"],
          ] as [string, number, string][]
        ).map(([label, value, cls]) => (
          <div key={label} className={cn("rounded-xl border p-3 text-center", cls)}>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(
          [
            ["", "Semua"],
            ["draft", "Draft"],
            ["submitted", "Dikirim"],
            ["approved", "Disetujui"],
          ] as [string, string][]
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterStatus(v)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition",
              filterStatus === v
                ? "bg-green-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-green-300"
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(
            [
              ["observations", "Daftar Pengamatan", FlaskConical],
              ["variables", "Variabel Pengamatan", BarChart3],
            ] as [string, string, typeof FlaskConical][]
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as "observations" | "variables")}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition",
                activeTab === id
                  ? "text-green-700 border-b-2 border-green-600 bg-green-50/50"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "observations" && (
            <DataTable
              data={obs}
              columns={columns}
              isLoading={isLoading}
              searchPlaceholder="Cari kode atau genotipe..."
              emptyMessage="Belum ada data pengamatan plot"
            />
          )}

          {activeTab === "variables" && (
            <div className="space-y-5">
              {Object.entries(variablesByCategory).map(([category, catVars]) => (
                <div key={category}>
                  <h3
                    className={cn(
                      "inline-flex gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg mb-3",
                      CAT_COLORS[category] ?? "bg-gray-50 text-gray-700"
                    )}
                  >
                    {CAT_LABELS[category] ?? category}{" "}
                    <span className="text-xs font-normal">({catVars.length})</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {catVars
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((v) => (
                        <div
                          key={v.id}
                          className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/50 text-xs"
                        >
                          <p className="font-bold text-gray-800">
                            {v.abbreviation ?? v.variable_code}
                          </p>
                          <p className="text-gray-500 mt-0.5">{v.variable_name}</p>
                          {v.unit && (
                            <p className="text-gray-400 mt-1">
                              {v.unit} · {v.min_value}–{v.max_value}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {isDetailOpen && selectedObs && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between p-6 border-b">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-gray-400">
                    {selectedObs.observation_code}
                  </span>
                  <StatusBadge
                    status={(obsDetail as PlotObs)?.status ?? selectedObs.status}
                  />
                </div>
                <h3 className="text-lg font-semibold">
                  {selectedObs.genotype?.genotype_code} —{" "}
                  {selectedObs.genotype?.genotype_name}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedObs.trial?.trial_code} ·{" "}
                  {selectedObs.environment?.location?.field_name} ·{" "}
                  {STAGE_LABELS[selectedObs.growth_stage ?? ""] ??
                    selectedObs.growth_stage}{" "}
                  · {formatDate(selectedObs.observation_date)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(obsDetail as PlotObs)?.status === "submitted" && (
                  <>
                    <button
                      onClick={() =>
                        approveMutation.mutate({
                          id: selectedObs.id,
                          status: "approved",
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                    </button>
                    <button
                      onClick={() =>
                        approveMutation.mutate({
                          id: selectedObs.id,
                          status: "rejected",
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Tolak
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Context grid */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                {(
                  [
                    ["Plot", selectedObs.plot?.plot_code ?? "—"],
                    ["Blok", selectedObs.plot?.block?.block_label ?? "—"],
                    [
                      "HST",
                      selectedObs.days_after_planting
                        ? String(selectedObs.days_after_planting) + " hari"
                        : "—",
                    ],
                    ["Pencatat", selectedObs.recorder?.name ?? "—"],
                  ] as [string, string][]
                ).map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-gray-400 mb-0.5">{l}</p>
                    <p className="font-semibold text-gray-800 truncate">{v}</p>
                  </div>
                ))}
              </div>

              {selectedObs.general_notes && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                  <p className="font-semibold text-xs mb-1">Catatan</p>
                  {selectedObs.general_notes}
                </div>
              )}

              {/* Values */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  Nilai Pengamatan
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
                    {detailValues.length} variabel
                  </span>
                </h4>
                {detailValues.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl text-sm">
                    Belum ada nilai tercatat
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {detailValues.map((val) => (
                      <div
                        key={val.id}
                        className={cn(
                          "rounded-lg border p-3",
                          val.is_outlier
                            ? "border-orange-200 bg-orange-50"
                            : "border-gray-100 bg-gray-50/50"
                        )}
                      >
                        <p className="text-xs text-gray-400">
                          {val.variable?.variable_name}
                        </p>
                        <p className="font-bold text-lg text-gray-900 mt-0.5">
                          {val.numeric_value ?? val.text_value ?? "—"}
                          {val.variable?.unit && (
                            <span className="text-xs text-gray-400 font-normal ml-1">
                              {val.variable.unit}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono mt-1">
                          {val.variable?.variable_code}
                        </p>
                        {val.is_outlier && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-1 rounded">
                            Outlier
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Observation Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">
                {editingObs ? "Edit Pengamatan" : "Tambah Pengamatan Baru"}
              </h3>
              <button onClick={() => { setIsFormOpen(false); setEditingObs(null); reset(); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {!editingObs && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trial *</label>
                      <select {...register("trial_id")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">-- Pilih Trial --</option>
                        {trials?.map(t => <option key={t.id} value={t.id}>{t.trial_code}</option>)}
                      </select>
                      {errors.trial_id && <p className="text-red-500 text-xs mt-1">{errors.trial_id.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Genotipe *</label>
                      <select {...register("genotype_id")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">-- Pilih Genotipe --</option>
                        {genotypes?.map(g => <option key={g.id} value={g.id}>{g.genotype_code} - {g.genotype_name}</option>)}
                      </select>
                      {errors.genotype_id && <p className="text-red-500 text-xs mt-1">{errors.genotype_id.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Musim *</label>
                      <select {...register("season_id")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="">-- Pilih Musim --</option>
                        {seasons?.map(s => <option key={s.id} value={s.id}>{s.season_name}</option>)}
                      </select>
                      {errors.season_id && <p className="text-red-500 text-xs mt-1">{errors.season_id.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ulangan *</label>
                      <input {...register("replication")} type="number" min="1" max="20"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pengamatan *</label>
                  <input {...register("observation_date")} type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  {errors.observation_date && <p className="text-red-500 text-xs mt-1">{errors.observation_date.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stadia Tumbuh</label>
                  <select {...register("growth_stage")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih --</option>
                    {Object.entries(STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Umum</label>
                <textarea {...register("general_notes")} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Kondisi tanaman, cuaca, catatan khusus..." />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsFormOpen(false); setEditingObs(null); reset(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {isSubmitting ? "Menyimpan..." : editingObs ? "Simpan Perubahan" : "Tambah Pengamatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
