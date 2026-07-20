"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { Plus, CalendarClock, AlertTriangle, CheckCircle2, Clock, X, Edit2, Calendar, List, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import api from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate, cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/axios";

interface Schedule {
  id: number;
  schedule_title: string;
  observation_type: string;
  scheduled_date: string;
  deadline_date?: string;
  growth_stage_target?: string;
  reminder_days_before?: number;
  instructions?: string;
  status: string;
  trial?: { trial_code: string; trial_name: string };
  environment?: { location?: { field_name: string } };
  assignee?: { name: string };
  completion_rate_percent?: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "border-l-4 border-l-yellow-400 bg-yellow-50/30",
  in_progress: "border-l-4 border-l-blue-400 bg-blue-50/30",
  completed: "border-l-4 border-l-green-400 bg-green-50/30",
  missed: "border-l-4 border-l-red-400 bg-red-50/30",
  cancelled: "border-l-4 border-l-gray-300",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-400",
  in_progress: "bg-blue-400",
  completed: "bg-green-500",
  missed: "bg-red-500",
  cancelled: "bg-gray-300",
};

const OBS_TYPE_LABELS: Record<string, string> = {
  phenotype: "Pengamatan Fenotipe",
  disease_evaluation: "Evaluasi Penyakit",
  field_activity: "Kegiatan Lapang",
  yield_harvest: "Panen/Pengukuran Hasil",
  sampling: "Pengambilan Sampel",
};

