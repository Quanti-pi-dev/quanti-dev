'use client';

// ─── DataTable ────────────────────────────────────────────────
// Generic sortable/filterable table built on @tanstack/react-table.
// Accepts columns and data — handles pagination internally.

import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pageSize?: number;
}

export function DataTable<TData>({ columns, data, pageSize = 20 }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-zinc-800 bg-zinc-900/60">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={clsx(
                      'px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider select-none',
                      header.column.getCanSort() && 'cursor-pointer hover:text-white',
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ChevronUp size={12} />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown size={12} />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-zinc-600 text-sm"
                >
                  No records found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="bg-zinc-900 hover:bg-zinc-800/60 transition-colors">
                  {row.getVisibleCells().map((cell) => (
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

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
        <span>
          {table.getRowCount()} total · page {table.getState().pagination.pageIndex + 1}/{table.getPageCount()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
