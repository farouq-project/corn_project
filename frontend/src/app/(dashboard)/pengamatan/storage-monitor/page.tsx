"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Download, Upload, Trash2, Package, Edit2 } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { formatDate } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { Genotype } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

interface MonitorEntry {
  id: number;
  entry_number: number;
  prev_code?: string;
  new_code?: string;
  prev_box?: string;
  new_box?: string;
  genotype_name?: string;
  prev_packaging?: string;
  new_packaging?: string;
  harvest_date?: string;
  seed_weight?: number;
  moisture_content?: number;
  notes?: string;
  recorder?: { name: string };
}

export default function StorageMonitorPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MonitorEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MonitorEntry>>({});
  const [editGenoRows, setEditGenoRows] = useState<string[]>([""]);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<{created:number;errors:string[]} | null>(null);
  const [smPageSize, setSmPageSize] = useState<number | "all">("all");
  const importRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Multi-row genotipe cross breed state: each element is one genotype name
  const [genoRows, setGenoRows] = useState<string[]>([""]);

  // Simple form state for other fields
  const [form, setForm] = useState({
    prev_code:"", new_code:"", prev_box:"", new_box:"",
    prev_packaging:"", new_packaging:"",
    harvest_date:"", seed_weight:"", moisture_content:"", notes:"",
  });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({...p, [k]: v}));

  // Fetch genotypes from master data for cross breed selector
  const { data: genotypesData } = useQuery({
    queryKey: ["genotypes", "storage-monitor"],
    queryFn: () => api.get<{data:Genotype[]}>("/v1/genotypes?per_page=2000").then(r => r.data),
    staleTime: 60000,
  });
  const genotypes: Genotype[] = genotypesData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["storage-monitor"],
    queryFn: () => api.get<{ data: MonitorEntry[] }>("/v1/storage-monitor?per_page=500").then(r => r.data),
    staleTime: 0,
  });
  const entries: MonitorEntry[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: object) => api.post("/v1/storage-monitor", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["storage-monitor"] });
      toast.success("Entri berhasil ditambahkan");
      setIsModalOpen(false);
      setGenoRows([""]);
      setForm({ prev_code:"",new_code:"",prev_box:"",new_box:"",prev_packaging:"",new_packaging:"",harvest_date:"",seed_weight:"",moisture_content:"",notes:"" });
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/storage-monitor/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage-monitor"] }); toast.success("Entri dihapus"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/v1/storage-monitor/${id}`))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage-monitor"] }); toast.success("Entri terpilih dihapus"); },
    onError: () => toast.error("Sebagian entri gagal dihapus"),
  });

  const updateMutation = useMutation({
    mutationFn: ({id, d}: {id:number; d: object}) => api.put(`/v1/storage-monitor/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["storage-monitor"] }); toast.success("Entri berhasil diperbarui"); setIsEditModalOpen(false); setEditingEntry(null); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const openEdit = (entry: MonitorEntry) => {
    setEditingEntry(entry);
    // Split genotype_name back into rows by " x "
    const genoNames = (entry.genotype_name ?? "").split(" x ").map(s => s.trim()).filter(Boolean);
    setEditGenoRows(genoNames.length > 0 ? genoNames : [""]);
    setEditForm({
      prev_code: entry.prev_code ?? "",
      new_code: entry.new_code ?? "",
      prev_box: entry.prev_box ?? "",
      new_box: entry.new_box ?? "",
      prev_packaging: entry.prev_packaging ?? "",
      new_packaging: entry.new_packaging ?? "",
      harvest_date: entry.harvest_date ?? "",
      seed_weight: entry.seed_weight,
      moisture_content: entry.moisture_content,
      notes: entry.notes ?? "",
    });
    setIsEditModalOpen(true);
  };

  const submitEdit = () => {
    if (!editingEntry) return;
    const filled = editGenoRows.filter(r => r.trim());
    if (filled.length === 0) { toast.error("Nama Genotipe wajib diisi"); return; }
    updateMutation.mutate({
      id: editingEntry.id,
      d: { ...editForm, genotype_name: filled.join(" x ") },
    });
  };

  const importMutation = useMutation({
    mutationFn: (file: File) => { const fd=new FormData(); fd.append("file",file); return api.post("/v1/storage-monitor/import",fd,{headers:{"Content-Type":"multipart/form-data"}}); },
    onSuccess: res => { qc.invalidateQueries({queryKey:["storage-monitor"]}); const d=res.data as {created?:number;errors?:string[]}; setImportResult({created:d.created??0,errors:d.errors??[]}); toast.success(`Import selesai: ${d.created} entri dibuat`); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const submit = () => {
    const filled = genoRows.filter(r => r.trim());
    if (filled.length === 0) { toast.error("Nama Genotipe wajib diisi minimal satu"); return; }
    const genotype_name = filled.join(" x ");
    createMutation.mutate({
      ...form,
      genotype_name,
      seed_weight: form.seed_weight ? Number(form.seed_weight) : null,
      moisture_content: form.moisture_content ? Number(form.moisture_content) : null,
      harvest_date: form.harvest_date || null,
    });
  };

  const addGenoRow = () => setGenoRows(r => [...r, ""]);
  const removeGenoRow = (i: number) => setGenoRows(r => r.filter((_, idx) => idx !== i));
  const setGenoRow = (i: number, v: string) => setGenoRows(r => r.map((x, idx) => idx === i ? v : x));

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  const columns: ColumnDef<MonitorEntry, unknown>[] = [
    { header: "No", accessorKey: "entry_number", cell: ({getValue}) => <span className="font-bold text-gray-600">{getValue() as number}</span> },
    { header: "Kode Lama", accessorKey: "prev_code", cell: ({getValue}) => <span className="font-mono text-xs">{(getValue() as string) || "—"}</span> },
    { header: "Kode Baru", accessorKey: "new_code", cell: ({getValue}) => <span className="font-mono text-xs font-semibold text-green-700">{(getValue() as string) || "—"}</span> },
    { header: "Box Lama", accessorKey: "prev_box", cell: ({getValue}) => <span className="text-xs">{(getValue() as string) || "—"}</span> },
    { header: "Box Baru", accessorKey: "new_box", cell: ({getValue}) => <span className="text-xs">{(getValue() as string) || "—"}</span> },
    { header: "Nama Genotipe", accessorKey: "genotype_name", cell: ({getValue}) => <span className="text-sm font-medium">{(getValue() as string) || "—"}</span> },
    { header: "Kemasan Lama", accessorKey: "prev_packaging", cell: ({getValue}) => <span className="text-xs text-gray-500">{(getValue() as string) || "—"}</span> },
    { header: "Kemasan Baru", accessorKey: "new_packaging", cell: ({getValue}) => <span className="text-xs text-gray-500">{(getValue() as string) || "—"}</span> },
    { header: "Tgl Panen", accessorKey: "harvest_date", cell: ({getValue}) => <span className="text-xs">{getValue() ? formatDate(getValue() as string) : "—"}</span> },
    { header: "Berat (g)", accessorKey: "seed_weight", cell: ({getValue}) => <span className="text-xs">{getValue() ? `${getValue()} g` : "—"}</span> },
    { header: "KA (%)", accessorKey: "moisture_content", cell: ({getValue}) => <span className="text-xs">{getValue() ? `${getValue()}%` : "—"}</span> },
    { header: "Keterangan", accessorKey: "notes", cell: ({getValue}) => <span className="text-xs text-gray-500">{(getValue() as string) || "—"}</span> },
    {
      header: "Aksi", id: "act",
      cell: ({row}) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Edit2 className="w-3.5 h-3.5"/></button>
          <button onClick={() => { if(confirm(`Hapus entri #${row.original.entry_number}?`)) deleteMutation.mutate(row.original.id); }}
            className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-full mx-auto">
      <PageHeader
        title="Storage Monitor"
        description="Pantau dan catat pergerakan benih antar kode, box, dan kemasan"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowImport(v=>!v)}
              className="flex items-center gap-2 px-3 py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition">
              <Upload className="w-4 h-4" /> Import Excel
            </button>
            <button onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
              <Plus className="w-4 h-4" /> Tambah Entri
            </button>
          </div>
        }
      />

      {/* Import panel */}
      {showImport && (
        <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-800 text-sm">Import Storage Monitor dari Excel</p>
            <button onClick={() => setShowImport(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={`${API_BASE}/v1/storage-monitor/template`} download
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition">
              <Download className="w-4 h-4" /> Download Template
            </a>
            <button onClick={() => importRef.current?.click()} disabled={importMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              <Upload className="w-4 h-4" /> {importMutation.isPending ? "Mengimpor..." : "Upload & Import"}
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f=e.target.files?.[0]; if(f) importMutation.mutate(f); e.target.value=""; }} />
          </div>
          {importResult && (
            <div className="space-y-1">
              <p className="text-sm text-green-700 font-medium">{importResult.created} entri berhasil diimpor</p>
              {importResult.errors.map((e,i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <p className="text-xs text-gray-400">Kolom: Nomor · Kode Sebelumnya · Kode Baru · Box Sebelumnya · Box Baru · Nama Genotipe · Kemasan Sebelumnya · Kemasan Baru · Tanggal Panen · Berat Benih (g) · Kadar Air (%) · Keterangan</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Package className="w-4 h-4" />
          <span>{entries.length} entri tercatat</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-xs text-gray-400">Tampilkan:</span>
          {([50, 100, 200, "all"] as const).map(opt => (
            <button key={opt} onClick={() => setSmPageSize(opt)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition border ${smPageSize === opt ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {opt === "all" ? "Semua" : opt}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <DataTable
          data={entries}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Cari kode atau nama genotipe..."
          emptyMessage="Belum ada entri."
          getRowId={r => String(r.id)}
          pageSize={smPageSize === "all" ? 9999 : smPageSize}
          onBulkDelete={rows => bulkDeleteMutation.mutate(rows.map(r => r.id))}
          isBulkDeleting={bulkDeleteMutation.isPending}
        />
      </div>

      {/* Add entry modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Tambah Entri Storage Monitor</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">

              {/* Kode */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kode Sebelumnya</label><input value={form.prev_code} onChange={e=>set("prev_code",e.target.value)} className={inp} placeholder="K-001" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kode Baru</label><input value={form.new_code} onChange={e=>set("new_code",e.target.value)} className={inp} placeholder="K-001-R" /></div>
              </div>

              {/* Box */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Box Sebelumnya</label><input value={form.prev_box} onChange={e=>set("prev_box",e.target.value)} className={inp} placeholder="Box A1" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Box Baru</label><input value={form.new_box} onChange={e=>set("new_box",e.target.value)} className={inp} placeholder="Box B2" /></div>
              </div>

              {/* Genotipe — multi-row cross breed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Nama Genotipe * <span className="text-xs text-gray-400 font-normal">({genoRows.filter(r=>r).join(" x ")||"—"})</span>
                  </label>
                  <button type="button" onClick={addGenoRow}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50">
                    <Plus className="w-3.5 h-3.5" /> Tambah Silang
                  </button>
                </div>
                <div className="space-y-2">
                  {genoRows.map((val, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="text-gray-400 text-sm font-bold flex-shrink-0">×</span>}
                      {i === 0 && <span className="text-gray-400 text-sm w-4 flex-shrink-0" />}
                      <select
                        value={val}
                        onChange={e => setGenoRow(i, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">-- Pilih Genotipe --</option>
                        {genotypes.map(g => (
                          <option key={g.id} value={g.genotype_name}>{g.genotype_name}</option>
                        ))}
                      </select>
                      {genoRows.length > 1 && (
                        <button type="button" onClick={() => removeGenoRow(i)}
                          className="p-1.5 text-gray-300 hover:text-red-400 flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {genoRows.filter(r=>r).length > 1 && (
                  <p className="text-xs text-green-600 mt-1.5 font-medium">
                    Hasil: {genoRows.filter(r=>r).join(" x ")}
                  </p>
                )}
              </div>

              {/* Kemasan */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kemasan Sebelumnya</label><input value={form.prev_packaging} onChange={e=>set("prev_packaging",e.target.value)} className={inp} placeholder="Kantong" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kemasan Baru</label><input value={form.new_packaging} onChange={e=>set("new_packaging",e.target.value)} className={inp} placeholder="Kaleng" /></div>
              </div>

              {/* Berat + KA + Panen */}
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Berat Benih (g)</label><input type="number" step="0.01" value={form.seed_weight} onChange={e=>set("seed_weight",e.target.value)} className={inp} placeholder="150.5" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kadar Air (%) <span className="text-gray-400 text-xs">opt</span></label><input type="number" step="0.01" min="0" max="100" value={form.moisture_content} onChange={e=>set("moisture_content",e.target.value)} className={inp} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tgl Panen <span className="text-gray-400 text-xs">opt</span></label><input type="date" value={form.harvest_date} onChange={e=>set("harvest_date",e.target.value)} className={inp} /></div>
              </div>

              {/* Notes */}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} className={`${inp} resize-none`} /></div>

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button>
                <button type="button" onClick={submit} disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">
                  {createMutation.isPending ? "Menyimpan..." : "Tambah Entri"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {isEditModalOpen && editingEntry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Edit Entri #{editingEntry.entry_number}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kode Sebelumnya</label><input value={editForm.prev_code ?? ""} onChange={e=>setEditForm(f=>({...f,prev_code:e.target.value}))} className={inp} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kode Baru</label><input value={editForm.new_code ?? ""} onChange={e=>setEditForm(f=>({...f,new_code:e.target.value}))} className={inp} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Box Sebelumnya</label><input value={editForm.prev_box ?? ""} onChange={e=>setEditForm(f=>({...f,prev_box:e.target.value}))} className={inp} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Box Baru</label><input value={editForm.new_box ?? ""} onChange={e=>setEditForm(f=>({...f,new_box:e.target.value}))} className={inp} /></div>
              </div>
              {/* Genotipe cross breed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Nama Genotipe * <span className="text-xs text-gray-400 font-normal">({editGenoRows.filter(r=>r).join(" x ")||"—"})</span>
                  </label>
                  <button type="button" onClick={() => setEditGenoRows(r => [...r, ""])} className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50">+ Silang</button>
                </div>
                {editGenoRows.map((val,i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    {i > 0 && <span className="text-gray-400 text-sm flex-shrink-0">×</span>}
                    {i === 0 && <span className="w-4 flex-shrink-0"/>}
                    <select value={val} onChange={e=>setEditGenoRows(r=>r.map((x,idx)=>idx===i?e.target.value:x))} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="">-- Pilih Genotipe --</option>
                      {genotypes.map(g=><option key={g.id} value={g.genotype_name}>{g.genotype_name}</option>)}
                    </select>
                    {editGenoRows.length > 1 && <button type="button" onClick={()=>setEditGenoRows(r=>r.filter((_,idx)=>idx!==i))} className="p-1.5 text-gray-300 hover:text-red-400"><X className="w-4 h-4"/></button>}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kemasan Sebelumnya</label><input value={editForm.prev_packaging ?? ""} onChange={e=>setEditForm(f=>({...f,prev_packaging:e.target.value}))} className={inp} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kemasan Baru</label><input value={editForm.new_packaging ?? ""} onChange={e=>setEditForm(f=>({...f,new_packaging:e.target.value}))} className={inp} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Berat Benih (g)</label><input type="number" step="0.01" value={editForm.seed_weight ?? ""} onChange={e=>setEditForm(f=>({...f,seed_weight:e.target.value as unknown as number}))} className={inp} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kadar Air (%)</label><input type="number" step="0.01" min="0" max="100" value={editForm.moisture_content ?? ""} onChange={e=>setEditForm(f=>({...f,moisture_content:e.target.value as unknown as number}))} className={inp} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tgl Panen</label><input type="date" value={editForm.harvest_date ?? ""} onChange={e=>setEditForm(f=>({...f,harvest_date:e.target.value}))} className={inp} /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea value={editForm.notes ?? ""} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} rows={2} className={`${inp} resize-none`} /></div>
              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button>
                <button type="button" onClick={submitEdit} disabled={updateMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">
                  {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
