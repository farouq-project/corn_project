"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Activity, MapPin, Calendar, Clock, X, Camera, CheckCircle2, ChevronDown, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/axios";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import type { FieldActivity } from "@/types";
import { getApiErrorMessage } from "@/lib/axios";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

const toOptionalNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

const schema = z.object({
  trial_id: z.preprocess(toOptionalNumber, z.number().optional()),
  location_id: z.preprocess(toOptionalNumber, z.number().optional()),
  genotype_id: z.preprocess(toOptionalNumber, z.number().optional()),
  activity_type: z.string().min(1, "Jenis kegiatan wajib dipilih"),
  activity_title: z.string().min(1, "Judul wajib diisi"),
  description: z.string().optional(),
  activity_date: z.string().min(1, "Tanggal wajib diisi"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const activityTypes = [
  { value: "planting", label: "Penanaman", icon: "🌱" },
  { value: "pollination", label: "Penyerbukan", icon: "🌼" },
  { value: "fertilizer_application", label: "Pemupukan", icon: "🌿" },
  { value: "irrigation", label: "Irigasi", icon: "💧" },
  { value: "pesticide_application", label: "Pengendalian HPT", icon: "🔬" },
  { value: "harvesting", label: "Pemanenan", icon: "🌽" },
  { value: "drone_flight", label: "Penerbangan Drone", icon: "🚁" },
  { value: "disease_observation", label: "Pengamatan Penyakit", icon: "🔍" },
  { value: "sampling", label: "Pengambilan Sampel", icon: "🧪" },
  { value: "soil_preparation", label: "Persiapan Lahan", icon: "🚜" },
  { value: "weeding", label: "Penyiangan", icon: "✂️" },
  { value: "monitoring", label: "Monitoring Umum", icon: "📊" },
  { value: "other", label: "Lainnya", icon: "📝" },
];

const activityTypeMap = Object.fromEntries(activityTypes.map((a) => [a.value, a]));

const statusColors: Record<string, string> = {
  submitted: "border-l-4 border-l-blue-400",
  approved: "border-l-4 border-l-green-400",
  draft: "border-l-4 border-l-gray-300",
};

export default function FieldActivitiesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<FieldActivity | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["field-activities", filter],
    queryFn: () => api.get<{ data: FieldActivity[] }>("/v1/field-activities", {
      params: { timeline: true, activity_type: filter !== "all" ? filter : undefined }
    }).then((r) => r.data as unknown as FieldActivity[]),
  });

  const { data: trials } = useQuery({
    queryKey: ["trials-simple"],
    queryFn: () => api.get("/v1/trials?all=true").then((r) => r.data as Array<{ id: number; trial_code: string; trial_name: string }>),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations-simple"],
    queryFn: () => api.get("/v1/locations?all=true").then((r) => r.data as Array<{ id: number; field_name: string }>),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { activity_date: new Date().toISOString().slice(0, 10) },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post("/v1/field-activities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-activities"] });
      toast.success("Kegiatan lapang berhasil dicatat");
      setIsModalOpen(false);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/v1/field-activities/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-activities"] });
      toast.success("Kegiatan disetujui");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => api.put(`/v1/field-activities/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-activities"] });
      toast.success("Kegiatan diperbarui");
      setIsModalOpen(false);
      setEditingActivity(null);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEdit = (activity: FieldActivity) => {
    setEditingActivity(activity);
    reset({
      activity_type: activity.activity_type,
      activity_title: activity.activity_title,
      description: activity.description ?? "",
      activity_date: activity.activity_date,
      start_time: activity.start_time ?? "",
      end_time: activity.end_time ?? "",
      trial_id: activity.trial_id,
      location_id: activity.location_id,
      notes: activity.notes ?? "",
    });
    setIsModalOpen(true);
  };

  const activities = Array.isArray(data) ? data : [];

  const activityCounts = activityTypes.reduce<Record<string, number>>((acc, t) => {
    acc[t.value] = activities.filter((a) => a.activity_type === t.value).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Kegiatan Lapang"
        description="Timeline dan log kegiatan penelitian di lapangan"
        actions={
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
            <Plus className="w-4 h-4" />
            Catat Kegiatan
          </button>
        }
      />

      {/* Activity Type Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter("all")}
          className={cn("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition", filter === "all" ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-green-300")}
        >
          Semua ({activities.length})
        </button>
        {activityTypes.filter((t) => activityCounts[t.value] > 0).map((type) => (
          <button
            key={type.value}
            onClick={() => setFilter(type.value)}
            className={cn("flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition", filter === type.value ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-green-300")}
          >
            <span>{type.icon}</span>
            {type.label} ({activityCounts[type.value]})
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-50 rounded-lg animate-pulse" />)}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada kegiatan lapang tercatat</p>
            <button onClick={() => setIsModalOpen(true)} className="mt-3 text-green-600 text-sm hover:underline">
              Catat kegiatan pertama →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activities.map((activity) => {
              const typeInfo = activityTypeMap[activity.activity_type];
              return (
                <div key={activity.id} className={cn("transition group", statusColors[activity.status] ?? "")}>
                  {/* Main row */}
                  <div
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-lg flex-shrink-0">
                        {typeInfo?.icon ?? "📋"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">{activity.activity_title}</h3>
                            <p className="text-xs text-green-600 font-medium mt-0.5">{typeInfo?.label ?? activity.activity_type}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <StatusBadge status={activity.status} />
                            {activity.status !== "approved" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openEdit(activity); }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-yellow-50 text-yellow-600 transition"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {activity.status === "submitted" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); approveMutation.mutate(activity.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-green-50 text-green-500 transition"
                                title="Setujui"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", expandedId === activity.id && "rotate-180")} />
                          </div>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{formatDate(activity.activity_date)}
                          </span>
                          {(activity.start_time || activity.end_time) && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {activity.start_time}{activity.end_time && ` - ${activity.end_time}`}
                            </span>
                          )}
                          {activity.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{activity.location.field_name}
                            </span>
                          )}
                          {activity.trial && <span className="text-blue-500 font-medium">{activity.trial.trial_code}</span>}
                          {activity.user && <span>oleh: <strong>{activity.user.name}</strong></span>}
                        </div>
                      </div>
                      {activity.photos && activity.photos.length > 0 && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Camera className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-400">{activity.photos.length}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expandable detail */}
                  {expandedId === activity.id && (
                    <div className="px-6 pb-4 pt-0 bg-gray-50/50 border-t border-gray-100">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-xs">
                        {activity.description && (
                          <div className="col-span-2 md:col-span-3 bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-gray-400 font-medium mb-1">Deskripsi Lengkap</p>
                            <p className="text-gray-700">{activity.description}</p>
                          </div>
                        )}
                        {activity.materials_used && activity.materials_used.length > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-gray-400 font-medium mb-1">Bahan Digunakan</p>
                            {activity.materials_used.map((m, i) => (
                              <p key={i} className="text-gray-700">{m.item}: {m.quantity} {m.unit}</p>
                            ))}
                          </div>
                        )}
                        {activity.weather_conditions && (
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-gray-400 font-medium mb-1">Kondisi Cuaca</p>
                            <p className="text-gray-700">
                              {activity.weather_conditions.condition ?? "—"}
                              {activity.weather_conditions.temperature != null && ` · ${activity.weather_conditions.temperature}°C`}
                            </p>
                          </div>
                        )}
                        {(activity.latitude || activity.longitude) && (
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-gray-400 font-medium mb-1">Koordinat GPS</p>
                            <p className="text-gray-700 font-mono">{activity.latitude}, {activity.longitude}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingActivity ? "Edit Kegiatan Lapang" : "Catat Kegiatan Lapang"}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingActivity(null); reset(); }} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => {
              const data = d as unknown as FormData;
              if (editingActivity) updateMutation.mutate({ id: editingActivity.id, data });
              else createMutation.mutate(data);
            })} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Kegiatan *</label>
                <div className="grid grid-cols-3 gap-2">
                  {activityTypes.map((type) => (
                    <label key={type.value} className="cursor-pointer">
                      <input {...register("activity_type")} type="radio" value={type.value} className="sr-only" />
                      <div className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition text-xs [&:has(input:checked)]:border-green-500 [&:has(input:checked)]:bg-green-50">
                        <span>{type.icon}</span>
                        <span className="font-medium">{type.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.activity_type && <p className="text-red-500 text-xs mt-1">{errors.activity_type.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Kegiatan *</label>
                <input {...register("activity_title")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Deskripsi singkat kegiatan" />
                {errors.activity_title && <p className="text-red-500 text-xs mt-1">{errors.activity_title.message}</p>}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                  <input {...register("activity_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mulai</label>
                  <input {...register("start_time")} type="time" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selesai</label>
                  <input {...register("end_time")} type="time" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trial</label>
                  <select {...register("trial_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Trial (opsional) --</option>
                    {trials?.map((t) => <option key={t.id} value={t.id}>{t.trial_code} - {t.trial_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                  <select {...register("location_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Lokasi (opsional) --</option>
                    {locations?.map((l) => <option key={l.id} value={l.id}>{l.field_name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Detail</label>
                <textarea {...register("description")} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" placeholder="Catatan detail kegiatan lapang..." />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingActivity(null); reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
                  {(isSubmitting || createMutation.isPending || updateMutation.isPending) ? "Menyimpan..." : editingActivity ? "Simpan Perubahan" : "Catat Kegiatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
