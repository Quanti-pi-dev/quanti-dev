'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface ExamRow {
  id: string;
  title: string;
  category: string;
  durationMinutes: number;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Columns ─────────────────────────────────────────────────

const COLUMNS: ColumnDef<ExamRow, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ getValue }) => (
      <span className="font-medium text-white">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
  },
  {
    accessorKey: 'durationMinutes',
    header: 'Duration',
    cell: ({ getValue }) => `${getValue() as number} min`,
  },
  {
    accessorKey: 'isPublished',
    header: 'Status',
    cell: ({ getValue }) => {
      const pub = getValue() as boolean;
      return <Badge label={pub ? 'Published' : 'Draft'} variant={pub ? 'green' : 'zinc'} />;
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="flex gap-2">
        <button
          onClick={() => togglePublish(row.original)}
          className="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          {row.original.isPublished ? 'Unpublish' : 'Publish'}
        </button>
      </div>
    ),
  },
];

// Extracted so the column definition can reference it
async function togglePublish(exam: ExamRow) {
  await adminApi.post(`/api/admin/exams/${exam.id}/toggle-published`);
  // Reload handled by parent — a real implementation would use React state
  window.location.reload();
}

// ─── Page ─────────────────────────────────────────────────────

export default function ExamsPage() {
  const [exams, setExams]     = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.get<{ data: { data: ExamRow[] } }>('/api/admin/exams');
      setExams(res.data.data.data);
    } catch {
      setError('Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const published   = exams.filter((e) => e.isPublished).length;
  const unpublished = exams.length - published;

  return (
    <PageShell
      title="Exams"
      subtitle={`${published} published · ${unpublished} drafts`}
      actions={
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500
                           text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={14} />
          New Exam
        </button>
      }
    >
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={exams} pageSize={20} />}
    </PageShell>
  );
}
