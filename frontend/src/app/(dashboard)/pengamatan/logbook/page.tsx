"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, BookOpen, Camera, Trash2, Image } from "lucide-react";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate } from "@/lib/utils";

interface LogEntry {
  id: number;
  activity_code: string;
  activity_title: string;
  description: string;
  activity_date: string;
  photos: string[];
  user?: { name: string };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export default function LogbookPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [details, setDetails] = useState<string[]>([""]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["logbook"],
    queryFn: () => api.get<{ data: LogEntry[] }>("/v1/field-activities", {
      params: { activity_type: "logbook", per_page: 100 },
    }).then(r => r.data),
  });
  const entries: LogEntry[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: object) => api.post("/v1/field-activities", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logbook"] });
      toast.success("Log aktivitas berhasil disimpan");
      closeModal();
    },
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
      const res = await api.post<{ url: string }>("/v1/media/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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

  const closeModal = () => {
    setIsModalOpen(false);
    setTitle("");
    setDate(new Date().toISOString().slice(0, 10));
    setDetails([""]);
    setPhotoUrls([]);
  };

  const submit = () => {
    const filledDetails = details.filter(d => d.trim());
    if (!filledDetails.length) { toast.error("Tambahkan minimal satu detail aktivitas"); return; }

    createMutation.mutate({
      activity_type: "logbook",
      activity_title: title.trim() || `Log #${entries.length + 1}`,
      description: filledDetails.join("\n"),
      activity_date: date,
      photo_urls: photoUrls,
    });
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Log Aktivitas Lapang"
        description="Catatan kegiatan lapang harian dengan bukti foto"
        actions={
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
            <Plus className="w-4 h-4" /> Tambah Log
          </button>
        }
      />

      {/* Log list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-gray-100" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada log aktivitas. Klik "Tambah Log" untuk memulai.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            const detailLines = entry.description?.split("\n").filter(Boolean) ?? [];
            return (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Number badge */}
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-700 text-sm font-bold">{entries.length - idx}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{entry.activity_title}</p>
                        <span className="text-xs text-gray-400">{formatDate(entry.activity_date)}</span>
                        {entry.user && <span className="text-xs text-gray-400">· {entry.user.name}</span>}
                      </div>

                      {/* Activity details as list */}
                      {detailLines.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {detailLines.map((line, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="text-green-500 font-bold mt-0.5 flex-shrink-0">·</span>
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Photo thumbnails */}
                      {entry.photos?.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {entry.photos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden hover:opacity-80 transition flex-shrink-0">
                              {url.match(/\.(jpg|jpeg|png|webp)$/i)
                                ? <img src={url} alt="proof" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center bg-gray-50"><Image className="w-6 h-6 text-gray-400" /></div>}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => { if (confirm("Hapus log ini?")) deleteMutation.mutate(entry.id); }}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Tambah Log Aktivitas</h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Judul <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder={`Log #${entries.length + 1}`} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Activity details */}
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

              {/* Photo upload */}
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
                <button type="button" onClick={submit} disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {createMutation.isPending ? "Menyimpan..." : "Simpan Log"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
