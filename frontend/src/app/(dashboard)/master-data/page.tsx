"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Map, Calendar, Package, X, Dna, BookOpen,
  Microscope, MapPin, Repeat2, Edit2, Upload, Download,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Leaf, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/axios";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EnvironmentForm, type EnvironmentFormData } from "@/components/environment/EnvironmentForm";
import type { Season, StorageUnit, Characteristic, Environment, Genotype, Trial } from "@/types";
// Location type no longer needed — Lokasi tab removed, address embedded in Lingkungan
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate, cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type TabType = "genotypes" | "trials" | "characteristics" | "environments" | "environment_conditions" | "replications"
             | "storage_units";

interface EnvCondition { id: number; name: string; description?: string; is_active: boolean; }

const toN = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

// ── Jenis Jagung logic ────────────────────────────────────────────────────────

interface JenisJagungRule {
  threshold: number;
  label: string;
}

const DEFAULT_JENIS_RULES: JenisJagungRule[] = [
  { threshold: 10000, label: "Field Corn" },
  { threshold: 20000, label: "Sweet Corn" },
  { threshold: 30000, label: "Hibrida Field Corn" },
  { threshold: 40000, label: "Hibrida Sweet Corn" },
];

const JENIS_COLORS: Record<string, string> = {
  "Field Corn": "bg-green-50 text-green-700",
  "Sweet Corn": "bg-yellow-50 text-yellow-700",
  "Hibrida Field Corn": "bg-blue-50 text-blue-700",
  "Hibrida Sweet Corn": "bg-purple-50 text-purple-700",
  "Check": "bg-gray-100 text-gray-500",
};

const JENIS_LS_KEY = "jenis-jagung-rules";

function loadJenisRules(): JenisJagungRule[] {
  try {
    const raw = localStorage.getItem(JENIS_LS_KEY);
    if (raw) return JSON.parse(raw) as JenisJagungRule[];
  } catch {}
  return DEFAULT_JENIS_RULES;
}

function getJenisJagung(code: string, rules: JenisJagungRule[]): string {
  const num = parseInt(code.substring(0, 5), 10);
  if (isNaN(num)) return "Check";
  const sorted = [...rules].sort((a, b) => b.threshold - a.threshold);
  for (const rule of sorted) {
    if (num > rule.threshold) return rule.label;
  }
  return "Check";
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const genotypeSchema = z.object({
  genotype_code: z.string().min(1),
  genotype_name: z.string().min(1),
  category: z.enum(["inbred_line", "hybrid", "variety", "population", "germplasm"]),
  trial_type: z.enum(["drought", "shade", "normal", "feed", "sweet_corn", "multi"]).default("normal"),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
});

const toNullableId = (v: unknown) => (v === "" || v == null) ? null : Number(v);

const trialSchema = z.object({
  trial_code: z.string().min(1),
  trial_name: z.string().min(1),
  environment_id: z.preprocess(toNullableId, z.number().positive().nullable().optional()),
  environment_condition_id: z.preprocess(toNullableId, z.number().positive().nullable().optional()),
  planting_date: z.string().optional(),
  layout_design: z.enum(["RCBD", "CRD", "split_plot", "factorial", "augmented", "alpha_lattice"]).default("RCBD"),
  replications: z.preprocess(Number, z.number().min(1).max(20).default(3)),
  num_plots: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(1).max(10000).optional()),
  num_samples: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(1).max(100).optional()),
  status: z.enum(["planned", "active", "harvested", "completed", "cancelled"]).default("planned"),
});

const charSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  group: z.string().optional(),
  unit: z.string().max(20).optional(),
  method_description: z.string().optional(),
  decimal_places: z.coerce.number().int().min(0).max(6).default(2),
  display_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

const seasonSchema = z.object({
  season_code: z.string().min(1),
  season_name: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  status: z.enum(["upcoming", "active", "completed", "cancelled"]).default("upcoming"),
});


