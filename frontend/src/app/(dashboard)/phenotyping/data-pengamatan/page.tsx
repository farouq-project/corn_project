"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Sheet, Upload, Download, CheckCircle, XCircle, AlertTriangle, RefreshCw, RotateCcw, ChevronRight, ChevronLeft, Save, Eye, Trash2, History, Undo2, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { ObservationGrid } from "@/components/phenotyping/ObservationGrid";
import { phenotypingService } from "@/services/phenotyping.service";
import { genotypeService } from "@/services/genotype.service";
import { cn } from "@/lib/utils";
import type { Characteristic, Environment, Genotype, GridRow, ObservationRecord, Trial } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

interface ImportBatch { id:number; batch_code:string; original_filename:string; total_rows:number; valid_rows:number; invalid_rows:number; warning_rows:number; imported_rows:number; status:string; is_rolled_back:boolean; }
interface StagingRow { id:number; row_number:number; raw_data:Record<string,string>; status:"pending"|"valid"|"warning"|"invalid"; errors?:string[]; warnings?:string[]; }

export default function DataPengamatanPage() {
  // ── Page state ──────────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number|null>(null);
  const [previewFilter, setPreviewFilter] = useState("");
  const [trialFilter, setTrialFilter] = useState<string>("");
  const [environmentFilter, setEnvironmentFilter] = useState<string>("");
  const importFileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // ── Wizard state ────────────────────────────────────────────────────────────
  const [dismissedBatchIds, setDismissedBatchIds] = useState<Set<number>>(new Set());
  const [viewingRecord, setViewingRecord] = useState<ObservationRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<ObservationRecord | null>(null);
  // Multi-sample state per characteristic in wizard step 3
  const [charSamples, setCharSamples] = useState<Record<string, string[]>>({});
  const { user } = useAuthStore();
  const canEdit = !user?.roles?.includes("colaborator");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars — charValues replaced by charSamples
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1|2|3>(1);
  // Step 1 fields
  const [wizRP, setWizRP] = useState<string>("");           // research plan id
  const [wizPlot, setWizPlot] = useState("");
  const [wizGeno, setWizGeno] = useState<string>("");
  const [wizRep, setWizRep] = useState<number>(1);
  const [wizEnv, setWizEnv] = useState<number|null>(null);
  // Step 2: which characteristics are selected
  const [selectedCharCodes, setSelectedCharCodes] = useState<Set<string>>(new Set());
  // Step 3: values per characteristic code
  const [submitting, setSubmitting] = useState(false);

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

  // Wizard-derived data
  const { data: wizTrialEnvsData } = useQuery({
    queryKey: ["environments", "for-trial", wizRP],
    queryFn: () => api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 100, trial_id: wizRP } }).then(r => r.data.data),
    enabled: !!wizRP, staleTime: 0,
  });
  const wizTrialEnvs: Environment[] = wizTrialEnvsData ?? [];
  const wizEnvOptions: Environment[] = wizRP ? (wizTrialEnvs.length > 0 ? wizTrialEnvs : allEnvironments) : allEnvironments;

  const wizSelectedTrial = useMemo(() => trials.find(t => String(t.id) === wizRP), [trials, wizRP]);
  const wizMaxReps = wizSelectedTrial?.replications ?? 10;
  const wizRepOptions = Array.from({ length: wizMaxReps }, (_, i) => i + 1);

  const charsByGroup = useMemo(() => {
    const grouped: Record<string, Characteristic[]> = {};
    for (const c of characteristics) {
      const g = c.group ?? "Lainnya";
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(c);
    }
    return grouped;
  }, [characteristics]);

  const openWizard = () => {
    setWizRP(trialFilter);
    setWizPlot(""); setWizGeno(""); setWizRep(1); setWizEnv(null);
    setSelectedCharCodes(new Set()); setCharSamples({});
    setWizardStep(1);
    setWizardOpen(true);
  };

  const resetWizardStep1 = () => {
    setWizPlot(""); setWizGeno(""); setWizRep(1); setWizEnv(null);
    setSelectedCharCodes(new Set()); setCharSamples({});
    setWizardStep(1);
  };

  const goToStep2 = () => {
    if (!wizPlot.trim()) { toast.error("No Plot wajib diisi"); return; }
    if (!wizGeno) { toast.error("Genotipe wajib dipilih"); return; }
    const envId = wizEnv ?? (wizEnvOptions.length === 1 ? wizEnvOptions[0].id : null);
    if (!envId) { toast.error("Lokasi wajib dipilih"); return; }
    setWizEnv(envId);
    setWizardStep(2);
  };

  const goToStep3 = () => {
    if (selectedCharCodes.size === 0) { toast.error("Pilih minimal satu karakteristik"); return; }
    setWizardStep(3);
  };

  const submitWizard = async (continueNext: boolean) => {
    // Resolve environment: use wizard state, fall back to single env in list
    const resolvedEnv = wizEnv ?? (wizEnvOptions.length === 1 ? wizEnvOptions[0].id : null);
    const genoId = Number(wizGeno);

    // Pre-submit validation
    if (!wizPlot.trim()) { toast.error("No Plot wajib diisi"); return; }
    if (!genoId || isNaN(genoId)) { toast.error("Genotipe wajib dipilih"); return; }
    if (!resolvedEnv) { toast.error("Lokasi tidak ditemukan — pastikan Research Plan sudah terhubung dengan Lokasi"); return; }
    if (selectedCharCodes.size === 0) { toast.error("Pilih minimal satu karakteristik di langkah sebelumnya"); return; }

    const selectedChars = characteristics.filter(c => selectedCharCodes.has(c.code));
    // Build values array including multi-sample entries
    const values: { characteristic_id: number; value: number; sample_number: number }[] = [];
    for (const c of selectedChars) {
      const samples = charSamples[c.code] ?? [""];
      samples.forEach((v, i) => {
        values.push({ characteristic_id: c.id, value: v !== "" ? Number(v) : 0, sample_number: i + 1 });
      });
    }

    setSubmitting(true);
    try {
      await phenotypingService.createRecord({
        plot_no: wizPlot.trim(),
        genotype_id: genoId,
        environment_id: resolvedEnv,
        replication: wizRep,
        values,
      } as Parameters<typeof phenotypingService.createRecord>[0]);
      queryClient.invalidateQueries({ queryKey: ["observation-records"] });
      toast.success(`Plot ${wizPlot} (R${wizRep}) berhasil disimpan — ${values.length} nilai karakteristik`);
      if (continueNext) {
        resetWizardStep1();
      } else {
        setWizardOpen(false);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Grid query — requires a trial to be selected ──────────────────────────
  const gridQueryKey = ["obs-grid", trialFilter, environmentFilter];
  const { data: gridData, isLoading: gridLoading } = useQuery({
    queryKey: gridQueryKey,
    queryFn: () =>
      phenotypingService
        .getGrid({ trial_id: trialFilter, ...(environmentFilter ? { environment_id: environmentFilter } : {}) })
        .then((r) => r.data),
    enabled: !!trialFilter,
    staleTime: 30_000,
  });
  const gridRows: GridRow[] = gridData?.rows ?? [];

  // Track record IDs auto-created during this session (key = "genoId:envId:rep")
  const runtimeRecordIds = useRef<Map<string, number>>(new Map());
  // Reset runtime IDs when trial changes
  const prevTrialFilter = useRef(trialFilter);
  if (prevTrialFilter.current !== trialFilter) {
    prevTrialFilter.current = trialFilter;
    runtimeRecordIds.current.clear();
  }

  const handleCellChange = useCallback(
    async (row: GridRow, characteristic: Characteristic, value: number | null) => {
      const isSimplePlot = row.genotype_id === null;
      const rowKey = isSimplePlot
        ? `plot:${row.plot_no}`
        : `${row.genotype_id}:${row.environment_id}:${row.replication}`;
      let recordId = row.record_id ?? runtimeRecordIds.current.get(rowKey);

      const rowMatches = (r: GridRow) =>
        isSimplePlot
          ? r.plot_no === row.plot_no
          : r.genotype_id === row.genotype_id &&
            r.environment_id === row.environment_id &&
            r.replication === row.replication;

      // Optimistic: update value in cache immediately
      queryClient.setQueryData(
        gridQueryKey,
        (old: { trial: unknown; rows: GridRow[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            rows: old.rows.map((r) =>
              rowMatches(r) ? { ...r, values: { ...r.values, [characteristic.code]: value } } : r
            ),
          };
        }
      );

      if (!recordId) {
        // Auto-create record + first value in one POST
        const payload: Record<string, unknown> = {
          trial_id:    trialFilter ? Number(trialFilter) : undefined,
          plot_no:     row.plot_no,
          replication: row.replication,
          values:      [{ characteristic_id: characteristic.id, value }],
        };
        if (!isSimplePlot) {
          payload.genotype_id    = row.genotype_id;
          payload.environment_id = row.environment_id;
        }
        const res = await phenotypingService.createRecord(
          payload as Parameters<typeof phenotypingService.createRecord>[0]
        );
        recordId = res.data.id;
        runtimeRecordIds.current.set(rowKey, recordId);

        // Persist record_id into cache so next edits go to PATCH
        queryClient.setQueryData(
          gridQueryKey,
          (old: { trial: unknown; rows: GridRow[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              rows: old.rows.map((r) =>
                rowMatches(r) ? { ...r, record_id: recordId } : r
              ),
            };
          }
        );
        return;
      }

      await phenotypingService.updateRecord(recordId, {
        values: [{ characteristic_id: characteristic.id, value }],
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, trialFilter, gridQueryKey.join(":")]
  );

  const { data: deletedData } = useQuery({
    queryKey: ["observation-records-deleted"],
    queryFn: () => api.get<{data: ObservationRecord[]}>("/v1/phenotyping/records/deleted", { params: { per_page: 100 } }).then(r => r.data.data),
    enabled: showDeleted,
    staleTime: 0,
  });
  const deletedRecords: ObservationRecord[] = deletedData ?? [];



  // Import queries & mutations
  const { data: batchesData } = useQuery({ queryKey: ["import-batches"], queryFn: () => api.get<{data:ImportBatch[]}>("/v1/phenotyping/import/batches").then(r => r.data.data), enabled: showImport, refetchInterval: showImport ? 5000 : false });
  const batches: ImportBatch[] = batchesData ?? [];
  const selectedBatch = batches.find(b => b.id === selectedBatchId) ?? null;

  const { data: previewData, isLoading: previewLoading } = useQuery({ queryKey: ["import-preview", selectedBatchId, previewFilter], queryFn: () => api.get(`/v1/phenotyping/import/batches/${selectedBatchId}/preview`, {params:{status:previewFilter||undefined,per_page:30}}).then(r => r.data), enabled: !!selectedBatchId && ["validated","completed"].includes(selectedBatch?.status ?? "") });
  const previewRows: StagingRow[] = (previewData as {rows?:StagingRow[]})?.rows ?? [];

  const uploadMutation = useMutation({ mutationFn: (file: File) => { const fd=new FormData(); fd.append("file",file); return api.post<{batch:ImportBatch}>("/v1/phenotyping/import/upload",fd,{headers:{"Content-Type":"multipart/form-data"}}); }, onSuccess: res => { queryClient.invalidateQueries({queryKey:["import-batches"]}); setSelectedBatchId(res.data.batch.id); toast.success(`File diupload: ${res.data.batch.total_rows} baris`); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const validateMutation = useMutation({ mutationFn: (id:number) => api.post(`/v1/phenotyping/import/batches/${id}/validate`), onSuccess: () => { queryClient.invalidateQueries({queryKey:["import-batches"]}); queryClient.invalidateQueries({queryKey:["import-preview"]}); toast.success("Validasi selesai"); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const deleteRecordMutation = useMutation({
    mutationFn: (id: number) => phenotypingService.deleteRecord(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observation-records"] }); queryClient.invalidateQueries({ queryKey: ["observation-records-deleted"] }); toast.success("Baris pengamatan dihapus (bisa dipulihkan dalam 30 hari)"); setDeletingRecordId(null); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.post(`/v1/phenotyping/records/${id}/restore`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observation-records"] }); queryClient.invalidateQueries({ queryKey: ["observation-records-deleted"] }); toast.success("Baris berhasil dipulihkan"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const resetBatchMutation = useMutation({
    mutationFn: (id: number) => api.post(`/v1/phenotyping/import/batches/${id}/reset`),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:["import-batches"]}); toast.success("Batch direset, silakan validasi ulang"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/phenotyping/import/batches/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({queryKey:["import-batches"]}); setSelectedBatchId(null); toast.success("Batch dihapus"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const confirmMutation = useMutation({ mutationFn: (id:number) => api.post(`/v1/phenotyping/import/batches/${id}/confirm`), onSuccess: res => { queryClient.invalidateQueries({queryKey:["import-batches"]}); queryClient.invalidateQueries({queryKey:["observation-records"]}); toast.success((res.data as {message?:string})?.message ?? "Import selesai"); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const rollbackMutation = useMutation({ mutationFn: (id:number) => api.post(`/v1/phenotyping/import/batches/${id}/rollback`), onSuccess: res => { queryClient.invalidateQueries({queryKey:["import-batches"]}); queryClient.invalidateQueries({queryKey:["observation-records"]}); toast.success((res.data as {message?:string})?.message ?? "Rollback selesai"); }, onError: e => toast.error(getApiErrorMessage(e)) });

  const STATUS_COLOR: Record<string,string> = { parsed:"bg-yellow-50 text-yellow-700", validated:"bg-green-50 text-green-700", completed:"bg-emerald-50 text-emerald-700", failed:"bg-red-50 text-red-700", rolled_back:"bg-gray-100 text-gray-500" };
  const STATUS_LABEL: Record<string,string> = { uploaded:"Diunggah", parsing:"Parsing...", parsed:"Diparsing", validating:"Memvalidasi...", validated:"Siap Impor", importing:"Mengimpor...", completed:"Selesai", failed:"Gagal", rolled_back:"Di-rollback" };


  return (
    <div className="space-y-6 max-w-full mx-auto">
      <PageHeader
        title="Data Pengamatan"
        description="Entri data pengamatan fenotipe per plot/replikasi, mengikuti format spreadsheet lapangan"
        actions={canEdit ? (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowImport(v => !v)} className="flex items-center gap-2 px-3 py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition">
              <Upload className="w-4 h-4" /> Import
            </button>
            <button onClick={openWizard} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
              <Plus className="w-4 h-4" /> Tambah Baris
            </button>
          </div>
        ) : undefined}
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
              {batches.filter(b => !dismissedBatchIds.has(b.id)).slice(0,5).map(b => (
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
                {selectedBatch.status==="validated" && <>
                  <button onClick={() => { if(confirm(`Import ${selectedBatch.valid_rows} baris valid?`)) { confirmMutation.mutate(selectedBatch.id); setDismissedBatchIds(p => new Set([...p, selectedBatch.id])); setSelectedBatchId(null); } }} disabled={confirmMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"><CheckCircle className="w-3.5 h-3.5"/>{confirmMutation.isPending?"Mengimpor...":`Konfirmasi (${selectedBatch.valid_rows} baris)`}</button>
                  {/* Reset to re-validate */}
                  <button onClick={() => { if(confirm("Reset batch? Hasil validasi akan dihapus dan batch kembali ke status 'Diparsing'.")) resetBatchMutation.mutate(selectedBatch.id); }} disabled={resetBatchMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 text-xs rounded-lg hover:bg-blue-50 disabled:opacity-50"><RefreshCw className="w-3.5 h-3.5"/>Reset Validasi</button>
                  {/* Hapus Batch — permanent delete, never shows again */}
                  <button onClick={() => { if(confirm("Hapus batch ini permanen? Batch tidak akan muncul lagi setelah dihapus.")) deleteBatchMutation.mutate(selectedBatch.id); }} disabled={deleteBatchMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-500 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50"><X className="w-3.5 h-3.5"/>Hapus Batch</button>
                </>}
                {selectedBatch.status==="completed" && !selectedBatch.is_rolled_back && <>
                  <button onClick={() => { if(confirm("Rollback akan menghapus data yang diimpor. Lanjutkan?")) { rollbackMutation.mutate(selectedBatch.id); setDismissedBatchIds(p => new Set([...p, selectedBatch.id])); setSelectedBatchId(null); } }} disabled={rollbackMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5"/>Rollback</button>
                  <button onClick={() => { setDismissedBatchIds(p => new Set([...p, selectedBatch.id])); setSelectedBatchId(null); }} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5"/>Tutup</button>
                </>}
                {/* Stuck/failed batch: allow reset or delete */}
                {["importing","failed"].includes(selectedBatch.status) && (
                  <div className="flex gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700 w-full">
                    <span className="flex-1">Import {selectedBatch.status === "importing" ? "terhenti (stuck)" : "gagal"}.</span>
                    <button onClick={() => resetBatchMutation.mutate(selectedBatch.id)} disabled={resetBatchMutation.isPending} className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 font-medium">Reset & Validasi Ulang</button>
                    <button onClick={() => { if(confirm("Hapus batch ini permanen?")) deleteBatchMutation.mutate(selectedBatch.id); }} disabled={deleteBatchMutation.isPending} className="px-2 py-1 border border-orange-300 text-orange-600 rounded hover:bg-orange-100">Hapus Batch</button>
                  </div>
                )}
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
      ) : !trialFilter ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <Sheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-500 mb-1">Pilih Research Plan</p>
          <p className="text-xs">Spreadsheet akan menampilkan semua plot berdasarkan genotipe dan lokasi dari Research Plan yang dipilih.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <ObservationGrid
            rows={gridRows}
            characteristics={characteristics}
            isLoading={gridLoading}
            canEdit={canEdit}
            onCellChange={handleCellChange}
            onViewRow={(r) => r.record_id !== null ? setViewingRecord({ id: r.record_id, plot_no: r.plot_no, genotype_id: r.genotype_id ?? 0, genotype: r.genotype as ObservationRecord["genotype"], environment_id: r.environment_id ?? 0, environment: r.environment as ObservationRecord["environment"], replication: r.replication, values: r.values, record_code: "", season_id: 0, created_at: "", updated_at: "" }) : undefined}
            onDeleteRow={canEdit ? (r) => { if (r.record_id && confirm(`Hapus baris Plot ${r.plot_no} R${r.replication}? (bisa dipulihkan dalam 30 hari)`)) deleteRecordMutation.mutate(r.record_id); } : undefined}
          />
        </div>
      )}

      {/* ── Multi-step wizard ── */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            {/* Header with step indicator */}
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900">Tambah Pengamatan</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  {[1,2,3].map(s => (
                    <div key={s} className={cn("h-1.5 rounded-full transition-all", s === wizardStep ? "w-8 bg-green-600" : s < wizardStep ? "w-4 bg-green-300" : "w-4 bg-gray-200")} />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">Langkah {wizardStep}/3</span>
                </div>
              </div>
              <button onClick={() => setWizardOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* ── Step 1: Basic info ── */}
              {wizardStep === 1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Research Plan</label>
                    <select value={wizRP} onChange={e => { setWizRP(e.target.value); setWizEnv(null); setWizRep(1); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="">-- Pilih Research Plan --</option>
                      {trials.map(t => <option key={t.id} value={t.id}>{t.trial_name}</option>)}
                    </select>
                    {wizSelectedTrial && <p className="text-xs text-green-600 mt-1">{wizSelectedTrial.replications} ulangan tersedia</p>}
                  </div>

                  {/* Lokasi — auto from RP or selectable */}
                  {wizRP && wizEnvOptions.length > 0 && (
                    <div>
                      {wizEnvOptions.length === 1 ? (
                        // Auto-set wizEnv immediately when single env is rendered
                        <div className="px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-sm flex items-center gap-2"
                          ref={() => { if (wizEnv !== wizEnvOptions[0].id) setWizEnv(wizEnvOptions[0].id); }}>
                          <span className="text-xs text-green-600 font-medium">Lokasi:</span>
                          <span className="text-green-800 font-semibold">{wizEnvOptions[0].name ?? wizEnvOptions[0].environment_code}</span>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                          <select value={wizEnv ?? ""} onChange={e => setWizEnv(Number(e.target.value) || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                            <option value="">-- Pilih Lokasi --</option>
                            {wizEnvOptions.map(e => <option key={e.id} value={e.id}>{e.name ?? e.environment_code}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No Plot *</label>
                    <input value={wizPlot} onChange={e => setWizPlot(e.target.value)} placeholder="contoh: 1, A1, B3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Genotipe *</label>
                    <select value={wizGeno} onChange={e => setWizGeno(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="">-- Pilih Genotipe --</option>
                      {genotypes.map(g => <option key={g.id} value={g.id}>{g.genotype_code} — {g.genotype_name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Replikasi (R) *</label>
                    <select value={wizRep} onChange={e => setWizRep(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      {wizRepOptions.map(r => <option key={r} value={r}>R{r}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* ── Step 2: Select characteristics ── */}
              {wizardStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Pilih Karakteristik yang akan diamati</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedCharCodes(new Set(characteristics.map(c => c.code)))}
                        className="text-xs text-green-600 hover:text-green-700">Pilih Semua</button>
                      <span className="text-gray-300">·</span>
                      <button type="button" onClick={() => setSelectedCharCodes(new Set())}
                        className="text-xs text-gray-400 hover:text-gray-600">Batal Semua</button>
                    </div>
                  </div>
                  {Object.entries(charsByGroup).map(([group, chars]) => (
                    <div key={group} className="space-y-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{group}</p>
                      {chars.map(c => (
                        <label key={c.code} title={`Kode: ${c.code}${c.unit ? ` · Satuan: ${c.unit}` : ""}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={selectedCharCodes.has(c.code)}
                            onChange={e => {
                              const next = new Set(selectedCharCodes);
                              if (e.target.checked) next.add(c.code); else next.delete(c.code);
                              setSelectedCharCodes(next);
                            }}
                            className="accent-green-600 w-4 h-4" />
                          <span className="flex-1 text-sm text-gray-800">{c.name}</span>
                          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{c.code}</span>
                          {c.unit && <span className="text-xs text-gray-400">({c.unit})</span>}
                        </label>
                      ))}
                    </div>
                  ))}
                  {selectedCharCodes.size > 0 && (
                    <p className="text-xs text-green-600 font-medium">{selectedCharCodes.size} karakteristik dipilih</p>
                  )}
                </div>
              )}

              {/* ── Step 3: Input values (with multi-sample support) ── */}
              {wizardStep === 3 && (
                <div className="space-y-3">
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-0.5">
                    <p>Plot: <strong className="text-gray-800">{wizPlot}</strong> · Genotipe: <strong className="text-gray-800">{genotypes.find(g=>String(g.id)===wizGeno)?.genotype_code}</strong> · R{wizRep}</p>
                    <p className="text-xs text-green-600 font-medium">Staff: {user?.name}</p>
                    <p className="text-[11px] text-gray-400">Kosongkan jika tidak diamati → 0. Klik "+ Sampel" untuk mengukur beberapa sampel.</p>
                  </div>
                  {Object.entries(charsByGroup).map(([group, chars]) => {
                    const selectedInGroup = chars.filter(c => selectedCharCodes.has(c.code));
                    if (selectedInGroup.length === 0) return null;
                    return (
                      <div key={group} className="space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{group}</p>
                        {selectedInGroup.map(c => {
                          const samples = charSamples[c.code] ?? [""];
                          return (
                            <div key={c.code} className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <label className="flex-1 text-sm text-gray-700">
                                  {c.name} {c.unit && <span className="text-xs text-gray-400">({c.unit})</span>}
                                </label>
                                <button type="button"
                                  onClick={() => setCharSamples(s => ({...s, [c.code]: [...(s[c.code] ?? [""]), ""]}))}
                                  className="text-xs text-green-600 hover:text-green-700 px-1.5 py-0.5 rounded hover:bg-green-50 flex-shrink-0">
                                  + Sampel
                                </button>
                              </div>
                              {samples.map((val, si) => (
                                <div key={si} className="flex items-center gap-2 pl-2">
                                  {samples.length > 1 && <span className="text-xs text-gray-400 w-14 flex-shrink-0">Sampel {si+1}</span>}
                                  <input type="number" step="any" value={val}
                                    onChange={e => setCharSamples(s => ({...s, [c.code]: (s[c.code] ?? [""]).map((v,i) => i===si ? e.target.value : v)}))}
                                    placeholder="0"
                                    className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                                  />
                                  {samples.length > 1 && (
                                    <button type="button"
                                      onClick={() => setCharSamples(s => ({...s, [c.code]: (s[c.code]??[""]).filter((_,i)=>i!==si)}))}
                                      className="text-gray-300 hover:text-red-400"><X className="w-3.5 h-3.5"/></button>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t flex-shrink-0 flex gap-2">
              {wizardStep > 1 && (
                <button type="button" onClick={() => setWizardStep(s => (s - 1) as 1|2|3)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                  <ChevronLeft className="w-4 h-4" /> Kembali
                </button>
              )}
              <div className="flex-1" />
              {wizardStep === 1 && (
                <button type="button" onClick={goToStep2}
                  className="flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
                  Lanjut <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {wizardStep === 2 && (
                <button type="button" onClick={goToStep3}
                  className="flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
                  Lanjut <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {wizardStep === 3 && (
                <>
                  <button type="button" onClick={() => submitWizard(true)} disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 border border-green-600 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition disabled:opacity-50">
                    <Save className="w-4 h-4" /> Simpan &amp; Lanjut
                  </button>
                  <button type="button" onClick={() => submitWizard(false)} disabled={submitting}
                    className="flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
                    {submitting ? "Menyimpan..." : "Submit"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Deleted Records (Sampah) Panel ── */}
      {showDeleted && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-red-700"><Undo2 className="w-4 h-4"/> Sampah — Bisa dipulihkan hingga 30 hari</div>
            <button onClick={() => setShowDeleted(false)}><X className="w-4 h-4 text-red-400"/></button>
          </div>
          {deletedRecords.length === 0 ? (
            <p className="text-xs text-red-400">Tidak ada data yang dihapus dalam 30 hari terakhir.</p>
          ) : (
            <div className="space-y-2">
              {deletedRecords.map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-red-100">
                  <div className="flex-1 min-w-0 text-xs">
                    <span className="font-medium text-gray-800">Plot {r.plot_no}</span>
                    <span className="text-gray-400 ml-2">· {r.genotype?.genotype_code} · R{r.replication}</span>
                    <span className="text-red-400 ml-2">· Dihapus {formatDate((r as ObservationRecord & {deleted_at?:string}).deleted_at ?? "")}</span>
                  </div>
                  <button onClick={() => restoreMutation.mutate(r.id)} disabled={restoreMutation.isPending}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 flex-shrink-0">
                    Pulihkan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Record Detail Modal ── */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">Detail Pengamatan</h3>
                <p className="text-xs text-gray-400 mt-0.5">Plot {viewingRecord.plot_no} · R{viewingRecord.replication}</p>
              </div>
              <button onClick={() => setViewingRecord(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">No Plot</p>
                  <p className="font-semibold text-gray-800">{viewingRecord.plot_no}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Replikasi</p>
                  <p className="font-semibold text-gray-800">R{viewingRecord.replication}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Genotipe</p>
                  <p className="font-semibold text-gray-800">{viewingRecord.genotype?.genotype_code}</p>
                  <p className="text-xs text-gray-500">{viewingRecord.genotype?.genotype_name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Lokasi</p>
                  <p className="font-semibold text-gray-800">{viewingRecord.environment?.name ?? viewingRecord.environment?.environment_code}</p>
                </div>
              </div>
              {/* Observed values */}
              {viewingRecord.values && Object.keys(viewingRecord.values).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nilai Pengamatan</p>
                  <div className="space-y-1">
                    {Object.entries(viewingRecord.values as Record<string, number | null>).map(([code, val]) => {
                      const char = characteristics.find(c => c.code === code);
                      return (
                        <div key={code} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50">
                          <span className="text-sm text-gray-700">{char?.name ?? code} {char?.unit && <span className="text-xs text-gray-400">({char.unit})</span>}</span>
                          <span className="font-mono font-semibold text-gray-900">{val !== null ? val : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2 border-t">
                <button onClick={() => setViewingRecord(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Tutup</button>
                <button onClick={() => { setHistoryRecord(viewingRecord); setViewingRecord(null); }} className="px-4 py-2 border border-blue-200 text-blue-600 rounded-lg text-sm hover:bg-blue-50 flex items-center gap-1"><History className="w-4 h-4"/>Riwayat</button>
                {canEdit && <button onClick={() => { if(confirm(`Hapus baris Plot ${viewingRecord.plot_no} R${viewingRecord.replication}?`)) { deleteRecordMutation.mutate(viewingRecord.id); setViewingRecord(null); } }} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Hapus</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit History Modal ── */}
      {historyRecord && <HistoryModal record={historyRecord} onClose={() => setHistoryRecord(null)} />}
    </div>
  );
}

// Inline HistoryModal component
function HistoryModal({ record, onClose }: { record: ObservationRecord; onClose: () => void }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["obs-history", record.id],
    queryFn: () => api.get(`/v1/phenotyping/records/${record.id}/history`).then(r => r.data as {id:number;action:string;changes:Record<string,unknown>;created_at:string;user?:{name:string}}[]),
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><History className="w-4 h-4 text-blue-500"/> Riwayat Edit</h3>
            <p className="text-xs text-gray-400 mt-0.5">Plot {record.plot_no} · R{record.replication}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400"/></button>
        </div>
        <div className="p-5">
          {isLoading ? <div className="text-center py-8 text-gray-400 text-sm">Memuat riwayat...</div> :
          !logs?.length ? <div className="text-center py-8 text-gray-400 text-sm">Belum ada riwayat perubahan.</div> :
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.action==="created"?"bg-green-50 text-green-700":log.action==="deleted"?"bg-red-50 text-red-700":"bg-blue-50 text-blue-700"}`}>{log.action}</span>
                  <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString("id-ID")}</span>
                </div>
                {log.user && <p className="text-xs text-gray-500">oleh <strong>{log.user.name}</strong></p>}
                {log.changes && Object.keys(log.changes).length > 0 && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(log.changes, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>}
        </div>
      </div>
    </div>
  );
}
