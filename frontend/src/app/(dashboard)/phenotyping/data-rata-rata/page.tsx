"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import api from "@/lib/axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { phenotypingService } from "@/services/phenotyping.service";
import { cn } from "@/lib/utils";
import type { AggregatedRow, Characteristic, Environment } from "@/types";

// ── Frozen column definitions ─────────────────────────────────────────────────

const META_COLS = [
  { id: "genotype_code",    label: "Kode Gen",    width: 80,  left: 0   },
  { id: "genotype_name",    label: "Genotipe",    width: 140, left: 80  },
  { id: "environment_code", label: "Environment", width: 120, left: 220 },
] as const;

type MetaColId = typeof META_COLS[number]["id"];
const LAST_META_ID: MetaColId = "environment_code";

function getMetaValue(row: AggregatedRow, id: MetaColId): string {
  if (id === "genotype_code")    return row.genotype_code;
  if (id === "genotype_name")    return row.genotype_name;
  if (id === "environment_code") return row.environment_code;
  return "";
}

function metaStyle(left: number, width: number, isLast: boolean, isHeader: boolean): React.CSSProperties {
  return {
    position:        "sticky",
    left:            left,
    width:           width,
    minWidth:        width,
    zIndex:          isHeader ? 30 : 10,
    backgroundColor: isHeader ? "rgb(249,250,251)" : "rgb(255,255,255)",
    boxShadow:       isLast
      ? "inset -3px 0 0 rgba(0,0,0,0.85), 4px 0 8px -3px rgba(0,0,0,0.18)"
      : "inset -1px 0 0 rgba(0,0,0,0.15)",
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DataRataRataPage() {
  const [environmentFilter, setEnvironmentFilter] = useState<string>("");

  const { data: characteristicsData } = useQuery({
    queryKey: ["characteristics"],
    queryFn: () => phenotypingService.getCharacteristics({ active_only: true }).then((r) => r.data),
  });
  const characteristics: Characteristic[] = characteristicsData ?? [];

  const { data: environmentsData } = useQuery({
    queryKey: ["environments"],
    queryFn: () =>
      api.get<{ data: Environment[] }>("/v1/environments", { params: { per_page: 100 } }).then((r) => r.data.data),
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
      Object.values(row.characteristics).forEach((c) =>
        Object.keys(c.values).forEach((r) => reps.add(r))
      )
    );
    return Array.from(reps).sort((a, b) => Number(a) - Number(b));
  }, [rows]);

  const formatValue = (value: number | null, dp: number) =>
    value === null ? "—" : value.toFixed(dp);

  return (
    <div className="space-y-6 max-w-full mx-auto">
      <PageHeader
        title="Data Rata-Rata"
        description="Rata-rata nilai pengamatan per Genotipe × Environment × Karakteristik (R1/R2/R3/Rata-rata)"
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
          <p className="px-3 pt-2 text-[11px] text-gray-400 md:hidden">
            Geser tabel ke samping untuk melihat kolom lainnya
          </p>
          <div className="overflow-auto max-h-[60vh] md:max-h-[75vh] rounded-xl">
            <table className="min-w-full border-separate border-spacing-0 text-sm">

              {/* ── HEADER ── */}
              <thead className="bg-gray-50" style={{ position: "sticky", top: 0, zIndex: 40 }}>

                {/* Row 0: frozen meta cols (rowSpan=2) + characteristic group headers */}
                <tr>
                  {META_COLS.map((col) => {
                    const isLast = col.id === LAST_META_ID;
                    return (
                      <th
                        key={col.id}
                        rowSpan={2}
                        style={metaStyle(col.left, col.width, isLast, true)}
                        className={cn(
                          "px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide",
                          "border-b-2 border-b-black",
                          isLast ? "border-r-2 border-r-black" : "border-r border-r-gray-300"
                        )}
                      >
                        {col.label}
                      </th>
                    );
                  })}

                  {characteristics.map((c) => (
                    <th
                      key={c.code}
                      colSpan={replications.length + 1}
                      style={{ zIndex: 1 }}
                      className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-b-gray-300 border-r-2 border-r-black"
                    >
                      <div className="leading-tight">
                        <div>{c.code}</div>
                        {c.unit && (
                          <div className="text-[10px] text-gray-400 normal-case font-normal">({c.unit})</div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>

                {/* Row 1: R1, R2, …, Rata-rata for each characteristic */}
                <tr>
                  {characteristics.map((c) => (
                    <Fragment key={c.code}>
                      {replications.map((r) => (
                        <th
                          key={`${c.code}-R${r}`}
                          style={{ zIndex: 1, backgroundColor: "rgb(249,250,251)" }}
                          className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-400 uppercase border-b-2 border-b-black border-r border-r-gray-300"
                        >
                          R{r}
                        </th>
                      ))}
                      <th
                        key={`${c.code}-avg`}
                        style={{ zIndex: 1, backgroundColor: "rgb(249,250,251)" }}
                        className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-600 uppercase border-b-2 border-b-black border-r-2 border-r-black"
                      >
                        Rata-rata
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              {/* ── BODY ── */}
              <tbody className="bg-white">
                {rows.map((row) => (
                  <tr
                    key={`${row.genotype_id}-${row.environment_id}`}
                    className="group"
                  >
                    {/* Frozen meta columns */}
                    {META_COLS.map((col) => {
                      const isLast = col.id === LAST_META_ID;
                      return (
                        <td
                          key={col.id}
                          style={metaStyle(col.left, col.width, isLast, false)}
                          className={cn(
                            "px-2 py-1 text-xs text-gray-600 whitespace-nowrap",
                            "border-b border-b-gray-300",
                            isLast ? "border-r-2 border-r-black" : "border-r border-r-gray-300",
                            col.id === "genotype_code" && "font-mono"
                          )}
                        >
                          {getMetaValue(row, col.id)}
                        </td>
                      );
                    })}

                    {/* Characteristic columns */}
                    {characteristics.map((c) => {
                      const cdata = row.characteristics[c.code];
                      return (
                        <Fragment key={c.code}>
                          {replications.map((r) => {
                            const value    = cdata?.values[r] ?? null;
                            const isImputed = !!cdata?.imputed[r];
                            return (
                              <td
                                key={`${c.code}-R${r}`}
                                title={isImputed ? "Nilai imputasi — rata-rata dari replikasi lain" : undefined}
                                className={cn(
                                  "px-2 py-1 text-right text-xs font-mono whitespace-nowrap",
                                  "border-b border-b-gray-700 border-r border-r-gray-700",
                                  isImputed ? "italic text-amber-600" : "text-gray-800",
                                  "group-hover:bg-gray-50/60"
                                )}
                              >
                                {formatValue(value, c.decimal_places)}
                                {isImputed && "*"}
                              </td>
                            );
                          })}
                          <td
                            key={`${c.code}-avg`}
                            className={cn(
                              "px-2 py-1 text-right text-xs font-mono font-semibold whitespace-nowrap",
                              "border-b border-b-gray-700 border-r-2 border-r-black",
                              cdata?.average === null ? "text-gray-300" : "text-gray-800",
                              "group-hover:bg-gray-50/60"
                            )}
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
            <span className="italic text-amber-600">*</span>{" "}
            nilai imputasi — replikasi tidak ada data, dihitung dari rata-rata replikasi lain pada genotipe &amp; environment yang sama.
          </div>
        </div>
      )}
    </div>
  );
}
