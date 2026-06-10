"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import api from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { phenotypingService } from "@/services/phenotyping.service";
import { cn } from "@/lib/utils";
import type { AggregatedRow, Characteristic, Environment } from "@/types";

export default function DataRataRataPage() {
  const [environmentFilter, setEnvironmentFilter] = useState<string>("");

  const { data: characteristicsData } = useQuery({
    queryKey: ["characteristics"],
    queryFn: () => phenotypingService.getCharacteristics({ active_only: true }).then((r) => r.data),
  });
  const characteristics: Characteristic[] = characteristicsData ?? [];

  const { data: environmentsData } = useQuery({
    queryKey: ["environments"],
    queryFn: () => api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 100 } }).then((r) => r.data.data),
  });
  const environments = environmentsData ?? [];

  const { data: aggregateData, isLoading } = useQuery({
    queryKey: ["phenotyping-aggregate", environmentFilter],
    queryFn: () =>
      phenotypingService
        .getAggregate(environmentFilter ? { environment_id: environmentFilter } : {})
        .then((r) => r.data.data),
  });
  const rows = useMemo<AggregatedRow[]>(() => aggregateData ?? [], [aggregateData]);

  const replications = useMemo(() => {
    const reps = new Set<string>();
    rows.forEach((row) =>
      Object.values(row.characteristics).forEach((c) => Object.keys(c.values).forEach((r) => reps.add(r)))
    );
    return Array.from(reps).sort((a, b) => Number(a) - Number(b));
  }, [rows]);

  const formatValue = (value: number | null, decimalPlaces: number) =>
    value === null ? "—" : value.toFixed(decimalPlaces);

  return (
    <div className="space-y-6 max-w-full mx-auto">
      <PageHeader
        title="Data Rata-Rata"
        description="Rata-rata nilai pengamatan per Genotipe × Environment × Karakteristik (R1/R2/R3/Rata-rata)"
      />

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Environment:</label>
        <select
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Semua Environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.environment_code}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <div className="animate-pulse text-sm">Memuat data...</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400 shadow-sm">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada data pengamatan untuk dirata-ratakan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="overflow-auto max-h-[75vh] rounded-xl">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th rowSpan={2} className="sticky left-0 top-0 z-20 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase border-b border-r border-gray-200">
                    Kode Gen
                  </th>
                  <th rowSpan={2} className="sticky top-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase border-b border-r border-gray-200">
                    Genotipe
                  </th>
                  <th rowSpan={2} className="sticky top-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase border-b border-r border-gray-200">
                    Environment
                  </th>
                  {characteristics.map((c) => (
                    <th
                      key={c.code}
                      colSpan={replications.length + 1}
                      className="sticky top-0 z-10 bg-gray-50 px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase border-b border-l border-gray-200"
                    >
                      {c.code}
                      {c.unit && <span className="font-normal text-gray-400"> ({c.unit})</span>}
                    </th>
                  ))}
                </tr>
                <tr>
                  {characteristics.map((c) => (
                    <Fragment key={c.code}>
                      {replications.map((r) => (
                        <th key={`${c.code}-R${r}`} className="sticky top-8 z-10 bg-gray-50 px-2 py-1.5 text-center text-[11px] font-semibold text-gray-400 uppercase border-b border-l border-gray-200">
                          R{r}
                        </th>
                      ))}
                      <th key={`${c.code}-avg`} className="sticky top-8 z-10 bg-gray-50 px-2 py-1.5 text-center text-[11px] font-semibold text-gray-600 uppercase border-b border-l border-gray-200">
                        Rata-rata
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={`${row.genotype_id}-${row.environment_id}`} className="hover:bg-gray-50/60">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-mono text-xs whitespace-nowrap border-r border-gray-100">
                      {row.genotype_code}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100">{row.genotype_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100">{row.environment_code}</td>
                    {characteristics.map((c) => {
                      const cdata = row.characteristics[c.code];
                      return (
                        <Fragment key={c.code}>
                          {replications.map((r) => {
                            const value = cdata?.values[r] ?? null;
                            const isImputed = !!cdata?.imputed[r];
                            return (
                              <td
                                key={`${row.genotype_id}-${row.environment_id}-${c.code}-R${r}`}
                                className={cn("px-2 py-2 text-right border-l border-gray-100 whitespace-nowrap", isImputed && "italic text-amber-600")}
                                title={isImputed ? "Nilai imputasi — rata-rata dari replikasi lain" : undefined}
                              >
                                {formatValue(value, c.decimal_places)}
                                {isImputed && "*"}
                              </td>
                            );
                          })}
                          <td
                            key={`${row.genotype_id}-${row.environment_id}-${c.code}-avg`}
                            className="px-2 py-2 text-right font-semibold border-l border-gray-100 whitespace-nowrap"
                          >
                            {formatValue(cdata?.average ?? null, c.decimal_places)}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
            <span className="italic text-amber-600">*</span> nilai imputasi — replikasi tidak ada data, dihitung dari rata-rata replikasi lain pada genotipe &amp; environment yang sama.
          </div>
        </div>
      )}
    </div>
  );
}
