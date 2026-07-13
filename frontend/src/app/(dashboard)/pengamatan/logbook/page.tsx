"use client";

import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, BookOpen, Camera, Trash2, Edit2, Search, ChevronUp, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface LogEntry {
  id: number;
  activity_code: string;
  activity_title: string;
  description: string;
  activity_date: string;
  photos: string[];
  user?: { name: string };
  location?: { field_name: string; id: number };
}

type SortKey = "activity_date" | "activity_title" | "location";
type SortDir = "asc" | "desc";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export default function LogbookPage() {
  const { user } = useAuthStore();
  const canEdit = !user?.roles?.includes("colaborator");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState<number | null>(null);
  const [details, setDetails] = useState<string[]>([""]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("activity_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["logbook"],
    queryFn: () => api.get<{ data: LogEntry[] }>("/v1/field-activities", {
      params: { activity_type: "logbook", per_page: 200 },
    }).then(r => r.data),
  });

  const { data: locData } = useQuery({
    queryKey: ["locations-list"],
    queryFn: () => api.get<{ data: Array<{ id: number; field_name: string; field_code: string }> }>("/v1/locations?per_page=200").then(r => r.data),
    staleTime: 60000,
  });
  const locations = locData?.data ?? [];
  const rawEntries: LogEntry[] = data?.data ?? [];

  const entries = useMemo(() => {
    let list = rawEntries;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.activity_title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.field_name?.toLowerCase().includes(q) ||
        e.user?.name?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let va: string, vb: string;
      if (sortKey === "activity_date") { va = a.activity_date; vb = b.activity_date; }
      else if (sortKey === "activity_title") { va = a.activity_title; vb = b.activity_title; }
      else { va = a.location?.field_name ?? ""; vb = b.location?.field_name ?? ""; }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [rawEntries, search, sortKey, sortDir]);

  const createMutation = useMutation({
    mutationFn: (payload: object) => api.post("/v1/field-activities", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["logbook"] }); toast.success("Log aktivitas berhasil disimpan"); closeModal(); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => api.put(`/v1/field-activities/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["logbook"] }); toast.success("Log berhasil diperbarui"); closeModal(); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/field-activities/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["logbook"] }); toast.success("Log dihapus"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "activity-photos");
      const res = await api.post<{ url: string }>("/v1/media/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoUrls(prev => [...prev, res.data.url]);
      toast.success("Foto berhasil diunggah");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addDetail = () => setDetails(d => [...d, ""]);
  const removeDetail = (i: number) => setDetails(d => d.filter((_, idx) => idx !== i));
  const updateDetail = (i: number, v: string) => setDetails(d => d.map((x, idx) => idx === i ? v : x));

  const openCreate = () => {
    setEditingEntry(null);
    setTitle("");
    setDate(new Date().toISOString().slice(0, 10));
    setLocationId(null);
    setDetails([""]);
    setPhotoUrls([]);
    setIsModalOpen(true);
  };

  const openEdit = (entry: LogEntry) => {
    setEditingEntry(entry);
    setTitle(entry.activity_title);
    setDate(entry.activity_date);
    setLocationId(entry.location?.id ?? null);
    setDetails(entry.description?.split("\n").filter(Boolean) ?? [""]);
    setPhotoUrls(entry.photos ?? []);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setTitle("");
    setDate(new Date().toISOString().slice(0, 10));
    setLocationId(null);
    setDetails([""]);
    setPhotoUrls([]);
  };

  const downloadCSV = () => {
    const header = ["Kode", "Judul", "Detail Aktivitas", "Lokasi", "Nama Petugas", "Tanggal"];
    const rows = entries.map(e => [
      e.activity_code,
      e.activity_title,
      e.description?.replace(/\n/g, "; ") ?? "",
      e.location?.field_name ?? "",
      e.user?.name ?? "",
      e.activity_date,
    ]);
    const csv = [header, ...rows].map(r =>
      r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log-aktivitas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = () => {
    const filledDetails = details.filter(d => d.trim());
    if (!filledDetails.length) { toast.error("Tambahkan minimal satu detail aktivitas"); return; }
    const payload = {
      activity_type: "logbook",
      location_id: locationId || undefined,
      activity_title: title.trim() || `Log #${rawEntries.length + 1}`,
      description: filledDetails.join("\n"),
      activity_date: date,
      photo_urls: photoUrls,
    };
    if (editingEntry) updateMutation.mutate({ id: editingEntry.id, payload });
    else createMutation.mutate(payload);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-gray-300" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-green-600" /> : <ChevronDown className="w-3 h-3 text-green-600" />;
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Log Aktivitas Lapang"
        description="Catatan kegiatan lapang harian dengan bukti foto"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={downloadCSV}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition">
              <Download className="w-4 h-4" /> Export Excel
            </button>
            {canEdit && (
              <button onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
                <Plus className="w-4 h-4" /> Tambah Log
              </button>
            )}
          </div>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari judul, detail, lokasi, nama..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? "Tidak ada hasil pencarian" : "Belum ada log aktivitas"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-12">Foto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700" onClick={() => toggleSort("activity_title")}>
                    <span className="flex items-center gap-1">Judul <SortIcon col="activity_title" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Detail</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700" onClick={() => toggleSort("location")}>
                    <span className="flex items-center gap-1">Lokasi <SortIcon col="location" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nama</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap" onClick={() => toggleSort("activity_date")}>
                    <span className="flex items-center gap-1">Tanggal <SortIcon col="activity_date" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(entry => {
                  const detailLines = entry.description?.split("\n").filter(Boolean) ?? [];
                  const firstPhoto = entry.photos?.[0];
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50/50 group transition">
                      <td className="px-4 py-3">
                        {firstPhoto ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                            {firstPhoto.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                              <img src={firstPhoto} alt="proof" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <Camera className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                            <Camera className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[180px]">{entry.activity_title}</p>
                        {entry.photos?.length > 1 && (
                          <p className="text-xs text-gray-400 mt-0.5">{entry.photos.length} foto</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ul className="space-y-0.5 max-w-[240px]">
                          {detailLines.slice(0, 2).map((line, i) => (
                            <li key={i} className="text-xs text-gray-600 truncate flex items-start gap-1">
                              <span className="text-green-500 mt-0.5 flex-shrink-0">·</span>{line}
                            </li>
                          ))}
                          {detailLines.length > 2 && (
                            <li className="text-xs text-gray-400">+{detailLines.length - 2} lainnya</li>
                          )}
                        </ul>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{entry.location?.field_name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{entry.user?.name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-500">{formatDate(entry.activity_date)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {canEdit && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => openEdit(entry)} className="p-1.5 rounded hover:bg-blue-50 text-blue-400 transition" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { if (confirm("Hapus log ini?")) deleteMutation.mutate(entry.id); }}
                              className="p-1.5 rounded hover:bg-red-50 text-red-400 transition" title="Hapus">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingEntry ? "Edit Log Aktivitas" : "Tambah Log Aktivitas"}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Judul <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder={`Log #${rawEntries.length + 1}`} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                  <select value={locationId ?? ""} onChange={e => setLocationId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                    <option value="">— Pilih Lokasi —</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.field_name} ({l.field_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Petugas</label>
                  <input value={user?.name ?? ""} readOnly className={inputCls + " bg-gray-50 text-gray-400 cursor-not-allowed"} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Detail Aktivitas *</label>
                  <button type="button" onClick={addDetail}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition">
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>
                <div className="space-y-2">
                  {details.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-green-500 font-bold text-sm flex-shrink-0">{i + 1}.</span>
                      <input value={d} onChange={e => updateDetail(i, e.target.value)}
                        placeholder={`Detail aktivitas ${i + 1}...`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      {details.length > 1 && (
                        <button type="button" onClick={() => removeDetail(i)}
                          className="p-1.5 text-gray-300 hover:text-red-400 transition flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Foto Bukti</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {photoUrls.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg border border-gray-200 overflow-hidden group">
                      {url.match(/\.(jpg|jpeg|png|webp)$/i)
                        ? <img src={url} alt="proof" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-gray-50"><Camera className="w-6 h-6 text-gray-400" /></div>}
                      <button onClick={() => setPhotoUrls(p => p.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-600 transition disabled:opacity-50 text-xs gap-1">
                    <Camera className="w-5 h-5" />
                    {uploadingPhoto ? "..." : "Foto"}
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }} />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="button" onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {(createMutation.isPending || updateMutation.isPending) ? "Menyimpan..." : editingEntry ? "Simpan Perubahan" : "Simpan Log"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
