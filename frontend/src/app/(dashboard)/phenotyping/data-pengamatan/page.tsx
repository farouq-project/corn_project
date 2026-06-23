"use client";

import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Sheet, Upload, Download, CheckCircle, XCircle, AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { ObservationGrid } from "@/components/phenotyping/ObservationGrid";
import { phenotypingService } from "@/services/phenotyping.service";
import { genotypeService } from "@/services/genotype.service";
import type { Characteristic, Environment, Genotype, ObservationRecord, Trial } from "@/types";

const schema = z.object({
  plot_no: z.string().min(1, "No Plot wajib diisi").max(20),
  genotype_id: z.coerce.number({ message: "Genotipe wajib dipilih" }).int().positive(),
  environment_id: z.coerce.number({ message: "Environment wajib dipilih" }).int().positive(),
  replication: z.coerce.number().int().min(1, "Replikasi minimal 1"),
});

type FormData = z.infer<typeof schema>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

interface ImportBatch { id:number; batch_code:string; original_filename:string; total_rows:number; valid_rows:number; invalid_rows:number; warning_rows:number; imported_rows:number; status:string; is_rolled_back:boolean; }
interface StagingRow { id:number; row_number:number; raw_data:Record<string,string>; status:"pending"|"valid"|"warning"|"invalid"; errors?:string[]; warnings?:string[]; }

