"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Download, Trash2, X, Upload, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate, cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";

const CATEGORY_COLORS: Record<string, string> = {
  research_plan: "bg-green-50 text-green-700 border-green-200",
  sop: "bg-blue-50 text-blue-700 border-blue-200",
  rainfall_data: "bg-cyan-50 text-cyan-700 border-cyan-200",
  soil_analysis: "bg-amber-50 text-amber-700 border-amber-200",
  genotype_list: "bg-green-50 text-green-700 border-green-200",
  field_documentation: "bg-emerald-50 text-emerald-700 border-emerald-200",
  harvest_report: "bg-orange-50 text-orange-700 border-orange-200",
  statistical_output: "bg-purple-50 text-purple-700 border-purple-200",
  variety_release: "bg-red-50 text-red-700 border-red-200",
  financial: "bg-yellow-50 text-yellow-700 border-yellow-200",
  kontrak: "bg-teal-50 text-teal-700 border-teal-200",
  protocol: "bg-indigo-50 text-indigo-700 border-indigo-200",
  other: "bg-gray-50 text-gray-700 border-gray-200",
};

interface DocCategory { code: string; label: string; }
interface ResearchDoc { id: number; document_code: string; title: string; category: string; original_filename: string; document_date?: string; trial?: { trial_code: string }; uploader?: { name: string }; human_size?: string; url?: string; }

export default function DocumentsPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<ResearchDoc | null>(null);
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ["doc-categories"],
    queryFn: () => api.get<DocCategory[]>("/v1/documents/categories").then((r) => r.data),
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", selectedCategory],
    queryFn: () => api.get<{ data: ResearchDoc[] }>("/v1/documents", {
      params: { category: selectedCategory !== "all" ? selectedCategory : undefined, per_page: 50 }
    }).then((r) => r.data),
  });

  const { data: trials } = useQuery({
    queryKey: ["trials-simple"],
    queryFn: () => api.get("/v1/trials?all=true").then((r) => r.data as Array<{ id: number; trial_code: string; trial_name: string }>),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/documents/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["documents"] }); toast.success("Dokumen dihapus"); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setUploading(true);
    try {
      await api.post("/v1/documents", formData, { headers: { "Content-Type": "multipart/form-data" } });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Dokumen berhasil diupload");
      setIsUploadOpen(false);
      form.reset();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const docs = documents?.data ?? [];
  const catList = (categories as unknown as DocCategory[]) ?? [];

  const docsByCategory = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Manajemen Dokumen Penelitian"
        description="SOP · Data Curah Hujan · Analisis Tanah · Laporan Panen · Output Statistik"
        actions={
          <button onClick={() => setIsUploadOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Upload className="w-4 h-4" />
            Upload Dokumen
          </button>
        }
      />

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory("all")}
          className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition border", selectedCategory === "all" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400")}
        >
          Semua ({docs.length})
        </button>
        {catList.map((cat) => (
          <button
            key={cat.code}
            onClick={() => setSelectedCategory(cat.code)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition border", selectedCategory === cat.code ? "bg-gray-800 text-white border-gray-800" : cn("bg-white border", CATEGORY_COLORS[cat.code] ?? "border-gray-200 text-gray-600"))}
          >
            {cat.label} {docsByCategory[cat.code] ? `(${docsByCategory[cat.code]})` : ""}
          </button>
        ))}
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-36 bg-white rounded-xl animate-pulse border border-gray-100" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada dokumen di kategori ini</p>
          <button onClick={() => setIsUploadOpen(true)} className="mt-2 text-green-600 text-sm hover:underline">Upload dokumen pertama →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border inline-block mb-2", CATEGORY_COLORS[doc.category] ?? "bg-gray-50 text-gray-700 border-gray-200")}>
                    {catList.find((c) => c.code === doc.category)?.label ?? doc.category}
                  </span>
                  <h3 className="font-semibold text-sm text-gray-900 truncate">{doc.title}</h3>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{doc.original_filename}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-300 flex-shrink-0 group-hover:text-gray-400 transition" />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                <div className="text-xs text-gray-400 space-y-0.5">
                  {doc.trial && <p>Trial: <span className="font-mono text-green-700">{doc.trial.trial_code}</span></p>}
                  {doc.document_date && <p>{formatDate(doc.document_date)}</p>}
                  <p>oleh {doc.uploader?.name}</p>
                </div>
                <div className="flex gap-1">
                  {doc.url && (
                    <button onClick={() => setViewingDoc(doc)} className="p-1.5 rounded hover:bg-green-50 text-green-600 transition" title="Lihat Dokumen">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-blue-50 text-blue-500 transition" title="Download">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => { if (confirm("Hapus dokumen ini?")) deleteMutation.mutate(doc.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400 transition" title="Hapus">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 truncate">{viewingDoc.title}</h3>
                <p className="text-xs text-gray-400 truncate">{viewingDoc.original_filename} {viewingDoc.human_size ? `· ${viewingDoc.human_size}` : ""}</p>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {viewingDoc.url && (
                  <a href={viewingDoc.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg hover:bg-green-100 transition">
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                )}
                <button onClick={() => setViewingDoc(null)} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-0">
              {viewingDoc.url && /\.(pdf)$/i.test(viewingDoc.original_filename) ? (
                <iframe src={viewingDoc.url} className="w-full rounded border border-gray-100" style={{ height: "60vh" }} title={viewingDoc.title} />
              ) : viewingDoc.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(viewingDoc.original_filename) ? (
                <img src={viewingDoc.url} alt={viewingDoc.title} className="max-w-full max-h-[60vh] mx-auto rounded shadow" />
              ) : (
                <div className="flex flex-col items-center justify-center h-52 gap-4 text-gray-400">
                  <FileText className="w-16 h-16 opacity-20" />
                  <p className="text-sm">File ini tidak dapat ditampilkan secara langsung.</p>
                  {viewingDoc.url && (
                    <a href={viewingDoc.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                      <Download className="w-4 h-4" /> Download untuk membuka
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Upload Dokumen Penelitian</h3>
              <button onClick={() => setIsUploadOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Dokumen *</label>
                <input name="title" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Nama dokumen" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
                  <select name="category" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih --</option>
                    {catList.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trial (opsional)</label>
                  <select name="trial_id" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Semua Trial --</option>
                    {trials?.map((t) => <option key={t.id} value={t.id}>{t.trial_code}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Dokumen</label>
                <input name="document_date" type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.docx,.doc,.zip"
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, CSV, ZIP, JPG/PNG — max 50MB</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea name="description" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsUploadOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={uploading} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Mengupload...</> : <><Upload className="w-4 h-4" />Upload</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
