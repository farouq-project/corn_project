"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin, Calendar, Users, Dna, Package2, FlaskConical,
  Plus, Grid3x3, CheckCircle2, AlertTriangle, ArrowLeft,
  Settings2, Loader2, X
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import api from "@/lib/axios";
import { formatDate, cn, getStatusColor } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getApiErrorMessage } from "@/lib/axios";
import type { Trial, Environment } from "@/types";

type Tab = "overview" | "plots" | "design" | "observations" | "disease";

export default function TrialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isRcbdModalOpen, setIsRcbdModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: trial, isLoading } = useQuery({
    queryKey: ["trial", id],
    queryFn: () => api.get<Trial>(`/v1/trials/${id}`).then((r) => r.data),
  });

  const { data: plotMatrix } = useQuery({
    queryKey: ["trial-plot-matrix", id],
    queryFn: () => api.get(`/v1/trials/${id}/plots`).then((r) => r.data as Record<string, unknown>[]),
    enabled: activeTab === "plots" || activeTab === "design",
  });

  const { data: missingReport } = useQuery({
    queryKey: ["missing-report", id],
    queryFn: () => api.get(`/v1/plot-observations/missing-report`, { params: { trial_id: id } }).then((r) => r.data),
    enabled: activeTab === "observations",
  });

  const { data: environments } = useQuery({
    queryKey: ["environments-for-trial", id],
    queryFn: () => api.get<{ data: Environment[] }>(`/v1/environments`, { params: { trial_id: id } }).then((r) => r.data),
  });

  const { data: availableLocations } = useQuery({
    queryKey: ["locations-simple"],
    queryFn: () => api.get("/v1/locations?all=true").then((r) => r.data as Array<{ id: number; field_name: string; field_code: string }>),
  });

  const { data: availableSeasons } = useQuery({
    queryKey: ["seasons-simple"],
    queryFn: () => api.get("/v1/seasons?all=true").then((r) => r.data as Array<{ id: number; season_name: string }>),
  });

  const rcbdForm = useForm({
    defaultValues: {
      environment_id: "",
      replications: 3,
      seed: 0,
      plot_length_m: 5,
      plot_width_m: 3.6,
      plant_spacing_cm: 20,
      row_spacing_cm: 75,
    },
  });

  const envForm = useForm({ defaultValues: { location_id: "", season_id: "", irrigation_type: "rainfed", planting_date: "" } });

  const generateRcbdMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post(`/v1/trials/${id}/plots/generate-rcbd`, data),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["trial-plot-matrix", id] });
      queryClient.invalidateQueries({ queryKey: ["trial", id] });
      toast.success(r.data.message || "RCBD plots generated successfully");
      setIsRcbdModalOpen(false);
      rcbdForm.reset();
      setActiveTab("design");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const createEnvMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post(`/v1/environments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["environments-for-trial", id] });
      toast.success("Environment added");
      setIsEnvModalOpen(false);
      envForm.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "design", label: "Layout RCBD" },
    { id: "plots", label: `Plot (${(plotMatrix as unknown[])?.length ?? 0})` },
    { id: "observations", label: "Pengamatan" },
    { id: "disease", label: "Evaluasi Penyakit" },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>;
  }

  if (!trial) return <div className="p-8 text-gray-400">Trial not found</div>;

  const envList = (environments as unknown as { data: Environment[] })?.data ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/trials" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-3 transition">
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Trials
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-400">{trial.trial_code}</span>
              <StatusBadge status={trial.status} />
              {(trial as unknown as { trial_category?: string }).trial_category && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {(trial as unknown as { trial_category?: string }).trial_category?.replace('_', ' ')}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{trial.trial_name}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEnvModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Tambah Lokasi
            </button>
            <button
              onClick={() => setIsRcbdModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
            >
              <Grid3x3 className="w-4 h-4" /> Generate RCBD
            </button>
          </div>
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Musim", value: trial.season?.season_name, icon: Calendar },
          { label: "Lokasi Utama", value: trial.location?.field_name, icon: MapPin },
          { label: "Desain", value: trial.layout_design, icon: Grid3x3 },
          { label: "Ulangan", value: `${trial.replications}×`, icon: Settings2 },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{item.label}</p>
            <div className="flex items-center gap-2">
              <item.icon className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-800 text-sm truncate">{item.value ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Environments enrolled */}
      {envList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-500" />
            Lokasi Uji ({envList.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {envList.map((env) => (
              <div key={env.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <p className="font-medium text-sm text-gray-800 truncate">{env.location?.field_name ?? env.environment_code}</p>
                <p className="text-xs text-gray-400 mt-0.5">{env.season?.season_name}</p>
                <p className="text-xs text-blue-500 font-mono mt-1">{env.environment_code}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-3.5 text-sm font-medium transition whitespace-nowrap",
                activeTab === tab.id
                  ? "text-green-700 border-b-2 border-green-600 bg-green-50/50"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {trial.objective && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-1">Tujuan Penelitian</h3>
                  <p className="text-sm text-gray-700">{trial.objective}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Genotipe ({trial.genotypes?.length ?? 0})</h3>
                  <div className="space-y-1">
                    {trial.genotypes?.slice(0, 8).map((g) => (
                      <div key={g.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="font-mono text-green-700">{g.genotype_code}</span>
                        <span className="text-gray-400 truncate">{g.genotype_name}</span>
                        {g.pivot?.is_check && <span className="text-orange-500 font-bold">✓ Check</span>}
                      </div>
                    ))}
                    {(trial.genotypes?.length ?? 0) > 8 && (
                      <p className="text-xs text-gray-400">+{(trial.genotypes?.length ?? 0) - 8} more</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Peneliti</h3>
                  <div className="space-y-1">
                    {trial.researchers?.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px]">
                          {r.name.charAt(0)}
                        </div>
                        <span className="text-gray-700">{r.name}</span>
                        <span className="text-gray-400 capitalize">{r.pivot?.role?.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "design" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Layout Percobaan RCBD</h3>
                <button onClick={() => setIsRcbdModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition">
                  <Grid3x3 className="w-3.5 h-3.5" /> Generate Baru
                </button>
              </div>
              {!plotMatrix || (plotMatrix as unknown[]).length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Grid3x3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Belum ada layout plot.</p>
                  <p className="text-xs mt-1">Assign genotipe ke trial, lalu klik Generate RCBD.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <p className="text-xs text-gray-400 mb-2">{(plotMatrix as unknown[]).length} plot total</p>
                  <div className="text-xs space-y-1">
                    {/* Group by block */}
                    {Object.entries(
                      ((plotMatrix as unknown[]) || []).reduce<Record<string, unknown[]>>((acc, plot: unknown) => {
                        const p = plot as { trial_block_id?: string; block?: { block_label?: string } };
                        const blockLabel = p.block?.block_label ?? `Block ${p.trial_block_id}`;
                        if (!acc[blockLabel]) acc[blockLabel] = [];
                        acc[blockLabel].push(plot);
                        return acc;
                      }, {})
                    ).map(([blockLabel, blockPlots]) => (
                      <div key={blockLabel} className="mb-3">
                        <p className="font-semibold text-gray-600 mb-1">{blockLabel}</p>
                        <div className="flex flex-wrap gap-1">
                          {(blockPlots as Array<{ id: number; plot_code: string; genotype?: { genotype_code: string }; entry_number?: number; is_check?: boolean }>).map((plot) => (
                            <div
                              key={plot.id}
                              className={cn(
                                "border rounded px-2 py-1 text-center min-w-[70px]",
                                plot.is_check ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-gray-50"
                              )}
                            >
                              <p className="font-mono text-[10px] text-gray-400">{plot.plot_code?.slice(-6)}</p>
                              <p className="font-semibold text-green-700 text-xs">{plot.genotype?.genotype_code ?? `E${plot.entry_number}`}</p>
                              {plot.is_check && <p className="text-[9px] text-orange-500">Check</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "plots" && (
            <div>
              <p className="text-sm text-gray-500 mb-4">{(plotMatrix as unknown[])?.length ?? 0} plot terdaftar</p>
              {(plotMatrix as unknown[])?.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Belum ada plot. Generate RCBD terlebih dahulu.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Plot Code", "No. Plot", "Genotipe", "Blok/Ulangan", "Lokasi", "Status"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {((plotMatrix as unknown[]) || []).slice(0, 50).map((plot: unknown) => {
                        const p = plot as {
                          id: number; plot_code: string; plot_number: number;
                          genotype?: { genotype_code: string; genotype_name: string };
                          block?: { block_label: string };
                          environment?: { location?: { field_name: string } };
                          status: string;
                        };
                        return (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 font-mono text-blue-700">{p.plot_code}</td>
                            <td className="px-3 py-1.5">{p.plot_number}</td>
                            <td className="px-3 py-1.5"><span className="font-semibold text-green-700">{p.genotype?.genotype_code}</span> {p.genotype?.genotype_name}</td>
                            <td className="px-3 py-1.5">{p.block?.block_label}</td>
                            <td className="px-3 py-1.5">{p.environment?.location?.field_name}</td>
                            <td className="px-3 py-1.5"><StatusBadge status={p.status} size="sm" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "observations" && missingReport && (
            <div className="space-y-4">
              {/* Completion stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Plot", value: (missingReport as Record<string, unknown>).total_plots, color: "text-gray-700" },
                  { label: "Sudah Diamati", value: (missingReport as Record<string, unknown>).observed_plots, color: "text-green-600" },
                  { label: "Belum Diamati", value: (missingReport as Record<string, unknown>).missing_plots, color: "text-red-600" },
                  { label: "Kelengkapan", value: `${(missingReport as Record<string, unknown>).completion_rate}%`, color: "text-blue-600" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                    <p className={cn("text-xl font-bold", stat.color)}>{stat.value as string}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Missing plots */}
              {((missingReport as Record<string, unknown[]>).missing ?? []).length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    Plot Belum Diamati
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {((missingReport as Record<string, Array<Record<string, string>>>).missing ?? []).map((p) => (
                      <div key={p.plot_code} className="text-xs border border-orange-100 bg-orange-50 rounded px-2 py-1.5">
                        <p className="font-mono text-orange-700">{p.plot_code}</p>
                        <p className="text-gray-500">{p.genotype} · {p.block}</p>
                        <p className="text-gray-400 truncate">{p.environment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "disease" && (
            <div className="text-center py-12 text-gray-400">
              <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Lihat evaluasi penyakit di menu Evaluasi Penyakit</p>
              <Link href="/disease" className="text-green-600 text-sm hover:underline mt-2 block">
                Buka Evaluasi Penyakit →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* RCBD Modal */}
      {isRcbdModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold">Generate RCBD Layout</h3>
                <p className="text-xs text-gray-400 mt-0.5">{trial.genotypes?.length ?? 0} genotipe × N ulangan = N×{trial.genotypes?.length ?? 0} plot</p>
              </div>
              <button onClick={() => setIsRcbdModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={rcbdForm.handleSubmit((d) => generateRcbdMutation.mutate(d as Record<string, unknown>))} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi / Environment *</label>
                <select {...rcbdForm.register("environment_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">-- Pilih Environment --</option>
                  {envList.map((e) => <option key={e.id} value={e.id}>{e.environment_code} — {e.location?.field_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Ulangan *</label>
                  <input {...rcbdForm.register("replications")} type="number" min="1" max="10" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seed Randomisasi</label>
                  <input {...rcbdForm.register("seed")} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0 = acak" />
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                <strong>Plot yang akan dibuat:</strong> {(trial.genotypes?.length ?? 0)} genotipe × {rcbdForm.watch("replications")} ulangan = <strong>{(trial.genotypes?.length ?? 0) * Number(rcbdForm.watch("replications"))} plot</strong>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Panjang Plot (m)</label>
                  <input {...rcbdForm.register("plot_length_m")} type="number" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lebar Plot (m)</label>
                  <input {...rcbdForm.register("plot_width_m")} type="number" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsRcbdModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={generateRcbdMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {generateRcbdMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Grid3x3 className="w-4 h-4" />Generate Layout</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Environment Modal */}
      {isEnvModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Tambah Lokasi Uji</h3>
              <button onClick={() => setIsEnvModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={envForm.handleSubmit((d) => {
              createEnvMutation.mutate({ ...d, trial_id: id });
            })} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi *</label>
                <select {...envForm.register("location_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">-- Pilih Lokasi --</option>
                  {availableLocations?.map((l) => <option key={l.id} value={l.id}>{l.field_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Musim *</label>
                <select {...envForm.register("season_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">-- Pilih Musim --</option>
                  {availableSeasons?.map((s) => <option key={s.id} value={s.id}>{s.season_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sistem Irigasi</label>
                  <select {...envForm.register("irrigation_type")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="rainfed">Tadah Hujan</option>
                    <option value="irrigated">Irigasi</option>
                    <option value="supplemental">Irigasi Suplementer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Tanam</label>
                  <input {...envForm.register("planting_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsEnvModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createEnvMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                  {createEnvMutation.isPending ? "Menyimpan..." : "Tambah Lokasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