const storageSchema = z.object({
  unit_code: z.string().min(1),
  unit_name: z.string().min(1),
  unit_type: z.enum(["refrigerator", "freezer", "cold_room", "dry_room", "cabinet", "shelf"]),
  room_name: z.string().optional(),
  building: z.string().optional(),
  temperature_min: z.preprocess(toN, z.number().optional()),
  temperature_max: z.preprocess(toN, z.number().optional()),
  humidity_min: z.preprocess(toN, z.number().min(0).max(100).optional()),
  humidity_max: z.preprocess(toN, z.number().min(0).max(100).optional()),
  capacity_racks: z.preprocess(toN, z.number().optional()),
  capacity_boxes_per_rack: z.preprocess(toN, z.number().optional()),
  status: z.string().optional(),
  description: z.string().optional(),
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<TabType>("trials");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<Characteristic | null>(null);
  const [editingGenotype, setEditingGenotype] = useState<Genotype | null>(null);
  const [charIsActive, setCharIsActive] = useState(true);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [envFormKey, setEnvFormKey] = useState(0); // remount form on open
  const [showCharImport, setShowCharImport] = useState(false);
  const [charImportResult, setCharImportResult] = useState<{created:number;updated:number;skipped:number;errors:string[]} | null>(null);
  const [showGenoImport, setShowGenoImport] = useState(false);
  const [genoImportResult, setGenoImportResult] = useState<{created:number;updated:number;skipped:number} | null>(null);
  const [editingTrial, setEditingTrial] = useState<Trial | null>(null);
  const [genoPageSize, setGenoPageSize] = useState<number | "all">("all");
  const [repExpanded, setRepExpanded] = useState<Set<number>>(new Set());
  const [repEditing, setRepEditing] = useState<number | null>(null);
  const [repEditVal, setRepEditVal] = useState(3);
  const charImportRef = useRef<HTMLInputElement>(null);
  const genoImportRef = useRef<HTMLInputElement>(null);
  const [editingEnvCond, setEditingEnvCond] = useState<EnvCondition | null>(null);
  const [envCondName, setEnvCondName] = useState("");
  const [envCondDesc, setEnvCondDesc] = useState("");
  // Jenis Jagung
  const [jenisFilter, setJenisFilter] = useState<string | null>(null);
  const [showJenisRuleModal, setShowJenisRuleModal] = useState(false);
  const [jenisRules, setJenisRules] = useState<JenisJagungRule[]>(() => {
    if (typeof window === "undefined") return DEFAULT_JENIS_RULES;
    return loadJenisRules();
  });
  const [editingRules, setEditingRules] = useState<JenisJagungRule[]>([]);
  // Research Plan Lokasi autocomplete
  const [lokasiSearch, setLokasiSearch] = useState("");
  const [lokasiDropOpen, setLokasiDropOpen] = useState(false);
  // Inline Lokasi creation from within trial form
  const [isLokasiSubModalOpen, setIsLokasiSubModalOpen] = useState(false);
  const [lokasiSubFormKey, setLokasiSubFormKey] = useState(0);
  // Inline Environment condition creation from within trial form
  const [isEnvCondSubModalOpen, setIsEnvCondSubModalOpen] = useState(false);
  const [envCondSubName, setEnvCondSubName] = useState("");
  const [envCondSubDesc, setEnvCondSubDesc] = useState("");
  const qc = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────

  const genoPerPageParam = genoPageSize === "all" ? 2000 : genoPageSize;
  const { data: genotypesRes, isLoading: gLoading } = useQuery({
    queryKey: ["genotypes", "master-data", genoPageSize],
    queryFn: () => api.get<{data:Genotype[]}>(`/v1/genotypes?per_page=${genoPerPageParam}`).then(r => r.data),
    staleTime: 0,
    refetchOnMount: true,
  });
  const genotypes: Genotype[] = genotypesRes?.data ?? [];

  const { data: trialsRes, isLoading: tLoading } = useQuery({ queryKey: ["trials", "master-data"], queryFn: () => api.get<{data:Trial[]}>("/v1/trials?per_page=100").then(r => r.data), staleTime: 0, refetchOnMount: true });
  const trials: Trial[] = trialsRes?.data ?? [];

  const { data: charsRes, isLoading: cLoading } = useQuery({ queryKey: ["characteristics-all", "master-data"], queryFn: () => api.get<Characteristic[]>("/v1/phenotyping/characteristics").then(r => r.data), staleTime: 0, refetchOnMount: true });
  const chars: Characteristic[] = charsRes ?? [];

  const { data: envsRes, isLoading: eLoading } = useQuery({ queryKey: ["environments", "master-data-100"], queryFn: () => api.get<{data:Environment[]}>("/v1/environments?per_page=100").then(r => r.data), staleTime: 0 });
  const envs: Environment[] = envsRes?.data ?? [];

  const { data: seasons, isLoading: sLoading } = useQuery({ queryKey: ["seasons"], queryFn: () => api.get("/v1/seasons?all=false&per_page=50").then(r => r.data as {data:Season[]}) });
  const { data: storageUnits, isLoading: suLoading } = useQuery({ queryKey: ["storage-units-all"], queryFn: () => api.get("/v1/storage/units?per_page=50").then(r => r.data as {data:StorageUnit[]}) });
  const { data: seasonsList } = useQuery({ queryKey: ["seasons-simple"], queryFn: () => api.get("/v1/seasons?all=true").then(r => r.data as {id:number;season_name:string}[]) });
  const { data: locationsList } = useQuery({ queryKey: ["locations-simple"], queryFn: () => api.get("/v1/locations?all=true").then(r => r.data as {id:number;field_name:string}[]) });
  const { data: envCondsData, isLoading: ecLoading } = useQuery({ queryKey: ["environment-conditions"], queryFn: () => api.get<EnvCondition[]>("/v1/environment-conditions").then(r => r.data), staleTime: 0 });
  const envConds: EnvCondition[] = envCondsData ?? [];

  // ── Forms ─────────────────────────────────────────────────────────────────

  const gForm = useForm<z.infer<typeof genotypeSchema>>({ resolver: zodResolver(genotypeSchema) as never, defaultValues: { category: "inbred_line", trial_type: "normal", status: "active" } });
  const tForm = useForm<z.infer<typeof trialSchema>>({ resolver: zodResolver(trialSchema) as never, defaultValues: { layout_design: "RCBD", replications: 3, status: "planned" } });
  const cForm = useForm<z.infer<typeof charSchema>>({ resolver: zodResolver(charSchema) as never, defaultValues: { decimal_places: 2, display_order: 0, is_active: true } });
  const sForm = useForm<z.infer<typeof seasonSchema>>({ resolver: zodResolver(seasonSchema) as never, defaultValues: { status: "upcoming" } });
  const suForm = useForm<z.infer<typeof storageSchema>>({ resolver: zodResolver(storageSchema) as never, defaultValues: { unit_type: "refrigerator" } });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const gCreate = useMutation({ mutationFn: (d: z.infer<typeof genotypeSchema>) => api.post("/v1/genotypes", d), onSuccess: () => { qc.invalidateQueries({queryKey:["genotypes","master-data"]}); toast.success("Genotipe ditambahkan"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const gUpdate = useMutation({ mutationFn: ({id,d}: {id:number; d: Partial<z.infer<typeof genotypeSchema>>}) => api.put(`/v1/genotypes/${id}`, d), onSuccess: () => { qc.invalidateQueries({queryKey:["genotypes","master-data"]}); toast.success("Genotipe diperbarui"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const gBulkDel = useMutation({ mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/v1/genotypes/${id}`))), onSuccess: () => { qc.invalidateQueries({queryKey:["genotypes","master-data"]}); toast.success("Genotipe dihapus"); }, onError: () => toast.error("Sebagian gagal dihapus") });

  const tCreate = useMutation({ mutationFn: (d: z.infer<typeof trialSchema>) => api.post("/v1/trials", d), onSuccess: () => { qc.invalidateQueries({queryKey:["trials"]}); toast.success("Research Plan ditambahkan"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const tBulkDel = useMutation({ mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/v1/trials/${id}`))), onSuccess: () => { qc.invalidateQueries({queryKey:["trials"]}); toast.success("Research Plan dihapus"); }, onError: () => toast.error("Sebagian gagal dihapus") });

  const cCreate = useMutation({ mutationFn: (d: z.infer<typeof charSchema>) => api.post("/v1/phenotyping/characteristics", d), onSuccess: () => { qc.invalidateQueries({queryKey:["characteristics-all"]}); qc.invalidateQueries({queryKey:["characteristics"]}); toast.success("Karakter ditambahkan"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const cUpdate = useMutation({ mutationFn: ({id,d}: {id:number; d: Partial<z.infer<typeof charSchema>>}) => api.put(`/v1/phenotyping/characteristics/${id}`, d), onSuccess: () => { qc.invalidateQueries({queryKey:["characteristics-all"]}); qc.invalidateQueries({queryKey:["characteristics"]}); toast.success("Karakter diperbarui"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const cBulkDel = useMutation({ mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/v1/phenotyping/characteristics/${id}`))), onSuccess: () => { qc.invalidateQueries({queryKey:["characteristics-all"]}); qc.invalidateQueries({queryKey:["characteristics"]}); toast.success("Karakter dihapus"); }, onError: () => toast.error("Sebagian gagal dihapus") });

  const envCreate = useMutation({ mutationFn: (d: EnvironmentFormData) => api.post("/v1/environments", d), onSuccess: () => { qc.invalidateQueries({queryKey:["environments"]}); qc.invalidateQueries({queryKey:["dashboard"]}); toast.success("Lokasi ditambahkan"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const envUpdate = useMutation({ mutationFn: ({id,d}: {id:number; d: EnvironmentFormData}) => api.put(`/v1/environments/${id}`, d), onSuccess: () => { qc.invalidateQueries({queryKey:["environments"]}); qc.invalidateQueries({queryKey:["dashboard"]}); toast.success("Lokasi diperbarui"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const envBulkDel = useMutation({ mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/v1/environments/${id}`))), onSuccess: () => { qc.invalidateQueries({queryKey:["environments"]}); qc.invalidateQueries({queryKey:["dashboard"]}); toast.success("Lokasi dihapus"); }, onError: () => toast.error("Sebagian lokasi gagal dihapus") });

  const tUpdate = useMutation({ mutationFn: ({id,d}: {id:number; d: z.infer<typeof trialSchema>}) => api.put(`/v1/trials/${id}`, d), onSuccess: () => { qc.invalidateQueries({queryKey:["trials"]}); toast.success("Research Plan diperbarui"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });

  const genoImportMutation = useMutation({
    mutationFn: (file: File) => { const fd=new FormData(); fd.append("file",file); return api.post("/v1/genotypes/import-file", fd, {headers:{"Content-Type":"multipart/form-data"}}); },
    onSuccess: res => { qc.invalidateQueries({queryKey:["genotypes"]}); const d=res.data as {created_count?:number;updated_count?:number;skipped_count?:number}; setGenoImportResult({created:d.created_count??0,updated:d.updated_count??0,skipped:d.skipped_count??0}); toast.success(`Import selesai: ${d.created_count??0} dibuat`); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const repUpdate = useMutation({ mutationFn: ({id,replications}: {id:number; replications:number}) => api.put(`/v1/trials/${id}`, {replications}), onSuccess: () => { qc.invalidateQueries({queryKey:["trials"]}); toast.success("Ulangan diperbarui"); setRepEditing(null); }, onError: e => toast.error(getApiErrorMessage(e)) });

  const sCreate = useMutation({ mutationFn: (d: z.infer<typeof seasonSchema>) => api.post("/v1/seasons", d), onSuccess: () => { qc.invalidateQueries({queryKey:["seasons"]}); toast.success("Musim ditambahkan"); closeModal(); sForm.reset(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const sBulkDel = useMutation({ mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/v1/seasons/${id}`))), onSuccess: () => { qc.invalidateQueries({queryKey:["seasons"]}); toast.success("Musim dihapus"); }, onError: () => toast.error("Sebagian gagal dihapus") });


  const suCreate = useMutation({ mutationFn: (d: z.infer<typeof storageSchema>) => api.post("/v1/storage/units", d), onSuccess: () => { qc.invalidateQueries({queryKey:["storage-units-all"]}); toast.success("Unit ditambahkan"); closeModal(); suForm.reset(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const suBulkDel = useMutation({ mutationFn: (ids: number[]) => Promise.all(ids.map(id => api.delete(`/v1/storage/units/${id}`))), onSuccess: () => { qc.invalidateQueries({queryKey:["storage-units-all"]}); toast.success("Unit dihapus"); }, onError: () => toast.error("Sebagian gagal dihapus") });

  const ecCreate = useMutation({ mutationFn: (d: {name:string;description?:string}) => api.post("/v1/environment-conditions", d), onSuccess: () => { qc.invalidateQueries({queryKey:["environment-conditions"]}); toast.success("Environment ditambahkan"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const ecUpdate = useMutation({ mutationFn: ({id,d}: {id:number;d:{name:string;description?:string}}) => api.put(`/v1/environment-conditions/${id}`, d), onSuccess: () => { qc.invalidateQueries({queryKey:["environment-conditions"]}); toast.success("Environment diperbarui"); closeModal(); }, onError: e => toast.error(getApiErrorMessage(e)) });
  const ecDelete = useMutation({ mutationFn: (id: number) => api.delete(`/v1/environment-conditions/${id}`), onSuccess: () => { qc.invalidateQueries({queryKey:["environment-conditions"]}); toast.success("Environment dihapus"); }, onError: e => toast.error(getApiErrorMessage(e)) });

  const inlineEnvCreate = useMutation({
    mutationFn: (d: EnvironmentFormData) => api.post("/v1/environments", d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["environments"] });
      qc.invalidateQueries({ queryKey: ["environments", "master-data-100"] });
      const newEnv = res.data as Environment;
      tForm.setValue("environment_id", newEnv.id);
      setLokasiSearch((newEnv as Environment & {name?:string}).name ?? newEnv.environment_code ?? "");
      setIsLokasiSubModalOpen(false);
      toast.success("Lokasi ditambahkan dan dipilih");
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const inlineEnvCondCreate = useMutation({
    mutationFn: (d: {name:string;description?:string}) => api.post("/v1/environment-conditions", d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["environment-conditions"] });
      const newCond = res.data as EnvCondition;
      tForm.setValue("environment_condition_id", newCond.id);
      setIsEnvCondSubModalOpen(false);
      setEnvCondSubName("");
      setEnvCondSubDesc("");
      toast.success("Environment ditambahkan dan dipilih");
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const charImportMutation = useMutation({
    mutationFn: (file: File) => { const fd = new FormData(); fd.append("file", file); return api.post("/v1/phenotyping/characteristics/import", fd, {headers:{"Content-Type":"multipart/form-data"}}); },
    onSuccess: res => { qc.invalidateQueries({queryKey:["characteristics-all"]}); qc.invalidateQueries({queryKey:["characteristics"]}); setCharImportResult(res.data as typeof charImportResult); toast.success((res.data as {message?:string})?.message ?? "Import selesai"); },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const closeModal = () => { setIsModalOpen(false); setEditingChar(null); setEditingEnv(null); setEditingTrial(null); setEditingEnvCond(null); setEditingGenotype(null); setEnvCondName(""); setEnvCondDesc(""); };

  const openEditGenotype = (g: Genotype) => {
    setEditingGenotype(g);
    gForm.reset({
      genotype_code: g.genotype_code,
      genotype_name: g.genotype_name,
      category: g.category as z.infer<typeof genotypeSchema>["category"],
      trial_type: (g as Genotype & { trial_type?: string }).trial_type as z.infer<typeof genotypeSchema>["trial_type"] ?? "normal",
      status: g.status as z.infer<typeof genotypeSchema>["status"],
    });
    setIsModalOpen(true);
  };

  const openEditEnvCond = (c: EnvCondition) => { setEditingEnvCond(c); setEnvCondName(c.name); setEnvCondDesc(c.description ?? ""); setIsModalOpen(true); };

  const openEditTrial = (t: Trial) => {
    setEditingTrial(t);
    const envId = (t as Trial & { environment_id?: number }).environment_id;
    const matchedEnv = envs.find(e => e.id === envId);
    if (matchedEnv) setLokasiSearch(matchedEnv.name ?? matchedEnv.environment_code ?? "");
    else setLokasiSearch("");
    tForm.reset({
      trial_code: t.trial_code,
      trial_name: t.trial_name,
      environment_id: envId ?? null,
      environment_condition_id: (t as Trial & { environment_condition_id?: number }).environment_condition_id ?? null,
      layout_design: t.layout_design as z.infer<typeof trialSchema>["layout_design"],
      replications: t.replications,
      num_plots: t.num_plots ?? undefined,
      num_samples: t.num_samples ?? undefined,
      status: t.status as z.infer<typeof trialSchema>["status"],
      planting_date: (t as Trial & { planting_date?: string }).planting_date ?? "",
    });
    setIsModalOpen(true);
  };

  const openCharEdit = (c: Characteristic) => {
    setEditingChar(c);
    setCharIsActive(c.is_active);
    cForm.reset({ code: c.code, name: c.name, group: c.group ?? "", unit: c.unit ?? "", method_description: c.method_description ?? "", decimal_places: c.decimal_places, display_order: c.display_order, is_active: c.is_active });
    setIsModalOpen(true);
  };

  const openEnvEdit = (e: Environment) => {
    setEditingEnv(e);
    setEnvFormKey(k => k + 1);
    setIsModalOpen(true);
  };

  // ── Tab config ────────────────────────────────────────────────────────────

  const tabs: {id: TabType; label: string; icon: React.FC<{className?:string}>; count: number}[] = [
    { id: "trials",         label: "Research Plan",    icon: BookOpen,   count: trials.length },
    { id: "genotypes",      label: "Genotipe",        icon: Dna,        count: genotypes.length },
    { id: "characteristics",label: "Pengamatan",       icon: Microscope, count: chars.length },
    { id: "environments",   label: "Lokasi",            icon: MapPin,     count: envs.length },
    { id: "replications",   label: "Ulangan (R)",      icon: Repeat2,    count: trials.length },
    { id: "environment_conditions", label: "Environment", icon: Leaf,   count: envConds.length },
    { id: "storage_units",  label: "Unit Penyimpanan", icon: Package,    count: (storageUnits as {data:StorageUnit[]})?.data?.length ?? 0 },
  ];

  // ── Columns ───────────────────────────────────────────────────────────────

  const gCols: ColumnDef<Genotype, unknown>[] = [
    { header: "Kode", accessorKey: "genotype_code", cell: ({getValue}) => <span className="font-mono font-bold text-green-700">{getValue() as string}</span> },
    { header: "Jenis Jagung", id: "jenis_jagung", cell: ({row}) => {
      const jenis = getJenisJagung(row.original.genotype_code, jenisRules);
      const color = JENIS_COLORS[jenis] ?? "bg-gray-100 text-gray-500";
      return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{jenis}</span>;
    }},
    { header: "Nama", accessorKey: "genotype_name" },
    { header: "Kategori", accessorKey: "category", cell: ({getValue}) => <span className="text-xs capitalize">{(getValue() as string).replace("_"," ")}</span> },
    { header: "Status", accessorKey: "status", cell: ({getValue}) => <StatusBadge status={getValue() as string} /> },
    { header: "Aksi", id: "gAct", cell: ({row}) => (
      <div className="flex gap-1">
        <button onClick={() => openEditGenotype(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Edit2 className="w-3.5 h-3.5"/></button>
        <button onClick={() => { if(confirm(`Hapus genotipe "${row.original.genotype_code}"?`)) gBulkDel.mutate([row.original.id]); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><X className="w-3.5 h-3.5"/></button>
      </div>
    )},
  ];

  const tCols: ColumnDef<Trial, unknown>[] = [
    { header: "Kode", accessorKey: "trial_code", cell: ({getValue}) => <span className="font-mono font-bold text-green-700">{getValue() as string}</span> },
    { header: "Nama Research Plan", accessorKey: "trial_name" },
    { header: "Desain", accessorKey: "layout_design", cell: ({getValue}) => <span className="text-xs">{getValue() as string}</span> },
    { header: "Status", accessorKey: "status", cell: ({getValue}) => <StatusBadge status={getValue() as string} /> },
    { header: "Aksi", id: "tActions", cell: ({row}) => (
      <div className="flex gap-1">
        <button onClick={() => openEditTrial(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Edit2 className="w-3.5 h-3.5"/></button>
        <button onClick={() => { if(confirm(`Hapus Research Plan "${row.original.trial_code}"?`)) tBulkDel.mutate([row.original.id]); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><X className="w-3.5 h-3.5"/></button>
      </div>
    )},
  ];

  const cCols: ColumnDef<Characteristic, unknown>[] = [
    { header: "Kode", accessorKey: "code", cell: ({getValue}) => <span className="font-mono font-bold text-green-700">{getValue() as string}</span> },
    { header: "Karakter", accessorKey: "name" },
    { header: "Kelompok", accessorKey: "group", cell: ({getValue}) => getValue() ? <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">{getValue() as string}</span> : <span className="text-gray-300">—</span> },
    { header: "Satuan", accessorKey: "unit", cell: ({getValue}) => <span className="text-xs text-gray-500">{(getValue() as string) || "—"}</span> },
    { header: "Status", accessorKey: "is_active", cell: ({getValue}) => <StatusBadge status={getValue() ? "active" : "inactive"} /> },
    { header: "Aksi", id: "cActions", cell: ({row}) => (
      <div className="flex gap-1">
        <button onClick={() => openCharEdit(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Edit2 className="w-3.5 h-3.5"/></button>
        <button onClick={() => { if(confirm(`Hapus karakter "${row.original.code}"?`)) cBulkDel.mutate([row.original.id]); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><X className="w-3.5 h-3.5"/></button>
      </div>
    )},
  ];

  const envCols: ColumnDef<Environment, unknown>[] = [
    { header: "Nama Kebun Percobaan", id: "envName", cell: ({row}) => <span className="font-medium text-gray-800">{row.original.name ?? row.original.environment_code}</span> },
    { header: "Kode", accessorKey: "environment_code", cell: ({getValue}) => <span className="font-mono text-xs text-green-700">{getValue() as string}</span> },
    {
      header: "Musim",
      id: "musim",
      cell: ({row}) => {
        const env = row.original as Environment & { season_name?: string };
        const val = env.season_name || row.original.season?.season_name;
        return <span className="text-xs">{val ?? "—"}</span>;
      },
    },
    { header: "Environment", id: "perlakuan", cell: ({row}) => <span className="text-xs text-gray-500">{(row.original as Environment & {perlakuan?:string}).perlakuan ?? "—"}</span> },
    { header: "Elevasi", accessorKey: "elevation_m", cell: ({getValue}) => <span className="text-xs text-gray-500">{getValue() ? `${getValue()} m` : "—"}</span> },
    { header: "Suhu", accessorKey: "avg_temperature_c", cell: ({getValue}) => <span className="text-xs text-gray-500">{getValue() ? `${getValue()}°C` : "—"}</span> },
    { header: "Aksi", id: "eActions", cell: ({row}) => (
      <div className="flex gap-1">
        <button onClick={() => openEnvEdit(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Edit2 className="w-3.5 h-3.5"/></button>
        <button onClick={() => { if(confirm(`Hapus lokasi "${row.original.environment_code}"?`)) envBulkDel.mutate([row.original.id]); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><X className="w-3.5 h-3.5"/></button>
      </div>
    )},
  ];

  const sCols: ColumnDef<Season, unknown>[] = [
    { header: "Kode", accessorKey: "season_code", cell: ({getValue}) => <span className="font-mono font-semibold text-green-700">{getValue() as string}</span> },
    { header: "Nama Musim", accessorKey: "season_name" },
    { header: "Mulai", accessorKey: "start_date", cell: ({getValue}) => <span className="text-xs">{formatDate(getValue() as string)}</span> },
    { header: "Akhir", accessorKey: "end_date", cell: ({getValue}) => <span className="text-xs">{formatDate(getValue() as string)}</span> },
    { header: "Status", accessorKey: "status", cell: ({getValue}) => <StatusBadge status={getValue() as string} /> },
  ];


  const suCols: ColumnDef<StorageUnit, unknown>[] = [
    { header: "Kode", accessorKey: "unit_code", cell: ({getValue}) => <span className="font-mono font-semibold text-blue-700">{getValue() as string}</span> },
    { header: "Nama Unit", accessorKey: "unit_name" },
    { header: "Tipe", accessorKey: "unit_type" },
    { header: "Suhu (°C)", id: "temp", cell: ({row}) => <span className="text-xs">{row.original.temperature_min} – {row.original.temperature_max}</span> },
    { header: "Status", accessorKey: "is_active", cell: ({getValue}) => <StatusBadge status={getValue() ? "active" : "inactive"} /> },
    { header: "Aksi", id: "suAct", cell: ({row}) => <button onClick={() => { if(confirm(`Hapus unit "${row.original.unit_name}"?`)) suBulkDel.mutate([row.original.id]); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><X className="w-3.5 h-3.5"/></button> },
  ];

  const tabsShowingModal: TabType[] = ["genotypes","trials","characteristics","environments","environment_conditions","storage_units"];
  const modalLabel: Record<TabType, string> = {
    genotypes: editingGenotype ? "Edit Genotipe" : "Genotipe", trials: "Research Plan", characteristics: editingChar ? "Edit Karakter" : "Karakter",
    environments: editingEnv ? "Edit Lokasi" : "Lokasi", replications: "Ulangan",
    environment_conditions: editingEnvCond ? "Edit Environment" : "Environment",
    storage_units: "Unit Penyimpanan",
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Master Data"
        description="Kelola semua data referensi sistem penelitian"
        actions={
          tabsShowingModal.includes(activeTab) ? (
            <div className="flex gap-2">
              {activeTab === "genotypes" && (
                <button onClick={() => setShowGenoImport(v => !v)}
                  className="flex items-center gap-2 px-3 py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition">
                  <Upload className="w-4 h-4" /> Import Excel
                </button>
              )}
              {activeTab === "characteristics" && (
                <button onClick={() => setShowCharImport(v => !v)}
                  className="flex items-center gap-2 px-3 py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition">
                  <Upload className="w-4 h-4" /> Import
                </button>
              )}
              <button onClick={() => { setEditingChar(null); setEditingEnv(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </div>
          ) : null
        }
      />

      {/* Pengamatan inline import */}
      {activeTab === "characteristics" && showCharImport && (
        <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-800 text-sm">Import Master Pengamatan dari Excel</p>
            <button onClick={() => setShowCharImport(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={`${API_BASE}/v1/phenotyping/characteristics/import/template`} download
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition">
              <Download className="w-4 h-4" /> Download Template
            </a>
            <button onClick={() => charImportRef.current?.click()} disabled={charImportMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              <Upload className="w-4 h-4" /> {charImportMutation.isPending ? "Mengimpor..." : "Upload & Import"}
            </button>
            <input ref={charImportRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f=e.target.files?.[0]; if(f) charImportMutation.mutate(f); e.target.value=""; }} />
          </div>
          {charImportResult && (
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-green-50 rounded-lg p-2"><p className="text-lg font-bold text-green-700">{charImportResult.created}</p><p className="text-xs text-gray-500">Dibuat</p></div>
              <div className="bg-blue-50 rounded-lg p-2"><p className="text-lg font-bold text-blue-700">{charImportResult.updated}</p><p className="text-xs text-gray-500">Diperbarui</p></div>
              <div className="bg-gray-100 rounded-lg p-2"><p className="text-lg font-bold text-gray-600">{charImportResult.skipped}</p><p className="text-xs text-gray-500">Dilewati</p></div>
            </div>
          )}
          <p className="text-xs text-gray-400">Kolom: Kelompok Pengamatan · Karakter · Kode · Satuan · Metode Pengamatan · Desimal · Urutan. Kode sudah ada → update. Sel kosong → tidak mengubah nilai yang sudah ada.</p>
        </div>
      )}

      {/* Genotipe import panel */}
      {activeTab === "genotypes" && showGenoImport && (
        <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-800 text-sm">Import Genotipe dari Excel</p>
            <button onClick={() => setShowGenoImport(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={`${API_BASE}/v1/genotypes/import-template`} download
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition">
              <Download className="w-4 h-4" /> Download Template
            </a>
            <button onClick={() => genoImportRef.current?.click()} disabled={genoImportMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              <Upload className="w-4 h-4" /> {genoImportMutation.isPending ? "Mengimpor..." : "Upload & Import"}
            </button>
            <input ref={genoImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f=e.target.files?.[0]; if(f) genoImportMutation.mutate(f); e.target.value=""; }} />
          </div>
          {genoImportResult && (
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-green-50 rounded-lg p-2"><p className="text-lg font-bold text-green-700">{genoImportResult.created}</p><p className="text-xs text-gray-500">Dibuat</p></div>
              <div className="bg-blue-50 rounded-lg p-2"><p className="text-lg font-bold text-blue-700">{genoImportResult.updated}</p><p className="text-xs text-gray-500">Diperbarui</p></div>
              <div className="bg-gray-100 rounded-lg p-2"><p className="text-lg font-bold text-gray-600">{genoImportResult.skipped}</p><p className="text-xs text-gray-500">Dilewati</p></div>
            </div>
          )}
          <p className="text-xs text-gray-400">Kolom template: genotype_code · genotype_name · category. Status default: aktif. Tipe trial default: normal.</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition whitespace-nowrap",
                activeTab === tab.id ? "text-green-700 border-b-2 border-green-600 bg-green-50/50" : "text-gray-500 hover:text-gray-700")}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── Genotipe ── */}
          {activeTab === "genotypes" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Jenis Jagung filter — dropdown + chips */}
                {(() => {
                  const allJenis = genotypes.map(g => getJenisJagung(g.genotype_code, jenisRules));
                  const counts: Record<string, number> = {};
                  allJenis.forEach(j => { counts[j] = (counts[j] ?? 0) + 1; });
                  const labels = [...new Set(allJenis)].sort();
                  return (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      {/* Dropdown filter */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400 whitespace-nowrap">Jenis Jagung:</label>
                        <select
                          value={jenisFilter ?? ""}
                          onChange={e => setJenisFilter(e.target.value || null)}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        >
                          <option value="">Semua ({genotypes.length})</option>
                          {labels.map(label => (
                            <option key={label} value={label}>{label} ({counts[label] ?? 0})</option>
                          ))}
                        </select>
                      </div>
                      {/* Color chips for quick filter */}
                      <div className="flex flex-wrap items-center gap-1">
                        {labels.map(label => {
                          const color = JENIS_COLORS[label] ?? "bg-gray-100 text-gray-500";
                          const active = jenisFilter === label;
                          return (
                            <button key={label}
                              onClick={() => setJenisFilter(active ? null : label)}
                              className={cn("text-xs px-2 py-0.5 rounded-full transition font-medium", active ? color + " ring-2 ring-offset-1 ring-gray-400" : color + " opacity-60 hover:opacity-100")}
                            >
                              {label.replace("Hibrida ", "H. ")}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => { setEditingRules([...jenisRules]); setShowJenisRuleModal(true); }}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition"
                        title="Atur logika klasifikasi"
                      >
                        <Settings2 className="w-3 h-3" /> Atur Logika
                      </button>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Tampilkan:</label>
                  <select value={String(genoPageSize)} onChange={e => setGenoPageSize(e.target.value === "all" ? "all" : Number(e.target.value))}
                    className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500">
                    <option value="all">Semua ({genotypes.length})</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                </div>
              </div>
              {(() => {
                const filtered = jenisFilter
                  ? genotypes.filter(g => getJenisJagung(g.genotype_code, jenisRules) === jenisFilter)
                  : genotypes;
                return (
                  <DataTable data={filtered} columns={gCols} isLoading={gLoading} searchPlaceholder="Cari kode atau nama genotipe..." emptyMessage="Belum ada genotipe" getRowId={r => String(r.id)} onBulkDelete={rows => gBulkDel.mutate(rows.map(r => r.id))} isBulkDeleting={gBulkDel.isPending} pageSize={genoPageSize === "all" ? 9999 : genoPageSize} />
                );
              })()}
            </div>
          )}

          {/* ── Trial ── */}
          {activeTab === "trials" && <DataTable data={trials} columns={tCols} isLoading={tLoading} searchPlaceholder="Cari kode atau nama research plan..." emptyMessage="Belum ada research plan" getRowId={r => String(r.id)} onBulkDelete={rows => tBulkDel.mutate(rows.map(r => r.id))} isBulkDeleting={tBulkDel.isPending} />}

          {/* ── Pengamatan / Karakteristik ── */}
          {activeTab === "characteristics" && <DataTable data={chars} columns={cCols} isLoading={cLoading} searchPlaceholder="Cari kode atau nama karakter..." emptyMessage="Belum ada karakter" getRowId={r => String(r.id)} onBulkDelete={rows => cBulkDel.mutate(rows.map(r => r.id))} isBulkDeleting={cBulkDel.isPending} />}

          {/* ── Lokasi ── */}
          {activeTab === "environments" && <DataTable data={envs} columns={envCols} isLoading={eLoading} searchPlaceholder="Cari environment..." emptyMessage="Belum ada environment" getRowId={r => String(r.id)} onBulkDelete={rows => envBulkDel.mutate(rows.map(r => r.id))} isBulkDeleting={envBulkDel.isPending} />}

          {/* ── Ulangan ── */}
          {activeTab === "replications" && (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              {tLoading ? <div className="p-8 text-center text-gray-400 animate-pulse text-sm">Memuat...</div> :
              trials.length === 0 ? <div className="p-12 text-center text-gray-400 text-sm">Belum ada trial</div> :
              trials.map(trial => {
                const isExp = repExpanded.has(trial.id);
                const reps = trial.replications ?? 3;
                return (
                  <div key={trial.id}>
                    <div className={cn("flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50", repEditing === trial.id && "bg-green-50/30")}>
                      <button onClick={() => setRepExpanded(p => { const n=new Set(p); n.has(trial.id)?n.delete(trial.id):n.add(trial.id); return n; })} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        {isExp ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{trial.trial_name}</p>
                        <p className="text-xs text-gray-400 font-mono">{trial.trial_code}</p>
                      </div>
                      {repEditing === trial.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" min={1} max={20} value={repEditVal} onChange={e => setRepEditVal(Number(e.target.value))} className="w-16 px-2 py-1 border border-green-300 rounded text-sm text-center focus:outline-none" autoFocus />
                          <button onClick={() => repUpdate.mutate({id:trial.id, replications:repEditVal})} disabled={repUpdate.isPending} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50">Simpan</button>
                          <button onClick={() => setRepEditing(null)} className="text-xs text-gray-400 hover:text-gray-600">Batal</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex gap-1">{Array.from({length:reps},(_,i) => <span key={i} className="w-7 h-7 rounded-full bg-green-50 text-green-700 text-xs font-semibold flex items-center justify-center">R{i+1}</span>)}</div>
                          <span className="text-xs text-gray-400">{reps} ulangan</span>
                          <button onClick={() => { setRepEditing(trial.id); setRepEditVal(reps); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-400"><Edit2 className="w-3.5 h-3.5"/></button>
                        </div>
                      )}
                    </div>
                    {isExp && (
                      <div className="px-12 pb-3 bg-gray-50/30 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Array.from({length:reps},(_,i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">R{i+1}</span>
                            <span className="text-xs text-gray-600">Ulangan {i+1}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Unit Penyimpanan ── */}
          {activeTab === "environment_conditions" && (
            <DataTable
              data={envConds}
              columns={[
                { header: "Nama", accessorKey: "name", cell: ({getValue}) => <span className="font-semibold text-gray-800">{getValue() as string}</span> },
                { header: "Deskripsi", accessorKey: "description", cell: ({getValue}) => <span className="text-xs text-gray-500">{(getValue() as string) || "—"}</span> },
                { header: "Status", accessorKey: "is_active", cell: ({getValue}) => <StatusBadge status={getValue() ? "active" : "inactive"} /> },
                { header: "Aksi", id: "ecAct", cell: ({row}) => (
                  <div className="flex gap-1">
                    <button onClick={() => openEditEnvCond(row.original)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={() => { if(confirm(`Hapus "${row.original.name}"?`)) ecDelete.mutate(row.original.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><X className="w-3.5 h-3.5"/></button>
                  </div>
                )},
              ]}
              isLoading={ecLoading}
              searchPlaceholder="Cari environment..."
              emptyMessage="Belum ada environment. Klik Tambah untuk menambahkan (contoh: Normal, Shading, Drought)."
              getRowId={r => String(r.id)}
            />
          )}

          {activeTab === "storage_units" && <DataTable data={(storageUnits as {data:StorageUnit[]})?.data ?? []} columns={suCols} isLoading={suLoading} searchPlaceholder="Cari unit penyimpanan..." emptyMessage="Belum ada unit" getRowId={r => String(r.id)} onBulkDelete={rows => suBulkDel.mutate(rows.map(r => r.id))} isBulkDeleting={suBulkDel.isPending} />}
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto ${activeTab === "environments" ? "max-w-xl" : "max-w-lg"}`}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{(activeTab === "environments" || activeTab === "trials") ? modalLabel[activeTab] : `Tambah ${modalLabel[activeTab]}`}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6">

              {/* Genotipe */}
              {activeTab === "genotypes" && (
                <form onSubmit={gForm.handleSubmit(d => editingGenotype ? gUpdate.mutate({id:editingGenotype.id, d}) : gCreate.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Kode Genotipe *</label><input {...gForm.register("genotype_code")} disabled={!!editingGenotype} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select {...gForm.register("status")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">{[["active","Aktif"],["inactive","Nonaktif"],["archived","Arsip"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Genotipe *</label><input {...gForm.register("genotype_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label><select {...gForm.register("category")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">{[["inbred_line","Galur Murni"],["hybrid","Hibrida"],["variety","Varietas"],["population","Populasi"],["germplasm","Plasma Nutfah"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipe Trial</label><select {...gForm.register("trial_type")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">{[["normal","Normal"],["drought","Kekeringan"],["shade","Naungan"],["feed","Pakan"],["sweet_corn","Jagung Manis"],["multi","Multi"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  </div>
                  <div className="flex gap-3 pt-2 border-t"><button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button><button type="submit" disabled={gCreate.isPending||gUpdate.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">{editingGenotype ? "Simpan Perubahan" : "Tambah Genotipe"}</button></div>
                </form>
              )}

              {/* Trial */}
              {activeTab === "trials" && (
                <form onSubmit={tForm.handleSubmit(d => editingTrial ? tUpdate.mutate({id:editingTrial.id, d}) : tCreate.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Kode *</label><input {...tForm.register("trial_code")} disabled={!!editingTrial} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50" placeholder="RP-2026-001" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select {...tForm.register("status")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">{[["planned","Direncanakan"],["active","Aktif"],["harvested","Dipanen"],["completed","Selesai"],["cancelled","Dibatalkan"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Research Plan *</label><input {...tForm.register("trial_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">Lokasi <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
                        <button type="button"
                          onClick={() => { setLokasiSubFormKey(k => k + 1); setIsLokasiSubModalOpen(true); }}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition">
                          <Plus className="w-3 h-3" /> Tambah Lokasi
                        </button>
                      </div>
                      <input
                        value={lokasiSearch}
                        onChange={e => { setLokasiSearch(e.target.value); setLokasiDropOpen(true); tForm.setValue("environment_id", null); }}
                        onFocus={() => setLokasiDropOpen(true)}
                        onBlur={() => setTimeout(() => setLokasiDropOpen(false), 150)}
                        placeholder="Ketik untuk mencari lokasi..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        autoComplete="off"
                      />
                      {lokasiDropOpen && (
                        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                          {envs.filter(e => !lokasiSearch || (e.name ?? e.environment_code ?? "").toLowerCase().includes(lokasiSearch.toLowerCase())).length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-400">Tidak ada lokasi ditemukan</div>
                          ) : envs.filter(e => !lokasiSearch || (e.name ?? e.environment_code ?? "").toLowerCase().includes(lokasiSearch.toLowerCase())).map(e => (
                            <button key={e.id} type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 hover:text-green-700 transition"
                              onMouseDown={() => { tForm.setValue("environment_id", e.id); setLokasiSearch(e.name ?? e.environment_code ?? ""); setLokasiDropOpen(false); }}>
                              <span className="font-medium">{e.name ?? e.environment_code}</span>
                              {e.environment_code && e.name && <span className="text-xs text-gray-400 ml-1">({e.environment_code})</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      <input type="hidden" {...tForm.register("environment_id")} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Penanaman</label>
                      <input type="date" {...tForm.register("planting_date")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                  {/* Environment (treatment condition) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Environment <span className="text-gray-400 font-normal text-xs">(kondisi perlakuan — opsional)</span>
                      </label>
                      <button type="button" onClick={() => setIsEnvCondSubModalOpen(true)}
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 px-2 py-0.5 rounded hover:bg-green-50 transition">
                        <Plus className="w-3 h-3" /> Tambah Env
                      </button>
                    </div>
                    <select {...tForm.register("environment_condition_id")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="">-- Pilih Environment --</option>
                      {envConds.filter(c => c.is_active).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Desain</label><select {...tForm.register("layout_design")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">{[["RCBD","RCBD"],["CRD","CRD"],["split_plot","Split Plot"],["factorial","Faktorial"],["augmented","Augmented"],["alpha_lattice","Alpha Lattice"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Ulangan</label><input type="number" min="1" max="20" {...tForm.register("replications")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Plot</label>
                    <input type="number" min="1" max="10000" {...tForm.register("num_plots")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. 60" />
                    <p className="text-xs text-gray-400 mt-1">Isi untuk mode entri plot langsung di Data Pengamatan. Kosongkan jika menggunakan matriks genotipe.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Sample</label>
                    <input type="number" min="1" max="100" {...tForm.register("num_samples")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="mis. 3" />
                    <p className="text-xs text-gray-400 mt-1">Isi jika setiap karakteristik diukur N kali per plot (S1, S2, …SN). Kosongkan jika hanya 1 pengukuran.</p>
                  </div>
                  <div className="flex gap-3 pt-2 border-t"><button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button><button type="submit" disabled={tCreate.isPending||tUpdate.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">{editingTrial ? "Simpan Perubahan" : "Buat Research Plan"}</button></div>
                </form>
              )}

              {/* Pengamatan / Karakter */}
              {activeTab === "characteristics" && (
                <form onSubmit={cForm.handleSubmit(d => editingChar ? cUpdate.mutate({id:editingChar.id, d}) : cCreate.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Kode *</label><input {...cForm.register("code")} disabled={!!editingChar} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 uppercase disabled:bg-gray-50" placeholder="TT" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Kelompok</label><input {...cForm.register("group")} list="grp-list" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Vegetatif" /><datalist id="grp-list">{["Vegetatif","Komponen Hasil","Morfologi","Fisiologi","Kualitas"].map(g => <option key={g} value={g}/>)}</datalist></div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Karakter *</label><input {...cForm.register("name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Tinggi Tanaman" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Metode Pengamatan</label><textarea {...cForm.register("method_description")} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label><input {...cForm.register("unit")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="cm" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Desimal</label><input type="number" min="0" max="6" {...cForm.register("decimal_places")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label><input type="number" min="0" {...cForm.register("display_order")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                  </div>
                  <button type="button" onClick={() => { setCharIsActive(v => !v); cForm.setValue("is_active", !charIsActive); }} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition", charIsActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-500")}>{charIsActive ? <ToggleRight className="w-4 h-4"/> : <ToggleLeft className="w-4 h-4"/>}{charIsActive ? "Aktif" : "Nonaktif"}</button>
                  <div className="flex gap-3 pt-2 border-t"><button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button><button type="submit" disabled={cCreate.isPending||cUpdate.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">{editingChar?"Simpan Perubahan":"Tambah Karakter"}</button></div>
                </form>
              )}

              {/* Lokasi — uses Google Maps form */}
              {activeTab === "environments" && (
                <EnvironmentForm
                  key={envFormKey}
                  seasons={seasonsList ?? []}
                  editMode={!!editingEnv}
                  defaultValues={editingEnv ? {
                    environment_code: editingEnv.environment_code ?? "",
                    name: editingEnv.name ?? "",
                    address: editingEnv.address ?? "",
                    latitude: editingEnv.latitude,
                    longitude: editingEnv.longitude,
                    season_name: (editingEnv as Environment & {season_name?:string}).season_name ?? "",
                    elevation_m: editingEnv.elevation_m,
                    avg_temperature_c: editingEnv.avg_temperature_c,
                    total_rainfall_mm: editingEnv.total_rainfall_mm,
                    luas_ha: editingEnv.luas_ha,
                  } : undefined}
                  onSubmit={d => editingEnv ? envUpdate.mutate({id:editingEnv.id, d}) : envCreate.mutate(d)}
                  onCancel={closeModal}
                  isSubmitting={envCreate.isPending || envUpdate.isPending}
                />
              )}


              {/* Environment */}
              {activeTab === "environment_conditions" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Environment *</label>
                    <input value={envCondName} onChange={e => setEnvCondName(e.target.value)}
                      placeholder="contoh: Normal, Shading, Drought, Flooding"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      list="env-cond-suggestions" />
                    <datalist id="env-cond-suggestions">
                      {["Normal","Shading","Drought","Flooding","Salt Stress","Heat Stress","Cold Stress"].map(n => <option key={n} value={n}/>)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
                    <textarea value={envCondDesc} onChange={e => setEnvCondDesc(e.target.value)} rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      placeholder="Kondisi perlakuan..." />
                  </div>
                  <div className="flex gap-3 pt-2 border-t">
                    <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button>
                    <button type="button" disabled={ecCreate.isPending||ecUpdate.isPending}
                      onClick={() => {
                        if (!envCondName.trim()) { toast.error("Nama wajib diisi"); return; }
                        if (editingEnvCond) ecUpdate.mutate({id:editingEnvCond.id, d:{name:envCondName.trim(),description:envCondDesc||undefined}});
                        else ecCreate.mutate({name:envCondName.trim(),description:envCondDesc||undefined});
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">
                      {editingEnvCond ? "Simpan Perubahan" : "Tambah Environment"}
                    </button>
                  </div>
                </div>
              )}

              {/* Unit Penyimpanan */}
              {activeTab === "storage_units" && (
                <form onSubmit={suForm.handleSubmit(d => suCreate.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Kode *</label><input {...suForm.register("unit_code")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="RF003" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipe *</label><select {...suForm.register("unit_type")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">{[["refrigerator","Refrigerator"],["freezer","Freezer"],["cold_room","Cold Room"],["dry_room","Ruang Kering"],["cabinet","Kabinet"],["shelf","Rak"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Unit *</label><input {...suForm.register("unit_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Ruangan</label><input {...suForm.register("room_name")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Lab Benih" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Gedung</label><input {...suForm.register("building")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Gedung A" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Suhu Min (°C)</label><input type="number" step="0.1" {...suForm.register("temperature_min")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Suhu Max (°C)</label><input type="number" step="0.1" {...suForm.register("temperature_max")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Humid Min (%)</label><input type="number" min="0" max="100" {...suForm.register("humidity_min")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Humid Max (%)</label><input type="number" min="0" max="100" {...suForm.register("humidity_max")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Kapasitas Rak <span className="text-gray-400 font-normal">(opsional)</span></label><input type="number" min="0" {...suForm.register("capacity_racks")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Kotak/Rak <span className="text-gray-400 font-normal">(opsional)</span></label><input type="number" min="0" {...suForm.register("capacity_boxes_per_rack")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <input {...suForm.register("status")} list="su-status-list" defaultValue="active" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <datalist id="su-status-list">{["active","maintenance","inactive","decommissioned","planned"].map(s => <option key={s} value={s} />)}</datalist>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label><textarea {...suForm.register("description")} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" /></div>
                  <div className="flex gap-3 pt-2 border-t"><button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button><button type="submit" disabled={suCreate.isPending} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">{suCreate.isPending?"Menyimpan...":"Tambah Unit"}</button></div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Stacked Lokasi sub-modal — opens on top of trial modal */}
      {isLokasiSubModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Tambah Lokasi Baru</h3>
              <button onClick={() => setIsLokasiSubModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6">
              <EnvironmentForm
                key={lokasiSubFormKey}
                seasons={seasonsList ?? []}
                editMode={false}
                onSubmit={d => inlineEnvCreate.mutate(d)}
                onCancel={() => setIsLokasiSubModalOpen(false)}
                isSubmitting={inlineEnvCreate.isPending}
              />
            </div>
          </div>
        </div>
      )}

      {/* Jenis Jagung Rule Editor Modal */}
      {showJenisRuleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Atur Logika Jenis Jagung</h3>
              <button onClick={() => setShowJenisRuleModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-400">Klasifikasi berdasarkan 5 digit pertama kode genotipe. Logika diurutkan dari nilai terbesar — jika angka {">"} threshold, label tersebut yang digunakan.</p>
              <div className="space-y-2">
                {editingRules.sort((a,b) => a.threshold - b.threshold).map((rule, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-4">{i+1}.</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{">"}
                    </span>
                    <input
                      type="number"
                      value={rule.threshold}
                      onChange={e => setEditingRules(p => p.map((r,idx) => idx===i ? {...r, threshold: Number(e.target.value)} : r))}
                      className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <span className="text-xs text-gray-400">→</span>
                    <input
                      type="text"
                      value={rule.label}
                      onChange={e => setEditingRules(p => p.map((r,idx) => idx===i ? {...r, label: e.target.value} : r))}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Label kategori"
                    />
                    <button
                      onClick={() => setEditingRules(p => p.filter((_,idx) => idx !== i))}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEditingRules(p => [...p, { threshold: 50000, label: "Kategori Baru" }])}
                className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 px-3 py-1.5 border border-dashed border-green-300 rounded-lg hover:bg-green-50 transition"
              >
                <Plus className="w-3 h-3" /> Tambah Aturan
              </button>
              <div className="flex gap-3 pt-2 border-t">
                <button onClick={() => { setEditingRules([...DEFAULT_JENIS_RULES]); }} className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Reset Default</button>
                <button onClick={() => setShowJenisRuleModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button>
                <button
                  onClick={() => {
                    const valid = editingRules.filter(r => r.label.trim());
                    setJenisRules(valid);
                    localStorage.setItem(JENIS_LS_KEY, JSON.stringify(valid));
                    setShowJenisRuleModal(false);
                    toast.success("Logika klasifikasi disimpan");
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stacked Environment Condition sub-modal — opens on top of trial modal */}
      {isEnvCondSubModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Tambah Environment Baru</h3>
              <button onClick={() => setIsEnvCondSubModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Environment *</label>
                <input value={envCondSubName} onChange={e => setEnvCondSubName(e.target.value)}
                  placeholder="contoh: Normal, Shading, Drought, Flooding"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  list="env-cond-sub-suggestions" autoFocus />
                <datalist id="env-cond-sub-suggestions">
                  {["Normal","Shading","Drought","Flooding","Saline","Heat Stress"].map(s => <option key={s} value={s}/>)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
                <textarea value={envCondSubDesc} onChange={e => setEnvCondSubDesc(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Kondisi perlakuan..." />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsEnvCondSubModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Batal</button>
                <button type="button" disabled={inlineEnvCondCreate.isPending}
                  onClick={() => {
                    if (!envCondSubName.trim()) { toast.error("Nama wajib diisi"); return; }
                    inlineEnvCondCreate.mutate({name: envCondSubName.trim(), description: envCondSubDesc || undefined});
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium">
                  {inlineEnvCondCreate.isPending ? "Menyimpan..." : "Tambah & Pilih"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