const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export default function SchedulesPage() {
  const { user } = useAuthStore();
  const canEdit = !user?.roles?.includes("colaborator");
  const [filter, setFilter] = useState<"all" | "my" | "overdue">("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<Schedule | null>(null);
  const queryClient = useQueryClient();

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["schedules", filter],
    queryFn: () => api.get<{ data: Schedule[] }>("/v1/schedules", {
      params: {
        per_page: 100,
        my_schedule: filter === "my" ? true : undefined,
        overdue: filter === "overdue" ? true : undefined,
      }
    }).then((r) => r.data),
  });

  const { data: overdueAlerts } = useQuery({
    queryKey: ["schedule-alerts"],
    queryFn: () => api.get("/v1/schedules/missing-data-alerts").then((r) => r.data as { overdue_count: number }),
  });

  const { data: trials } = useQuery({
    queryKey: ["trials-simple"],
    queryFn: () => api.get("/v1/trials?all=true").then((r) => r.data as Array<{ id: number; trial_code: string; trial_name: string }>),
  });

  const { data: users } = useQuery({
    queryKey: ["users-simple"],
    queryFn: () => api.get("/v1/users?per_page=50").then((r) => r.data as { data: Array<{ id: number; name: string }> }),
  });

  const { register, handleSubmit, reset } = useForm<Record<string, unknown>>({
    defaultValues: { scheduled_date: new Date().toISOString().slice(0, 10), reminder_days_before: 3 },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/v1/schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Jadwal pengamatan dibuat");
      setIsModalOpen(false);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, rate }: { id: number; rate: number }) =>
      api.put(`/v1/schedules/${id}`, { status: "completed", completion_date: new Date().toISOString().slice(0, 10), completion_rate_percent: rate }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["schedules"] }); toast.success("Jadwal ditandai selesai"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/v1/schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Jadwal diperbarui");
      setIsModalOpen(false);
      setEditingSchedule(null);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Jadwal dihapus");
      setDetailSchedule(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEdit = (s: Schedule) => {
    setEditingSchedule(s);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reset({ schedule_title: s.schedule_title, observation_type: s.observation_type as any, scheduled_date: s.scheduled_date, deadline_date: s.deadline_date ?? "", reminder_days_before: s.reminder_days_before ?? 3, instructions: s.instructions ?? "" });
    setIsModalOpen(true);
  };

  const scheduleList = schedules?.data ?? [];
  const userList = (users as unknown as { data: Array<{ id: number; name: string }> })?.data ?? [];

  // ── Calendar logic ─────────────────────────────────────────────────────────

  const schedulesByDate = useMemo(() => {
    return scheduleList.reduce<Record<string, Schedule[]>>((acc, s) => {
      const key = s.scheduled_date?.slice(0, 10);
      if (key) { acc[key] = [...(acc[key] ?? []), s]; }
      return acc;
    }, {});
  }, [scheduleList]);

  const calendarDays = useMemo(() => {
    const { year, month } = calendarDate;
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calendarDate]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Jadwal Pengamatan"
        description="Rencanakan dan pantau jadwal pengamatan lapangan"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode("list")}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition", viewMode === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button onClick={() => setViewMode("calendar")}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition", viewMode === "calendar" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                <Calendar className="w-3.5 h-3.5" /> Kalender
              </button>
            </div>
            {canEdit && (
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
                <Plus className="w-4 h-4" />
                Buat Jadwal
              </button>
            )}
          </div>
        }
      />

      {/* Alert banner */}
      {(overdueAlerts as Record<string, number>)?.overdue_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{(overdueAlerts as Record<string, number>).overdue_count} jadwal pengamatan terlewat</strong> — Data mungkin tidak lengkap.
          </p>
          <button onClick={() => setFilter("overdue")} className="ml-auto text-xs text-red-600 underline">Lihat</button>
        </div>
      )}

      {/* Filter tabs (list view only) */}
      {viewMode === "list" && (
        <div className="flex gap-2">
          {[["all", "Semua"], ["my", "Tugas Saya"], ["overdue", "Terlambat"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id as typeof filter)}
              className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition", filter === id ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-green-300")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === "list" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : scheduleList.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum ada jadwal pengamatan</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {scheduleList.map((schedule) => {
                const isOverdue = schedule.status === "pending" && new Date(schedule.scheduled_date) < new Date();
                return (
                  <div key={schedule.id} className={cn("p-4 transition group", STATUS_COLORS[schedule.status] ?? "", isOverdue && schedule.status === "pending" ? "border-l-4 border-l-red-500 bg-red-50/30" : "")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {OBS_TYPE_LABELS[schedule.observation_type] ?? schedule.observation_type}
                          </span>
                          {isOverdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">TERLAMBAT</span>}
                        </div>
                        <h3 className="font-semibold text-sm text-gray-900">{schedule.schedule_title}</h3>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(schedule.scheduled_date)}
                          </span>
                          {schedule.trial && <span className="text-green-600 font-mono">{schedule.trial.trial_code}</span>}
                          {schedule.assignee && <span>→ {schedule.assignee.name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                        {canEdit && (
                          <button onClick={() => openEdit(schedule)}
                            className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600 transition" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => { if (confirm(`Hapus jadwal "${schedule.schedule_title}"?`)) deleteMutation.mutate(schedule.id); }}
                            className="p-1.5 rounded hover:bg-red-50 text-red-400 transition" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {schedule.status === "pending" && (
                          <button
                            onClick={() => completeMutation.mutate({ id: schedule.id, rate: 100 })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-xs rounded-lg hover:bg-green-200"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CALENDAR VIEW ──────────────────────────────────────────────────── */}
      {viewMode === "calendar" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <button onClick={() => setCalendarDate(d => {
              const m = d.month - 1;
              return m < 0 ? { year: d.year - 1, month: 11 } : { year: d.year, month: m };
            })} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h2 className="font-semibold text-gray-900 text-sm">
              {MONTH_NAMES[calendarDate.month]} {calendarDate.year}
            </h2>
            <button onClick={() => setCalendarDate(d => {
              const m = d.month + 1;
              return m > 11 ? { year: d.year + 1, month: 0 } : { year: d.year, month: m };
            })} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="min-h-[80px] border-b border-r border-gray-50 bg-gray-50/30" />;

              const dateStr = `${calendarDate.year}-${String(calendarDate.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const daySchedules = schedulesByDate[dateStr] ?? [];
              const isToday = dateStr === todayStr;

              return (
                <div key={dateStr} className={cn("min-h-[80px] border-b border-r border-gray-100 p-1.5", isToday ? "bg-green-50/40" : "hover:bg-gray-50/50")}>
                  <div className={cn("w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1",
                    isToday ? "bg-green-600 text-white" : "text-gray-700")}>
                    {day}
                  </div>
                  <div className="space-y-0.5 max-h-[64px] overflow-y-auto">
                    {daySchedules.map(s => (
                      <button key={s.id} onClick={() => setDetailSchedule(s)}
                        className={cn("w-full text-left text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 hover:opacity-80 transition truncate",
                          s.status === "completed" ? "bg-green-100 text-green-800" :
                          s.status === "missed" ? "bg-red-100 text-red-800" :
                          new Date(s.scheduled_date) < new Date() ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-800")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_DOT[s.status] ?? "bg-gray-300")} />
                        <span className="truncate">{s.schedule_title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
            {[["bg-green-500","Selesai"],["bg-blue-400","Terjadwal"],["bg-red-500","Terlambat"],["bg-gray-300","Dibatalkan"]].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", color)} /> {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Schedule Detail Modal (calendar click) ─────────────────────────── */}
      {detailSchedule && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {OBS_TYPE_LABELS[detailSchedule.observation_type] ?? detailSchedule.observation_type}
                </span>
                <h3 className="font-semibold text-gray-900 mt-1.5">{detailSchedule.schedule_title}</h3>
              </div>
              <button onClick={() => setDetailSchedule(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Tanggal</p>
                  <p className="font-medium">{formatDate(detailSchedule.scheduled_date)}</p>
                </div>
                {detailSchedule.deadline_date && (
                  <div>
                    <p className="text-xs text-gray-400">Tenggat</p>
                    <p className="font-medium">{formatDate(detailSchedule.deadline_date)}</p>
                  </div>
                )}
                {detailSchedule.trial && (
                  <div>
                    <p className="text-xs text-gray-400">Research Plan</p>
                    <p className="font-medium font-mono text-green-700">{detailSchedule.trial.trial_code}</p>
                  </div>
                )}
                {detailSchedule.assignee && (
                  <div>
                    <p className="text-xs text-gray-400">Ditugaskan ke</p>
                    <p className="font-medium">{detailSchedule.assignee.name}</p>
                  </div>
                )}
              </div>
              {detailSchedule.instructions && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Instruksi</p>
                  <p className="text-sm text-gray-700">{detailSchedule.instructions}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {canEdit && (
                  <button onClick={() => { setDetailSchedule(null); openEdit(detailSchedule); }}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => { if (confirm(`Hapus jadwal "${detailSchedule.schedule_title}"?`)) deleteMutation.mutate(detailSchedule.id); }}
                    disabled={deleteMutation.isPending}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 transition">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                )}
                {detailSchedule.status === "pending" && (
                  <button onClick={() => { completeMutation.mutate({ id: detailSchedule.id, rate: 100 }); setDetailSchedule(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Modal ─────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editingSchedule ? "Edit Jadwal" : "Buat Jadwal Pengamatan"}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingSchedule(null); reset(); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => {
              if (editingSchedule) updateMutation.mutate({ id: editingSchedule.id, data: d as Record<string, unknown> });
              else createMutation.mutate(d as Record<string, unknown>);
            })} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Jadwal *</label>
                <input {...register("schedule_title", { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. Pengamatan berbunga MH2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Pengamatan *</label>
                  <select {...register("observation_type", { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {Object.entries(OBS_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Research Plan</label>
                  <select {...register("trial_id")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Pilih Research Plan --</option>
                    {trials?.map((t) => <option key={t.id} value={t.id}>{t.trial_code}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Jadwal *</label>
                  <input {...register("scheduled_date", { required: true })} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenggat</label>
                  <input {...register("deadline_date")} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ditugaskan ke</label>
                  <select {...register("assigned_to")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Siapapun --</option>
                    {userList.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pengingat (hari sebelum)</label>
                  <input {...register("reminder_days_before")} type="number" min="0" max="30" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instruksi</label>
                <textarea {...register("instructions")} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingSchedule(null); reset(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                  {(createMutation.isPending || updateMutation.isPending) ? "Menyimpan..." : editingSchedule ? "Simpan Perubahan" : "Buat Jadwal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
