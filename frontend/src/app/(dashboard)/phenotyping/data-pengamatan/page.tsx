"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Sheet } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api, { getApiErrorMessage } from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { ObservationGrid } from "@/components/phenotyping/ObservationGrid";
import { phenotypingService } from "@/services/phenotyping.service";
import { genotypeService } from "@/services/genotype.service";
import type { Characteristic, Environment, Genotype, ObservationRecord } from "@/types";

const schema = z.object({
  plot_no: z.string().min(1, "No Plot wajib diisi").max(20),
  genotype_id: z.coerce.number({ message: "Genotipe wajib dipilih" }).int().positive(),
  environment_id: z.coerce.number({ message: "Environment wajib dipilih" }).int().positive(),
  replication: z.coerce.number().int().min(1, "Replikasi minimal 1"),
});

type FormData = z.infer<typeof schema>;

export default function DataPengamatanPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [environmentFilter, setEnvironmentFilter] = useState<string>("");
  const queryClient = useQueryClient();

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

  const { data: environmentsData } = useQuery({
    queryKey: ["environments"],
    queryFn: () => api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 100 } }).then((r) => r.data.data),
  });
  const environments = environmentsData ?? [];

  const { data: recordsData, isLoading } = useQuery({
    queryKey: ["observation-records", environmentFilter],
    queryFn: () =>
      phenotypingService
        .getRecords({ per_page: 200, ...(environmentFilter ? { environment_id: environmentFilter } : {}) })
        .then((r) => r.data),
  });
  const records: ObservationRecord[] = recordsData?.data ?? [];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
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
      phenotypingService.updateRecord(record.id, {
        values: [{ characteristic_id: characteristic.id, value }],
      }),
    onMutate: async ({ record, characteristic, value }) => {
      await queryClient.cancelQueries({ queryKey: ["observation-records", environmentFilter] });
      const previous = queryClient.getQueryData<{ data: ObservationRecord[] }>(["observation-records", environmentFilter]);

      queryClient.setQueryData<{ data: ObservationRecord[] } | undefined>(["observation-records", environmentFilter], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((r) =>
            r.id === record.id ? { ...r, values: { ...r.values, [characteristic.code]: value } } : r
          ),
        };
      });

      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["observation-records", environmentFilter], context.previous);
      toast.error(getApiErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["observation-records"] });
    },
  });

  const onSubmit = (data: FormData) => createMutation.mutate(data);

  return (
    <div className="space-y-6 max-w-full mx-auto">
      <PageHeader
        title="Data Pengamatan"
        description="Entri data pengamatan fenotipe per plot/replikasi, mengikuti format spreadsheet lapangan"
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-4 h-4" />
            Tambah Baris
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <label className="text-sm text-gray-600">Environment:</label>
        <select
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
        >
          <option value="">Semua Environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.environment_code}
            </option>
          ))}
        </select>
      </div>

      {characteristics.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <Sheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada karakteristik aktif. Tambahkan karakteristik di Master Data terlebih dahulu.</p>
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
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No Plot</label>
                <input
                  {...register("plot_no")}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="contoh: 1, A1, dst"
                />
                {errors.plot_no && <p className="text-xs text-red-500 mt-1">{errors.plot_no.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genotipe</label>
                <select
                  {...register("genotype_id")}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  defaultValue=""
                >
                  <option value="" disabled>Pilih genotipe</option>
                  {genotypes.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.genotype_code} — {g.genotype_name}
                    </option>
                  ))}
                </select>
                {errors.genotype_id && <p className="text-xs text-red-500 mt-1">{errors.genotype_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                <select
                  {...register("environment_id")}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  defaultValue=""
                >
                  <option value="" disabled>Pilih environment</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.environment_code}
                    </option>
                  ))}
                </select>
                {errors.environment_id && <p className="text-xs text-red-500 mt-1">{errors.environment_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Replikasi (R)</label>
                <input
                  type="number"
                  min={1}
                  {...register("replication")}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {errors.replication && <p className="text-xs text-red-500 mt-1">{errors.replication.message}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
