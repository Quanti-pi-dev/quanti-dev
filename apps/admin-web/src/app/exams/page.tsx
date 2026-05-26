'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { useToast } from '@/components/toast';
import { Plus, BookOpen } from 'lucide-react';
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

// ─── Page ─────────────────────────────────────────────────────

export default function ExamsPage() {
  const router  = useRouter();
  const { toast } = useToast();
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

  const handleTogglePublish = useCallback(async (exam: ExamRow) => {
    setToggling(exam.id);
    try {
      await adminApi.patch(`/api/admin/exams/${exam.id}/publish`, {
        isPublished: !exam.isPublished,
      });
      toast.success(`"${exam.title}" ${!exam.isPublished ? 'published' : 'unpublished'}`);
      await fetchExams();
    } catch {
      setError(`Failed to ${exam.isPublished ? 'unpublish' : 'publish'} exam.`);
    } finally {
      setToggling(null);
    }
  }, [fetchExams, toast]);

  // Build columns inside the component so handleTogglePublish and router are in scope
  const COLUMNS: ColumnDef<ExamRow, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/exams/${row.original.id}`)}
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
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleTogglePublish(row.original)}
            disabled={toggling === row.original.id}
            className="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
          >
            {toggling === row.original.id ? '…' : row.original.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button
            onClick={() => router.push(`/exams/${row.original.id}`)}
            className="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Edit →
          </button>
        </div>
      ),
    },
  ];

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
      {loading ? (
        <Spinner />
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <BookOpen size={20} className="text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No exams yet</p>
          <p className="text-zinc-600 text-sm mt-1">Click &ldquo;New Exam&rdquo; to create your first exam.</p>
        </div>
      ) : (
        <DataTable
          columns={COLUMNS}
          data={exams}
          pageSize={20}
        />
      )}
    </PageShell>
  );
}
