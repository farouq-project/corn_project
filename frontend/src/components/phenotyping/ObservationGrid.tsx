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
import { ChevronUp, ChevronDown, ChevronsUpDown, Columns3, Pin, PinOff, Eye, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Characteristic, ObservationRecord } from "@/types";

interface ObservationGridProps {
  records: ObservationRecord[];
  characteristics: Characteristic[];
  isLoading?: boolean;
  onCellChange: (record: ObservationRecord, characteristic: Characteristic, value: number | null) => void;
  onEditRow?: (record: ObservationRecord) => void;
  onDeleteRow?: (record: ObservationRecord) => void;
  onViewRow?: (record: ObservationRecord) => void;
}

interface RowData {
  record: ObservationRecord;
  plot_no: string;
  genotype_code: string;
  genotype_name: string;
  environment_code: string;
  replication: number;
  staff_name: string;
  submitted_at: string;
  [characteristicCode: string]: unknown;
}

const columnHelper = createColumnHelper<RowData>();

const DEFAULT_PINNED_COLUMNS = ["plot_no", "genotype_code", "genotype_name", "environment_code", "replication"];

const STATIC_COLUMN_LABELS: Record<string, string> = {
  plot_no: "No Plot",
  genotype_code: "Kode Gen",
  staff_name: "Staff",
  submitted_at: "Tgl Submit",
  genotype_name: "Gen",
  environment_code: "Lokasi",
  replication: "R",
};

/** Returns inline styles for sticky (frozen) columns.
 *  The inline backgroundColor is CRITICAL — it overrides any class-based hover/bg
 *  so scrolled content cannot bleed through the frozen pane.
 */
function getPinningStyles<T>(column: Column<RowData, T>, isHeader = false): CSSProperties {
  const isPinned = column.getIsPinned();
  if (!isPinned) {
    return isHeader ? { zIndex: 1 } : {};
  }

  // Exact pixel width from TanStack Table's size — CRITICAL for preventing the
  // transparent strip between the sticky cell's visual edge and its actual boundary.
  const size = column.getSize();
  const left = column.getStart("left");

  return {
    position: "sticky",
    left: `${left}px`,
    // Width must match exactly so the opaque background covers the full cell area
    width: `${size}px`,
    minWidth: `${size}px`,
    maxWidth: `${size}px`,
    zIndex: isHeader ? 30 : 20,
    backgroundColor: isHeader ? "rgb(249,250,251)" : "rgb(255,255,255)",
    // Solid 1px right border acts as the frozen-pane divider (more reliable than box-shadow)
    boxShadow: "inset -1px 0 0 rgb(209,213,219), 3px 0 8px -3px rgba(0,0,0,0.12)",
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

export function ObservationGrid({ records, characteristics, isLoading, onCellChange, onEditRow, onDeleteRow, onViewRow }: ObservationGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: DEFAULT_PINNED_COLUMNS });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const charLabelMap = useMemo(
    () => Object.fromEntries(characteristics.map((c) => [c.code, c.name])),
    [characteristics]
  );

  const data = useMemo<RowData[]>(
    () =>
      records.map((record) => ({
        record,
        plot_no: record.plot_no,
        genotype_code: record.genotype?.genotype_code ?? "",
        genotype_name: record.genotype?.genotype_name ?? "",
        environment_code: record.environment?.name ?? record.environment?.environment_code ?? "",
        replication: record.replication,
        staff_name: (record as ObservationRecord & { staff_name?: string }).staff_name ?? record.recorder?.name ?? "—",
        submitted_at: record.created_at ? new Date(record.created_at).toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" }) : "—",
        ...Object.fromEntries(characteristics.map((c) => [c.code, record.values?.[c.code] ?? null])),
      })),
    [records, characteristics]
  );

  const COLUMN_WIDTHS: Record<string, number> = {
    plot_no: 70,
    genotype_code: 80,
    genotype_name: 90,
    environment_code: 80,
    replication: 44,
    staff_name: 90,
    submitted_at: 90,
  };

  const columns = useMemo<ColumnDef<RowData, unknown>[]>(() => {
    const staticCols = (["plot_no", "genotype_code", "genotype_name", "environment_code", "replication", "staff_name", "submitted_at"] as const).map((id) =>
      columnHelper.accessor(id, {
        id,
        size: COLUMN_WIDTHS[id],
        header: STATIC_COLUMN_LABELS[id],
        cell: (info) => (
          <span className={id === "environment_code" ? "block text-xs leading-tight break-words whitespace-normal max-w-[80px]" : "whitespace-nowrap text-xs"}>
            {info.getValue() as string | number}
          </span>
        ),
      })
    );

    const charCols = characteristics.map((c) =>
      columnHelper.accessor((row) => row[c.code] as number | null, {
        id: c.code,
        header: () => (
          <div className="text-center leading-tight" title={c.name + (c.unit ? ` (${c.unit})` : "")}>
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

    // Aksi column — only added when row action handlers are provided
    const aksiCol: ColumnDef<RowData, unknown>[] = (onEditRow || onDeleteRow || onViewRow) ? [{
      id: "__aksi__",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {onViewRow && <button onClick={() => onViewRow(row.original.record)} title="Lihat Detail" className="p-1.5 rounded hover:bg-blue-50 text-blue-400 transition"><Eye className="w-3.5 h-3.5"/></button>}
          {onEditRow && <button onClick={() => onEditRow(row.original.record)} title="Edit" className="p-1.5 rounded hover:bg-yellow-50 text-yellow-500 transition"><Edit2 className="w-3.5 h-3.5"/></button>}
          {onDeleteRow && <button onClick={() => onDeleteRow(row.original.record)} title="Hapus" className="p-1.5 rounded hover:bg-red-50 text-red-400 transition"><Trash2 className="w-3.5 h-3.5"/></button>}
        </div>
      ),
    }] : [];

    return [...staticCols, ...charCols, ...aksiCol] as ColumnDef<RowData, unknown>[];
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
            <div className="flex gap-1.5 mb-2 pb-2 border-b border-gray-100">
              <button
                onClick={() => table.getAllLeafColumns().forEach((c) => c.toggleVisibility(true))}
                className="flex-1 text-xs py-1 px-2 rounded bg-green-50 text-green-700 hover:bg-green-100 transition"
              >
                Pilih Semua
              </button>
              <button
                onClick={() =>
                  table.getAllLeafColumns()
                    .filter((c) => !DEFAULT_PINNED_COLUMNS.includes(c.id) && c.id !== "__aksi__")
                    .forEach((c) => c.toggleVisibility(false))
                }
                className="flex-1 text-xs py-1 px-2 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
              >
                Batal Semua
              </button>
            </div>
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
                    <span className="truncate">{STATIC_COLUMN_LABELS[column.id] ?? charLabelMap[column.id] ?? column.id}</span>
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

      <div className="overflow-auto rounded-lg border border-gray-200 max-h-[60vh] md:max-h-[70vh]" style={{isolation: "isolate"}}>
        <table className="min-w-full border-separate border-spacing-0 text-sm" style={{position: "relative"}}>
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={getPinningStyles(header.column, true)}
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
                <tr key={row.id} className="group transition">
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned();
                    return (
                      <td
                        key={cell.id}
                        style={{
                          ...getPinningStyles(cell.column),
                          // Non-pinned cells: explicit background so no bleed-through on hover
                          ...(pinned ? {} : { backgroundColor: undefined }),
                        }}
                        className={cn(
                          "px-2 py-1 whitespace-nowrap",
                          pinned ? "" : "bg-white group-hover:bg-gray-50"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
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
