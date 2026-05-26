'use client';

// ─── DataTable ────────────────────────────────────────────────
// Generic sortable, paginated, filterable table built on TanStack Table v8.
// #8 fix: built-in global text filter added.

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pageSize?: number;
  searchPlaceholder?: string;
}

export function DataTable<TData>({
  columns,
  data,
  pageSize = 10,
  searchPlaceholder = 'Search…',
}: DataTableProps<TData>) {
  const [sorting, setSorting]     = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const { pageIndex, pageSize: ps } = table.getState().pagination;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const start = pageIndex * ps + 1;
  const end   = Math.min((pageIndex + 1) * ps, totalFiltered);

  return (
    <div className="space-y-3">
      {/* ── Global filter ──────────────────────────────────── */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-8 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        {globalFilter && (
          <button
            onClick={() => setGlobalFilter('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-zinc-800 bg-zinc-900/60">
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap select-none"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-1.5 ${header.column.getCanSort() ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-zinc-600">
                            {header.column.getIsSorted() === 'asc'  ? <ChevronUp size={12} className="text-violet-400" />  :
                             header.column.getIsSorted() === 'desc' ? <ChevronDown size={12} className="text-violet-400" /> :
                             <ChevronsUpDown size={12} />}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-zinc-600 text-sm">
                  {globalFilter ? `No results for "${globalFilter}"` : 'No records found'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="bg-zinc-900 hover:bg-zinc-800/40 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
          <span>
            {totalFiltered === 0 ? 'No results' : `${start}–${end} of ${totalFiltered}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2">
              Page {pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