export default function DataPengamatanPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number|null>(null);
  const [previewFilter, setPreviewFilter] = useState("");
  const [trialFilter, setTrialFilter] = useState<string>("");
  const [environmentFilter, setEnvironmentFilter] = useState<string>("");
  const [modalTrial, setModalTrial] = useState<string>("");
  const importFileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: trialsData } = useQuery({
    queryKey: ["trials-simple"],
    queryFn: () => api.get<{ data: Trial[] }>("/v1/trials", { params: { per_page: 100 } }).then((r) => r.data.data),
  });
  const trials: Trial[] = trialsData ?? [];

  const { data: characteristicsData } = useQuery({
    queryKey: ["characteristics"],
    queryFn: () => phenotypingService.getCharacteristics({ active_only: true }).then((r) => r.data),
  });
  const characteristics: Characteristic[] = characteristicsData ?? [];

  const { data: genotypesData } = useQuery({
    queryKey: ["genotypes"],
    queryFn: () => genotypeService.getAll({ all: true }).then((r) => r.data as Genotype[]),
  });
  const genotypes = genotypesData ?? [];

  const { data: allEnvironmentsData } = useQuery({
    queryKey: ["environments"],
    queryFn: () => api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 100 } }).then((r) => r.data.data),
  });
  const allEnvironments: Environment[] = allEnvironmentsData ?? [];

  // Environments for selected trial in the modal
  const { data: trialEnvsData } = useQuery({
    queryKey: ["environments", "for-trial", modalTrial],
    queryFn: () =>
      api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 100, trial_id: modalTrial } }).then((r) => r.data.data),
    enabled: !!modalTrial,
  });
  const modalEnvironments: Environment[] = modalTrial ? (trialEnvsData ?? []) : allEnvironments;

  const selectedTrialObj = useMemo(() => trials.find((t) => String(t.id) === modalTrial), [trials, modalTrial]);
  const maxReplications = selectedTrialObj?.replications ?? 10;
  const replicationOptions = Array.from({ length: maxReplications }, (_, i) => i + 1);

  const { data: recordsData, isLoading } = useQuery({
    queryKey: ["observation-records", environmentFilter],
    queryFn: () =>
      phenotypingService
        .getRecords({ per_page: 200, ...(environmentFilter ? { environment_id: environmentFilter } : {}) })
        .then((r) => r.data),
  });
  const records: ObservationRecord[] = recordsData?.data ?? [];

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { replication: 1 },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => phenotypingService.createRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["observation-records"] });
      toast.success("Baris pengamatan berhasil ditambahkan");
      setIsModalOpen(false);
      reset({ replication: 1 });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateValueMutation = useMutation({
    mutationFn: ({ record, characteristic, value }: { record: ObservationRecord; characteristic: Characteristic; value: number | null }) =>
      phenotypingService.updateRecord(record.id, { values: [{ characteristic_id: characteristic.id, value }] }),
    onMutate: async ({ record, characteristic, value }) => {
      await queryClient.cancelQueries({ queryKey: ["observation-records", environmentFilter] });
      const previous = queryClient.getQueryData<{ data: ObservationRecord[] }>(["observation-records", environmentFilter]);
      queryClient.setQueryData<{ data: ObservationRecord[] } | undefined>(["observation-records", environmentFilter], (old) => {
        if (!old) return old;
        return { ...old, data: old.data.map((r) => r.id === record.id ? { ...r, values: { ...r.values, [characteristic.code]: value } } : r) };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["observation-records", environmentFilter], context.previous);
      toast.error(getApiErrorMessage(error));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observation-records"] }); },
  });

  // Import queries & mutations
  const { data: batchesData } = useQuery({ queryKey: ["import-batches"], queryFn: () => api.get<{data:ImportBatch[]}>("/v1/phenotyping/import/batches").then(r => r.data.data), enabled: showImport, refetchInterval: showImport ? 5000 : false });
  const batches: ImportBatch[] = batchesData ?? [];
  const selectedBatch = batches.find(b => b.id === selectedBatchId) ?? null;

  const { data: previewData, isLoading: previewLoading } = useQuery({ queryKey: ["import-preview", selectedBatchId, previewFilter], queryFn: () => api.get(`/v1/phenotyping/import/batches/${selectedBatchId}/preview`, {params:{status:previewFilter||undefined,per_page:30}}).then(r => r.data), enabled: !!selectedBatchId && ["validated","completed"].includes(selectedBatch?.status ?? "") });
  const previewRows: StagingRow[] = (previewData as {rows?:StagingRow[]})?.rows ?? [];

  const uploadMutation = useMutation({ mutationFn: (file: File) => { const fd=new FormData(); fd.append("file",file); return api.post<{batch:ImportBatch}>("/v1/phenotyping/import/upload",fd,{headers:{"Content-Type":"multipart/form-data"}}); }, onSuccess: res => { queryClient.invalidateQueries({queryKey:["import-batches"]}); setSelectedBatchId(res.data.batch.id); toast.success(`File diupload: ${res.data.batch.total_rows} baris`); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const validateMutation = useMutation({ mutationFn: (id:number) => api.post(`/v1/phenotyping/import/batches/${id}/validate`), onSuccess: () => { queryClient.invalidateQueries({queryKey:["import-batches"]}); queryClient.invalidateQueries({queryKey:["import-preview"]}); toast.success("Validasi selesai"); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const confirmMutation = useMutation({ mutationFn: (id:number) => api.post(`/v1/phenotyping/import/batches/${id}/confirm`), onSuccess: res => { queryClient.invalidateQueries({queryKey:["import-batches"]}); queryClient.invalidateQueries({queryKey:["observation-records"]}); toast.success((res.data as {message?:string})?.message ?? "Import selesai"); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const rollbackMutation = useMutation({ mutationFn: (id:number) => api.post(`/v1/phenotyping/import/batches/${id}/rollback`), onSuccess: res => { queryClient.invalidateQueries({queryKey:["import-batches"]}); queryClient.invalidateQueries({queryKey:["observation-records"]}); toast.success((res.data as {message?:string})?.message ?? "Rollback selesai"); }, onError: e => toast.error(getApiErrorMessage(e)) });

  const STATUS_COLOR: Record<string,string> = { parsed:"bg-yellow-50 text-yellow-700", validated:"bg-green-50 text-green-700", completed:"bg-emerald-50 text-emerald-700", failed:"bg-red-50 text-red-700", rolled_back:"bg-gray-100 text-gray-500" };
  const STATUS_LABEL: Record<string,string> = { uploaded:"Diunggah", parsing:"Parsing...", parsed:"Diparsing", validating:"Memvalidasi...", validated:"Siap Impor", importing:"Mengimpor...", completed:"Selesai", failed:"Gagal", rolled_back:"Di-rollback" };

  const openModal = () => {
    setModalTrial(trialFilter);
    reset({ replication: 1 });
    setIsModalOpen(true);
  };

  const onSubmit = (data: FormData) => createMutation.mutate(data);

  return (
    <div className="space-y-6 max-w-full mx-auto">
      <PageHeader
        title="Data Pengamatan"
        description="Entri data pengamatan fenotipe per plot/replikasi, mengikuti format spreadsheet lapangan"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowImport(v => !v)} className="flex items-center gap-2 px-3 py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition">
              <Upload className="w-4 h-4" /> Import
            </button>
            <button onClick={openModal} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
              <Plus className="w-4 h-4" /> Tambah Baris
            </button>
          </div>
        }
      />

      {/* ── Inline import panel ── */}
      {showImport && (
        <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-800">Import Data Pengamatan</p>
            <button onClick={() => setShowImport(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          {/* Step 1: upload */}
          <div className="flex flex-wrap gap-3">
            <a href={`${API_BASE}/v1/phenotyping/import/template`} download className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition"><Download className="w-4 h-4"/> Download Template</a>
            <button onClick={() => importFileRef.current?.click()} disabled={uploadMutation.isPending} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50"><Upload className="w-4 h-4"/>{uploadMutation.isPending?"Mengupload...":"Upload File"}</button>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) uploadMutation.mutate(f); e.target.value=""; }} />
          </div>
          {/* Batch list */}
          {batches.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {batches.slice(0,5).map(b => (
                <div key={b.id} onClick={() => setSelectedBatchId(b.id===selectedBatchId?null:b.id)} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition border-b last:border-0 ${selectedBatchId===b.id?"bg-green-50":""}`}>
                  <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-800 truncate">{b.original_filename}</p><p className="text-[10px] text-gray-400">{b.batch_code} · {b.total_rows} baris</p></div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLOR[b.status]??"bg-gray-100 text-gray-500"}`}>{STATUS_LABEL[b.status]??b.status}</span>
                </div>
              ))}
            </div>
          )}
          {/* Selected batch actions */}
          {selectedBatch && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[["Total",selectedBatch.total_rows,"bg-gray-50"],["Valid",selectedBatch.valid_rows,"bg-green-50 text-green-700"],["Peringatan",selectedBatch.warning_rows,"bg-yellow-50 text-yellow-700"],["Error",selectedBatch.invalid_rows,"bg-red-50 text-red-700"]].map(([l,v,cls]) => (
                  <div key={l as string} className={`rounded-lg p-2 ${cls}`}><p className="text-base font-bold">{v}</p><p className="text-[10px]">{l}</p></div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedBatch.status==="parsed" && <button onClick={() => validateMutation.mutate(selectedBatch.id)} disabled={validateMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"><RefreshCw className="w-3.5 h-3.5"/>{validateMutation.isPending?"Memvalidasi...":"Validasi"}</button>}
                {selectedBatch.status==="validated" && <button onClick={() => { if(confirm(`Import ${selectedBatch.valid_rows} baris valid?`)) confirmMutation.mutate(selectedBatch.id); }} disabled={confirmMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"><CheckCircle className="w-3.5 h-3.5"/>{confirmMutation.isPending?"Mengimpor...":`Konfirmasi (${selectedBatch.valid_rows} baris)`}</button>}
                {selectedBatch.status==="completed" && !selectedBatch.is_rolled_back && <button onClick={() => { if(confirm("Rollback akan menghapus data yang diimpor. Lanjutkan?")) rollbackMutation.mutate(selectedBatch.id); }} disabled={rollbackMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5"/>Rollback</button>}
              </div>
              {/* Preview rows */}
              {["validated","completed"].includes(selectedBatch.status) && (
                <div>
                  <div className="flex gap-2 mb-2 items-center">
                    <p className="text-xs font-medium text-gray-600">Preview baris:</p>
                    <select value={previewFilter} onChange={e => setPreviewFilter(e.target.value)} className="text-xs px-2 py-0.5 border border-gray-200 rounded">
                      <option value="">Semua</option><option value="valid">Valid</option><option value="warning">Peringatan</option><option value="invalid">Error</option>
                    </select>
                  </div>
                  <div className="overflow-auto max-h-48 rounded border border-gray-200 text-xs">
                    {previewLoading ? <div className="p-4 text-center text-gray-400">Memuat...</div> :
                    previewRows.length === 0 ? <div className="p-4 text-center text-gray-400">Tidak ada baris</div> :
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50 sticky top-0"><tr>{["#","Status","No Plot","Kode Gen","Env","R","Pesan"].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-gray-50 bg-white">{previewRows.map(row => (
                        <tr key={row.id} className={row.status==="invalid"?"bg-red-50/30":row.status==="warning"?"bg-yellow-50/30":""}>
                          <td className="px-2 py-1.5 text-gray-400">{row.row_number}</td>
                          <td className="px-2 py-1.5">{row.status==="valid"?<CheckCircle className="w-3.5 h-3.5 text-green-500"/>:row.status==="warning"?<AlertTriangle className="w-3.5 h-3.5 text-yellow-500"/>:<XCircle className="w-3.5 h-3.5 text-red-500"/>}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.raw_data["No Plot"]??"-"}</td>
                          <td className="px-2 py-1.5 font-mono whitespace-nowrap">{row.raw_data["Kode Gen"]??"-"}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.raw_data["Environment"]??"-"}</td>
                          <td className="px-2 py-1.5">{row.raw_data["R"]??"-"}</td>
                          <td className="px-2 py-1.5 text-red-600">{[...(row.errors??[]),...(row.warnings??[])].join("; ")}</td>
                        </tr>
                      ))}</tbody>
                    </table>}
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400">Template: No Plot · Kode Gen · Gen · Environment · R · [kolom karakteristik]. Sel kosong → tidak mengubah nilai yang sudah ada.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <label className="text-sm text-gray-600 flex-shrink-0">Filter:</label>
        <select
          value={trialFilter}
          onChange={(e) => { setTrialFilter(e.target.value); setEnvironmentFilter(""); }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
        >
          <option value="">Semua Research Plan</option>
          {trials.map((t) => <option key={t.id} value={t.id}>{t.trial_name}</option>)}
        </select>

        <select
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
        >
          <option value="">Semua Environment</option>
          {allEnvironments.map((env) => <option key={env.id} value={env.id}>{env.environment_code}</option>)}
        </select>
      </div>

      {characteristics.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <Sheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada karakteristik aktif. Tambahkan di Master Data → Pengamatan terlebih dahulu.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <ObservationGrid
            records={records}
            characteristics={characteristics}
            isLoading={isLoading}
            onCellChange={(record, characteristic, value) => updateValueMutation.mutate({ record, characteristic, value })}
          />
        </div>
      )}

      {/* Add Row Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Tambah Baris Pengamatan</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              {/* Trial selector (drives filtered envs + rep options) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Research Plan</label>
                <select
                  value={modalTrial}
                  onChange={(e) => {
                    setModalTrial(e.target.value);
                    setValue("environment_id", 0 as never);
                    setValue("replication", 1);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Semua Research Plan</option>
                  {trials.map((t) => <option key={t.id} value={t.id}>{t.trial_name}</option>)}
                </select>
                {selectedTrialObj && (
                  <p className="text-xs text-green-600 mt-1">{selectedTrialObj.replications} ulangan (R1–R{selectedTrialObj.replications})</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No Plot</label>
                <input {...register("plot_no")} placeholder="contoh: 1, A1, dst"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {errors.plot_no && <p className="text-xs text-red-500 mt-1">{errors.plot_no.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genotipe</label>
                <select {...register("genotype_id")} defaultValue=""
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="" disabled>Pilih genotipe</option>
                  {genotypes.map((g) => <option key={g.id} value={g.id}>{g.genotype_code} — {g.genotype_name}</option>)}
                </select>
                {errors.genotype_id && <p className="text-xs text-red-500 mt-1">{errors.genotype_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Environment {modalTrial && <span className="text-xs text-gray-400">(dari trial)</span>}
                </label>
                <select {...register("environment_id")} defaultValue=""
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="" disabled>Pilih environment</option>
                  {modalEnvironments.map((env) => <option key={env.id} value={env.id}>{env.environment_code}</option>)}
                </select>
                {errors.environment_id && <p className="text-xs text-red-500 mt-1">{errors.environment_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Replikasi (R)</label>
                {selectedTrialObj ? (
                  <select {...register("replication")} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {replicationOptions.map((r) => <option key={r} value={r}>R{r}</option>)}
                  </select>
                ) : (
                  <input type="number" min={1} {...register("replication")}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                )}
                {errors.replication && <p className="text-xs text-red-500 mt-1">{errors.replication.message}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
