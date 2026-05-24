'use client';

// ─── Mock Tests Page ──────────────────────────────────────────
// CRUD for curated mock test templates.
// Routes wired:
//   GET    /api/admin/mock-tests
//   POST   /api/admin/mock-tests
//   PUT    /api/admin/mock-tests/:id
//   DELETE /api/admin/mock-tests/:id

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface MockTest {
  _id: string;
  title: string;
  description: string;
  examId: string;
  cardIds: string[];
  subjectIds: string[];
  cardCount: number;
  timeLimitMinutes: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

function apiError(err: unknown) {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Unknown error';
}

// ─── Modal ────────────────────────────────────────────────────

function MockTestModal({ test, onClose, onSaved }: { test: MockTest | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!test;
  const [form, setForm] = useState({
    title:            test?.title            ?? '',
    description:      test?.description      ?? '',
    examId:           test?.examId           ?? '',
    cardCount:        test?.cardCount        ?? 30,
    timeLimitMinutes: test?.timeLimitMinutes ?? 45,
    isActive:         test?.isActive         ?? true,
    sortOrder:        test?.sortOrder        ?? 0,
    subjectIds:       test?.subjectIds?.join('\n') ?? '',
    cardIds:          test?.cardIds?.join('\n')    ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({
      ...p,
      [k]: ['cardCount', 'timeLimitMinutes', 'sortOrder'].includes(k) ? Number(e.target.value) : e.target.value,
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.examId) { setError('Title and Exam ID are required.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      examId: form.examId,
      cardCount: form.cardCount,
      timeLimitMinutes: form.timeLimitMinutes,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
      subjectIds: form.subjectIds.split('\n').map(s => s.trim()).filter(Boolean),
      cardIds:    form.cardIds.split('\n').map(s => s.trim()).filter(Boolean),
    };
    try {
      if (isEdit) await adminApi.put(`/api/admin/mock-tests/${test!._id}`, payload);
      else await adminApi.post('/api/admin/mock-tests', payload);
      onSaved();
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-6">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Mock Test' : 'New Mock Test'}</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div><label className={LABEL}>Title *</label><input value={form.title} onChange={set('title')} placeholder="e.g. UPSC 2024 Full Mock" className={INPUT} /></div>
          <div><label className={LABEL}>Description</label><textarea value={form.description} onChange={set('description')} rows={2} className={INPUT} /></div>
          <div><label className={LABEL}>Exam ID *</label><input value={form.examId} onChange={set('examId')} placeholder="MongoDB ObjectId" className={INPUT} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={LABEL}>Card Count</label><input type="number" min={1} max={200} value={form.cardCount} onChange={set('cardCount')} className={INPUT} /></div>
            <div><label className={LABEL}>Time Limit (min, 0=∞)</label><input type="number" min={0} value={form.timeLimitMinutes} onChange={set('timeLimitMinutes')} className={INPUT} /></div>
            <div><label className={LABEL}>Sort Order</label><input type="number" min={0} value={form.sortOrder} onChange={set('sortOrder')} className={INPUT} /></div>
          </div>
          <div>
            <label className={LABEL}>Subject IDs (one per line, used when sampling)</label>
            <textarea value={form.subjectIds} onChange={set('subjectIds')} rows={3} placeholder="MongoDB ObjectId&#10;MongoDB ObjectId…" className={`${INPUT} font-mono text-xs`} />
          </div>
          <div>
            <label className={LABEL}>Card IDs (one per line, overrides sampling)</label>
            <textarea value={form.cardIds} onChange={set('cardIds')} rows={3} placeholder="MongoDB ObjectId&#10;MongoDB ObjectId…" className={`${INPUT} font-mono text-xs`} />
          </div>
          <div>
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className="flex items-center gap-2 text-sm text-zinc-300">
              {form.isActive ? <ToggleRight size={22} className="text-violet-400" /> : <ToggleLeft size={22} className="text-zinc-600" />}
              {form.isActive ? 'Active (visible to students)' : 'Inactive (hidden)'}
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function MockTestsPage() {
  const [tests, setTests]     = useState<MockTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | MockTest>(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchTests = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: MockTest[] }>('/api/admin/mock-tests');
      setTests(res.data.data);
    } catch { setError('Failed to load mock tests.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const handleDelete = async (t: MockTest) => {
    if (!confirm(`Delete mock test "${t.title}"?`)) return;
    setDeleting(t._id); setError('');
    try { await adminApi.delete(`/api/admin/mock-tests/${t._id}`); await fetchTests(); }
    catch (err) { setError(apiError(err)); } finally { setDeleting(null); }
  };

  const COLUMNS: ColumnDef<MockTest, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ getValue }) => <span className="font-medium text-white text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: 'cardCount',
      header: 'Cards',
      cell: ({ getValue }) => `${getValue() as number} cards`,
    },
    {
      accessorKey: 'timeLimitMinutes',
      header: 'Time',
      cell: ({ getValue }) => {
        const mins = getValue() as number;
        return mins === 0 ? 'Untimed' : `${mins} min`;
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) => <Badge label={(getValue() as boolean) ? 'Active' : 'Draft'} variant={(getValue() as boolean) ? 'green' : 'zinc'} />,
    },
    {
      accessorKey: 'sortOrder',
      header: 'Order',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setModal(row.original)} className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"><Pencil size={13} /></button>
          <button onClick={() => handleDelete(row.original)} disabled={deleting === row.original._id} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Mock Tests"
      subtitle={`${tests.length} template${tests.length !== 1 ? 's' : ''}`}
      actions={
        <button onClick={() => setModal('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
          <Plus size={14} /> New Mock Test
        </button>
      }
    >
      {modal !== false && <MockTestModal test={typeof modal === 'object' ? modal : null} onClose={() => setModal(false)} onSaved={() => { setModal(false); fetchTests(); }} />}
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={tests} pageSize={20} />}
    </PageShell>
  );
}
