"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Edit2, Eye, Trash2, Upload, Camera, Package, User, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { formatDate, cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

interface InventoryItem {
  id: number;
  name: string;
  category?: string;
  description?: string;
  quantity: number;
  unit?: string;
  condition: "good" | "damaged" | "lost" | "maintenance";
  location?: string;
  product_photos?: string[];
  borrower_name?: string;
  borrower_contact?: string;
  borrower_photos?: string[];
  loan_date?: string;
  expected_return_date?: string;
  notes?: string;
  recorder?: { name: string };
  created_at: string;
}

const CONDITION_LABEL: Record<string, string> = {
  good: "Baik", damaged: "Rusak", lost: "Hilang", maintenance: "Perawatan",
};
const CONDITION_COLOR: Record<string, string> = {
  good: "active", damaged: "rejected", lost: "cancelled", maintenance: "pending",
};

const PRESET_CATEGORIES = ["Alat Lab", "Alat Lapang", "Bahan Kimia", "Elektronik", "Furnitur", "Kendaraan", "APD", "Lainnya"];

const emptyForm = (): Partial<InventoryItem> => ({
  name: "", category: "", description: "", quantity: 1, unit: "pcs",
  condition: "good", location: "", product_photos: [], borrower_name: "",
  borrower_contact: "", borrower_photos: [], notes: "",
});

