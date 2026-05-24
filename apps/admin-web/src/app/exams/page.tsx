'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
    cell: ({ row, table }) => (
      <button
        onClick={() => (table.options.meta as { onRowClick: (e: ExamRow) => void }).onRowClick(row.original)}
        className="font-medium text-white hover:text-violet-400 transition text-left"
      >
        {row.original.title}
      </button>
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
    cell: ({ row, table }) => (
      <div className="flex gap-2">
        <button
          onClick={() => (table.options.meta as { onTogglePublish: (e: ExamRow) => void }).onTogglePublish(row.original)}
          className="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          {row.original.isPublished ? 'Unpublish' : 'Publish'}
        </button>
        <button
          onClick={() => (table.options.meta as { onRowClick: (e: ExamRow) => void }).onRowClick(row.original)}
          className="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          Edit →
        </button>
      </div>
    ),
  },
];



// ─── Page ─────────────────────────────────────────────────────

export default function ExamsPage() {
  const router  = useRouter();
  const [exams, setExams]     = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.get<{ data: ExamRow[]; pagination: unknown }>('/api/admin/exams');
      setExams(res.data.data);
    } catch {
      setError('Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  // ── Fix: was POST .../toggle-published; backend expects PATCH .../publish ──
  const handleTogglePublish = useCallback(async (exam: ExamRow) => {
    setToggling(exam.id);
    try {
      await adminApi.patch(`/api/admin/exams/${exam.id}/publish`, {
        isPublished: !exam.isPublished,
      });
      await fetchExams();
    } catch {
      setError(`Failed to ${exam.isPublished ? 'unpublish' : 'publish'} exam.`);
    } finally {
      setToggling(null);
    }
  }, [fetchExams]);

  const published   = exams.filter((e) => e.isPublished).length;
  const unpublished = exams.length - published;

  return (
    <PageShell
      title="Exams"
      subtitle={`${published} published · ${unpublished} drafts`}
      actions={
        <button
          onClick={() => router.push('/exams/new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500
                     text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={14} />
          New Exam
        </button>
      }
    >
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : (
        <DataTable
          columns={COLUMNS}
          data={exams}
          pageSize={20}
          meta={{ onTogglePublish: handleTogglePublish, toggling, onRowClick: (e: ExamRow) => router.push(`/exams/${e.id}`) }}
        />
      )}
    </PageShell>
  );
}
