"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type Column,
  type SortingState,
  type ColumnFiltersState,
  type ColumnPinningState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Columns3, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Characteristic, ObservationRecord } from "@/types";

interface ObservationGridProps {
  records: ObservationRecord[];
  characteristics: Characteristic[];
  isLoading?: boolean;
  onCellChange: (record: ObservationRecord, characteristic: Characteristic, value: number | null) => void;
}

interface RowData {
  record: ObservationRecord;
  plot_no: string;
  genotype_code: string;
  genotype_name: string;
  environment_code: string;
  replication: number;
  [characteristicCode: string]: unknown;
}

const columnHelper = createColumnHelper<RowData>();

const DEFAULT_PINNED_COLUMNS = ["plot_no", "genotype_code", "genotype_name", "environment_code", "replication"];

const STATIC_COLUMN_LABELS: Record<string, string> = {
  plot_no: "No Plot",
  genotype_code: "Kode Gen",
  genotype_name: "Gen",
  environment_code: "Environment",
  replication: "R",
};

function getPinningStyles<T>(column: Column<RowData, T>, isHeader = false): CSSProperties {
  const isPinned = column.getIsPinned();

  return {
    position: isPinned ? "sticky" : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    // Headers need z-index 3 (above both pinned body cells at 2 and scrollable content at 0)
    zIndex: isPinned ? (isHeader ? 3 : 2) : isHeader ? 1 : 0,
    // Solid background stops scrolled content showing through pinned columns
    backgroundColor: isPinned ? (isHeader ? "rgb(249,250,251)" : "white") : undefined,
    boxShadow: isPinned === "left" ? "2px 0 5px -1px rgba(0,0,0,0.12)" : undefined,
  };
}

function EditableCell({
  value,
  decimalPlaces,
  onCommit,
}: {
  value: number | null;
  decimalPlaces: number;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null || value === undefined ? "" : String(value));

  return (
    <input
      type="number"
      step="any"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const num = draft.trim() === "" ? null : Number(draft);
        const rounded = num !== null ? Number(num.toFixed(decimalPlaces)) : null;
        if (rounded !== (value ?? null)) onCommit(rounded);
      }}
      className="w-16 md:w-20 px-1.5 py-2 md:py-1 text-right text-sm border border-transparent rounded focus:border-green-400 focus:outline-none focus:bg-green-50 bg-transparent hover:bg-gray-50"
    />
  );
}

export function ObservationGrid({ records, characteristics, isLoading, onCellChange }: ObservationGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: DEFAULT_PINNED_COLUMNS });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const data = useMemo<RowData[]>(
    () =>
      records.map((record) => ({
        record,
        plot_no: record.plot_no,
        genotype_code: record.genotype?.genotype_code ?? "",
        genotype_name: record.genotype?.genotype_name ?? "",
        environment_code: record.environment?.environment_code ?? "",
        replication: record.replication,
        ...Object.fromEntries(characteristics.map((c) => [c.code, record.values?.[c.code] ?? null])),
      })),
    [records, characteristics]
  );

  const COLUMN_WIDTHS: Record<string, number> = {
    plot_no: 70,
    genotype_code: 80,
    genotype_name: 90,
    environment_code: 80, // compact — wraps if needed
    replication: 44,
  };

  const columns = useMemo<ColumnDef<RowData, unknown>[]>(() => {
    const staticCols = (["plot_no", "genotype_code", "genotype_name", "environment_code", "replication"] as const).map((id) =>
      columnHelper.accessor(id, {
        id,
        size: COLUMN_WIDTHS[id],
        header: STATIC_COLUMN_LABELS[id],
        cell: (info) => (
          <span className={id === "environment_code" ? "block text-xs leading-tight break-words whitespace-normal max-w-[80px]" : "whitespace-nowrap"}>
            {info.getValue() as string | number}
          </span>
        ),
      })
    );

    const charCols = characteristics.map((c) =>
      columnHelper.accessor((row) => row[c.code] as number | null, {
        id: c.code,
        header: () => (
          <div className="text-center leading-tight">
            <div>{c.code}</div>
            {c.unit && <div className="text-[10px] text-gray-400 normal-case font-normal">({c.unit})</div>}
          </div>
        ),
        cell: ({ row, getValue }) => {
          const value = getValue() as number | null;
          return (
            <EditableCell
              key={`${row.original.record.id}-${c.code}-${value ?? ""}`}
              value={value}
              decimalPlaces={c.decimal_places}
              onCommit={(newValue) => onCellChange(row.original.record, c, newValue)}
            />
          );
        },
      })
    );

    return [...staticCols, ...charCols] as ColumnDef<RowData, unknown>[];
  }, [characteristics, onCellChange]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, columnPinning },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-400 md:hidden">Geser tabel ke samping untuk melihat kolom lainnya</p>
        <div className="flex justify-end relative ml-auto">
        <button
          onClick={() => setShowColumnMenu((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <Columns3 className="w-3.5 h-3.5" />
          Kolom
        </button>

        {showColumnMenu && (
          <div className="absolute right-0 top-9 z-20 w-64 max-w-[80vw] max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-2">
            {table.getAllLeafColumns().map((column) => {
              const isPinned = column.getIsPinned();
              return (
                <div key={column.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-sm">
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      className="accent-green-600"
                    />
                    <span className="truncate">{STATIC_COLUMN_LABELS[column.id] ?? column.id}</span>
                  </label>
                  <button
                    onClick={() => column.pin(isPinned ? false : "left")}
                    title={isPinned ? "Lepas pin" : "Pin kolom"}
                    className="flex-shrink-0 text-gray-400 hover:text-green-600"
                  >
                    {isPinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-200 max-h-[60vh] md:max-h-[70vh]">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ ...getPinningStyles(header.column, true), width: header.column.getSize() || undefined, maxWidth: header.column.getSize() || undefined }}
                    className={cn(
                      "px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 sticky top-0 bg-gray-50",
                      header.column.getIsPinned() && "bg-gray-50"
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="space-y-1">
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn("flex items-center gap-1", header.column.getCanSort() && "cursor-pointer select-none")}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() &&
                            ({
                              asc: <ChevronUp className="w-3 h-3" />,
                              desc: <ChevronDown className="w-3 h-3" />,
                            }[header.column.getIsSorted() as string] ?? <ChevronsUpDown className="w-3 h-3 text-gray-300" />)}
                        </button>
                        {header.column.getCanFilter() && (
                          <input
                            value={(header.column.getFilterValue() as string) ?? ""}
                            onChange={(e) => header.column.setFilterValue(e.target.value)}
                            placeholder="Filter..."
                            className="w-full px-1 py-0.5 text-[11px] font-normal normal-case border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {table.getAllLeafColumns().map((col) => (
                    <td key={col.id} className="px-2 py-2">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllLeafColumns().length} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Tidak ada data pengamatan
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60 transition">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={getPinningStyles(cell.column)}
                      className="px-2 py-1 whitespace-nowrap"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">{table.getFilteredRowModel().rows.length} dari {records.length} baris</p>
    </div>
  );
}