export default function InventoryPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [viewing, setViewing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<Partial<InventoryItem>>(emptyForm());
  const [uploadingProd, setUploadingProd] = useState(false);
  const [uploadingBorr, setUploadingBorr] = useState(false);
  const prodPhotoRef = useRef<HTMLInputElement>(null);
  const borrPhotoRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const set = (k: keyof InventoryItem, v: unknown) => setForm(p => ({...p, [k]: v}));

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: () => api.get<{data: InventoryItem[]}>("/v1/inventory-items?per_page=200").then(r => r.data),
    staleTime: 0,
  });
  const items: InventoryItem[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: Partial<InventoryItem>) => api.post("/v1/inventory-items", d),
    onSuccess: () => { qc.invalidateQueries({queryKey:["inventory-items"]}); toast.success("Item ditambahkan"); close(); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({id, d}: {id:number; d: Partial<InventoryItem>}) => api.put(`/v1/inventory-items/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({queryKey:["inventory-items"]}); toast.success("Item diperbarui"); close(); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/inventory-items/${id}`),
    onSuccess: () => { qc.invalidateQueries({queryKey:["inventory-items"]}); toast.success("Item dihapus"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post("/v1/inventory-items/bulk-destroy", {ids}),
    onSuccess: (res) => { qc.invalidateQueries({queryKey:["inventory-items"]}); toast.success((res.data as {message?:string})?.message ?? "Dihapus"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const uploadPhoto = async (file: File, field: "product_photos" | "borrower_photos", setUploading: (v:boolean)=>void) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", "inventory");
      const res = await api.post<{url:string}>("/v1/media/upload", fd, {headers:{"Content-Type":"multipart/form-data"}});
      set(field, [...(form[field] ?? []), res.data.url]);
      toast.success("Foto diunggah");
    } catch(e) { toast.error(getApiErrorMessage(e)); }
    finally { setUploading(false); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setIsModalOpen(true); };
  const openEdit = (item: InventoryItem) => { setEditing(item); setForm({...item}); setIsModalOpen(true); };
  const close = () => { setIsModalOpen(false); setEditing(null); setForm(emptyForm()); };

  const submit = () => {
    if (!form.name?.trim()) { toast.error("Nama item wajib diisi"); return; }
    if (editing) updateMutation.mutate({id: editing.id, d: form});
    else createMutation.mutate(form);
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  const columns: ColumnDef<InventoryItem, unknown>[] = [
    {
      header: "Foto",
      id: "photo",
      cell: ({row}) => {
        const ph = row.original.product_photos;
        return ph?.length ? (
          <img src={ph[0]} alt="item" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
        ) : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Package className="w-4 h-4 text-gray-400"/></div>;
      },
    },
    { header: "Nama Item", accessorKey: "name", cell: ({getValue}) => <span className="font-medium text-gray-800">{getValue() as string}</span> },
    { header: "Kategori", accessorKey: "category", cell: ({getValue}) => <span className="text-xs text-gray-500">{(getValue() as string) || "—"}</span> },
    { header: "Jml", id: "qty", cell: ({row}) => <span className="text-sm">{row.original.quantity} {row.original.unit ?? ""}</span> },
    { header: "Kondisi", accessorKey: "condition", cell: ({getValue}) => {
      const v = getValue() as string;
      return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", v==="good"?"bg-green-50 text-green-700":v==="damaged"?"bg-red-50 text-red-700":v==="lost"?"bg-gray-100 text-gray-600":"bg-yellow-50 text-yellow-700")}>{CONDITION_LABEL[v]}</span>;
    }},
    { header: "Lokasi", accessorKey: "location", cell: ({getValue}) => <span className="text-xs text-gray-500">{(getValue() as string) || "—"}</span> },
    {
      header: "Peminjam",
      id: "borrower",
      cell: ({row}) => row.original.borrower_name ? (
        <div className="flex items-center gap-1.5">
          {row.original.borrower_photos?.[0] ? (
            <img src={row.original.borrower_photos[0]} alt="borrower" className="w-6 h-6 rounded-full object-cover border border-gray-200" />
          ) : <User className="w-4 h-4 text-gray-400"/>}
          <span className="text-xs text-orange-700 font-medium">{row.original.borrower_name}</span>
        </div>
      ) : <span className="text-xs text-gray-300">—</span>,
    },
    {
      header: "Aksi", id: "act",
      cell: ({row}) => (
        <div className="flex gap-1">
          <button onClick={() => setViewing(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-400"><Eye className="w-3.5 h-3.5"/></button>
          <button onClick={() => openEdit(row.original)} className="p-1.5 rounded hover:bg-yellow-50 text-yellow-500"><Edit2 className="w-3.5 h-3.5"/></button>
          <button onClick={() => { if(confirm(`Hapus "${row.original.name}"?`)) deleteMutation.mutate(row.original.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
      ),
    },
  ];

  const photoGrid = (photos: string[] | undefined, onRemove?: (i:number) => void) => (
    <div className="flex flex-wrap gap-2">
      {(photos ?? []).map((url, i) => (
        <div key={i} className="relative group w-20 h-20 rounded-lg border border-gray-200 overflow-hidden">
          <img src={url} alt="photo" className="w-full h-full object-cover" />
          {onRemove && (
            <button onClick={() => onRemove(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100">
              <X className="w-3 h-3"/>
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Inventaris"
        description="Kelola inventaris alat, bahan, dan peralatan penelitian"
        actions={
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
            <Plus className="w-4 h-4" /> Tambah Item
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Item", value: items.length, color: "bg-blue-50 text-blue-700" },
          { label: "Kondisi Baik", value: items.filter(i=>i.condition==="good").length, color: "bg-green-50 text-green-700" },
          { label: "Dipinjam", value: items.filter(i=>i.borrower_name).length, color: "bg-orange-50 text-orange-700" },
          { label: "Rusak/Hilang", value: items.filter(i=>["damaged","lost"].includes(i.condition)).length, color: "bg-red-50 text-red-700" },
        ].map(c => (
          <div key={c.label} className={cn("rounded-xl p-4 text-center", c.color)}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs mt-0.5 opacity-80">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <DataTable
          data={items}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Cari nama, kategori, atau peminjam..."
          emptyMessage="Belum ada item inventaris."
          getRowId={r => String(r.id)}
          onBulkDelete={rows => bulkDeleteMutation.mutate(rows.map(r => r.id))}
          isBulkDeleting={bulkDeleteMutation.isPending}
        />
      </div>

      {/* ── Add / Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold">{editing ? "Edit Item" : "Tambah Item Inventaris"}</h3>
              <button onClick={close} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Nama Item *</label><input value={form.name ?? ""} onChange={e=>set("name",e.target.value)} className={inp} placeholder="contoh: Timbangan Digital 5kg" /></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <input value={form.category ?? ""} onChange={e=>set("category",e.target.value)} list="cat-inv" className={inp} placeholder="Alat Lab" />
                  <datalist id="cat-inv">{PRESET_CATEGORIES.map(c=><option key={c} value={c}/>)}</datalist>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Kondisi</label>
                  <select value={form.condition ?? "good"} onChange={e=>set("condition",e.target.value)} className={inp}>
                    {Object.entries(CONDITION_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Jumlah</label><input type="number" min="0" step="0.01" value={form.quantity ?? 1} onChange={e=>set("quantity",Number(e.target.value))} className={inp} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label><input value={form.unit ?? ""} onChange={e=>set("unit",e.target.value)} className={inp} placeholder="pcs, kg, liter" list="unit-inv" /><datalist id="unit-inv">{["pcs","kg","liter","set","buah","lembar","unit"].map(u=><option key={u} value={u}/>)}</datalist></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Lokasi Penyimpanan</label><input value={form.location ?? ""} onChange={e=>set("location",e.target.value)} className={inp} placeholder="Rak A3, Gudang Lab" /></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label><textarea value={form.description ?? ""} onChange={e=>set("description",e.target.value)} rows={2} className={`${inp} resize-none`} /></div>
              </div>

              {/* Product photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Foto Produk</label>
                {photoGrid(form.product_photos, (i) => set("product_photos", (form.product_photos??[]).filter((_,idx)=>idx!==i)))}
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={()=>prodPhotoRef.current?.click()} disabled={uploadingProd} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"><Upload className="w-4 h-4"/>{uploadingProd?"Uploading...":"Upload Foto"}</button>
                  <button type="button" onClick={()=>{const el=document.createElement("input");el.type="file";el.accept="image/*";el.capture="environment";el.onchange=(ev)=>{const f=(ev.target as HTMLInputElement).files?.[0];if(f)uploadPhoto(f,"product_photos",setUploadingProd);};el.click();}} disabled={uploadingProd} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"><Camera className="w-4 h-4"/>Kamera</button>
                  <input ref={prodPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadPhoto(f,"product_photos",setUploadingProd);e.target.value="";}} />
                </div>
              </div>

              {/* Borrower section */}
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2"><User className="w-4 h-4 text-orange-500"/> Informasi Peminjam <span className="text-xs text-gray-400 font-normal">(kosongkan jika tidak dipinjam)</span></p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Peminjam</label><input value={form.borrower_name ?? ""} onChange={e=>set("borrower_name",e.target.value||null)} className={inp} placeholder="Nama lengkap" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Kontak</label><input value={form.borrower_contact ?? ""} onChange={e=>set("borrower_contact",e.target.value||null)} className={inp} placeholder="No. HP / email" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pinjam</label><input type="date" value={form.loan_date ?? ""} onChange={e=>set("loan_date",e.target.value||null)} className={inp} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Rencana Kembali</label><input type="date" value={form.expected_return_date ?? ""} onChange={e=>set("expected_return_date",e.target.value||null)} className={inp} /></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Foto Peminjam</label>
                  {photoGrid(form.borrower_photos, (i) => set("borrower_photos", (form.borrower_photos??[]).filter((_,idx)=>idx!==i)))}
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={()=>borrPhotoRef.current?.click()} disabled={uploadingBorr} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"><Upload className="w-4 h-4"/>{uploadingBorr?"Uploading...":"Upload Foto"}</button>
                    <button type="button" onClick={()=>{const el=document.createElement("input");el.type="file";el.accept="image/*";el.capture="user";el.onchange=(ev)=>{const f=(ev.target as HTMLInputElement).files?.[0];if(f)uploadPhoto(f,"borrower_photos",setUploadingBorr);};el.click();}} disabled={uploadingBorr} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"><Camera className="w-4 h-4"/>Selfie</button>
                    <input ref={borrPhotoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadPhoto(f,"borrower_photos",setUploadingBorr);e.target.value="";}} />
                  </div>
                </div>
              </div>

              <div><label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label><textarea value={form.notes ?? ""} onChange={e=>set("notes",e.target.value)} rows={2} className={`${inp} resize-none`} /></div>

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={close} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button>
                <button type="button" onClick={submit} disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">
                  {editing ? "Simpan Perubahan" : "Tambah Item"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-semibold text-gray-900">{viewing.name}</h3>
              <button onClick={() => setViewing(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Product photos */}
              {viewing.product_photos?.length ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Foto Produk</p>
                  <div className="flex flex-wrap gap-2">
                    {viewing.product_photos.map((url,i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="product" className="w-24 h-24 rounded-lg object-cover border border-gray-200 hover:opacity-80"/>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Kategori", viewing.category ?? "—"],
                  ["Kondisi", CONDITION_LABEL[viewing.condition]],
                  ["Jumlah", `${viewing.quantity} ${viewing.unit ?? ""}`],
                  ["Lokasi", viewing.location ?? "—"],
                ].map(([l,v]) => (
                  <div key={l} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">{l}</p>
                    <p className="font-medium text-gray-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>

              {viewing.description && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewing.description}</p>}

              {/* Borrower info */}
              {viewing.borrower_name && (
                <div className="border border-orange-100 rounded-xl p-4 bg-orange-50/40">
                  <p className="text-xs font-semibold text-orange-600 uppercase mb-3 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/> Sedang Dipinjam</p>
                  {viewing.borrower_photos?.length ? (
                    <div className="flex gap-2 mb-3">
                      {viewing.borrower_photos.map((url,i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="borrower" className="w-16 h-16 rounded-full object-cover border-2 border-orange-200"/>
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="space-y-1 text-sm">
                    <p><strong>Peminjam:</strong> {viewing.borrower_name}</p>
                    {viewing.borrower_contact && <p><strong>Kontak:</strong> {viewing.borrower_contact}</p>}
                    {viewing.loan_date && <p><strong>Tanggal Pinjam:</strong> {formatDate(viewing.loan_date)}</p>}
                    {viewing.expected_return_date && <p><strong>Rencana Kembali:</strong> {formatDate(viewing.expected_return_date)}</p>}
                  </div>
                </div>
              )}

              {viewing.notes && <div><p className="text-xs text-gray-400 mb-1">Catatan</p><p className="text-sm text-gray-600">{viewing.notes}</p></div>}

              <div className="flex gap-2 pt-2 border-t">
                <button onClick={() => setViewing(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Tutup</button>
                <button onClick={() => { openEdit(viewing); setViewing(null); }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1"><Edit2 className="w-4 h-4"/>Edit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
