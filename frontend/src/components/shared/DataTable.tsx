"use client";

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Search, Trash2, ChevronsUpDown, ChevronUp, ChevronDown, Filter } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  searchPlaceholder?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  /** Controls how many rows are shown per page (default 10). Pass a large number like 9999 to show all. */
  pageSize?: number;
  /** When provided, enables checkboxes and shows a bulk-delete toolbar */
  onBulkDelete?: (selectedRows: TData[]) => void | Promise<void>;
  isBulkDeleting?: boolean;
  /** Must return a stable unique string per row (e.g. String(row.id)) */
  getRowId?: (row: TData) => string;
}

export function DataTable<TData>({
  data,
  columns,
  searchPlaceholder = "Cari...",
  isLoading,
  emptyMessage = "Tidak ada data",
  pageSize: defaultPageSize,
  onBulkDelete,
  isBulkDeleting,
  getRowId,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showColumnFilters, setShowColumnFilters] = useState(false);

  const selectable = !!onBulkDelete;

  const checkboxCol: ColumnDef<TData, unknown> = {
    id: "__select__",
    enableSorting: false,
    enableColumnFilter: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected(); }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="accent-green-600 w-4 h-4 cursor-pointer"
        aria-label="Pilih semua"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        onClick={(e) => e.stopPropagation()}
        className="accent-green-600 w-4 h-4 cursor-pointer"
        aria-label="Pilih baris"
      />
    ),
    size: 36,
  };

  const allColumns = selectable ? [checkboxCol, ...columns] : columns;

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { globalFilter, rowSelection, sorting, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: selectable,
    getRowId: getRowId ?? ((row, idx) => String((row as { id?: unknown }).id ?? idx)),
    initialState: { pagination: { pageSize: defaultPageSize ?? 10 } },
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const selectedCount = selectedRows.length;

  const handleBulkDelete = async () => {
    if (!onBulkDelete || selectedCount === 0) return;
    if (!confirm(`Hapus ${selectedCount} item terpilih? Tindakan ini tidak dapat dibatalkan.`)) return;
    await onBulkDelete(selectedRows);
    setRowSelection({});
  };

  const hasFilterableColumns = table.getAllLeafColumns().some(
    (col) => col.getCanFilter() && col.id !== "__select__"
  );

  const activeFilterCount = columnFilters.length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {hasFilterableColumns && (
          <button
            onClick={() => {
              if (showColumnFilters) {
                setColumnFilters([]);
              }
              setShowColumnFilters((v) => !v);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition",
              showColumnFilters
                ? "bg-green-50 border-green-300 text-green-700"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter Kolom
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-green-600 text-white text-[10px] rounded-full font-medium">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {selectable && selectedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-xs font-medium text-red-700">{selectedCount} dipilih</span>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isBulkDeleting ? "Menghapus..." : "Hapus"}
            </button>
            <button
              onClick={() => setRowSelection({})}
              className="text-xs text-red-500 hover:text-red-700 transition"
            >
              Batal
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap",
                        header.id === "__select__" && "w-10 px-3",
                        canSort && "cursor-pointer select-none hover:bg-gray-100 transition-colors"
                      )}
                      onClick={canSort ? () => header.column.toggleSorting() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="ml-0.5 flex-shrink-0">
                              {sortDir === "asc" ? (
                                <ChevronUp className="w-3.5 h-3.5 text-green-600" />
                              ) : sortDir === "desc" ? (
                                <ChevronDown className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
            {showColumnFilters && (
              <tr className="bg-white">
                {table.getHeaderGroups()[0]?.headers.map((header) => (
                  <td
                    key={header.id}
                    className={cn(
                      "px-2 py-1.5 border-b border-gray-100",
                      header.id === "__select__" && "px-3"
                    )}
                  >
                    {header.column.getCanFilter() ? (
                      <input
                        value={(header.column.getFilterValue() as string) ?? ""}
                        onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                        placeholder="Filter..."
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500 min-w-[60px]"
                      />
                    ) : null}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {allColumns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={allColumns.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn("hover:bg-gray-50 transition", row.getIsSelected() && "bg-green-50")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-4 py-3 text-sm text-gray-700 whitespace-nowrap",
                        cell.column.id === "__select__" && "px-3 w-10"
                      )}
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Menampilkan {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
          {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} dari{" "}
          {table.getFilteredRowModel().rows.length} data
          {selectable && selectedCount > 0 && <span className="ml-2 text-green-600 font-medium">({selectedCount} dipilih)</span>}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-600 px-2">
            Hal {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
            className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
