'use client';

// ─── Exam Detail Page ─────────────────────────────────────────
// Shows exam info, edit form, and subjects tab with full CRUD.
// Routes wired:
//   GET    /api/admin/exams/:id
//   PUT    /api/admin/exams/:id
//   DELETE /api/admin/exams/:id
//   GET    /api/admin/exams/:id/subjects
//   POST   /api/admin/exams/:id/subjects
//   DELETE /api/admin/exams/:id/subjects/:subjectId
//   PATCH  /api/admin/exams/:id/subjects/:subjectId/order

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { ArrowLeft, Trash2, Plus, ChevronUp, ChevronDown, BookOpen, Layers } from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────

interface Exam {
  id: string;
  title: string;
  description: string;
  category: string;
  durationMinutes: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExamSubject {
  id: string;
  examId: string;
  subjectId: string;
  order: number;
  subject: { id: string; name: string; iconName?: string; accent?: string } | null;
}

interface Subject {
  id: string;
  name: string;
  iconName?: string;
  accent?: string;
}

// ─── Shared input style ───────────────────────────────────────
const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Edit Form ────────────────────────────────────────────────

function EditForm({ exam, onSaved }: { exam: Exam; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: exam.title,
    description: exam.description,
    category: exam.category,
    durationMinutes: exam.durationMinutes,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [saved, setSaved]   = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: k === 'durationMinutes' ? Number(e.target.value) : e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    try {
      await adminApi.put(`/api/admin/exams/${exam.id}`, form);
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch { setError('Failed to save changes.'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-lg">
      {error && <ErrorBanner message={error} />}
      {saved && (
        <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl px-4 py-3">
          Changes saved ✓
        </div>
      )}
      <div>
        <label className={LABEL}>Title</label>
        <input value={form.title} onChange={set('title')} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Description</label>
        <textarea value={form.description} onChange={set('description')} rows={3} className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Category</label>
          <input value={form.category} onChange={set('category')} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Duration (min)</label>
          <input type="number" min={1} value={form.durationMinutes} onChange={set('durationMinutes')} className={INPUT} />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  );
}

// ─── Add Subject Modal ────────────────────────────────────────

function AddSubjectModal({
  examId,
  attachedIds,
  onClose,
  onAdded,
}: {
  examId: string;
  attachedIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    adminApi.get<{ data: Subject[] }>('/api/admin/subjects')
      .then(r => setSubjects(r.data.data))
      .catch(() => setError('Failed to load subjects.'))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (subjectId: string) => {
    setSaving(subjectId); setError('');
    try {
      await adminApi.post(`/api/admin/exams/${examId}/subjects`, { subjectId });
      onAdded();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to add subject.');
      setSaving(null);
    }
  };

  const available = subjects.filter(s => !attachedIds.has(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add Subject to Exam</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition text-sm">✕</button>
        </div>
        {error && <ErrorBanner message={error} />}
        {loading ? <Spinner /> : available.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4 text-center">
            All subjects are already attached, or no subjects exist.{' '}
            <Link href="/subjects" className="text-violet-400 hover:underline">Create one</Link>
          </p>
        ) : (
          <ul className="space-y-2 overflow-y-auto flex-1 mt-2">
            {available.map(s => (
              <li key={s.id} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
                <span className="text-sm text-white">{s.name}</span>
                <button
                  disabled={saving === s.id}
                  onClick={() => handleAdd(s.id)}
                  className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition disabled:opacity-50"
                >
                  {saving === s.id ? 'Adding…' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button onClick={onClose} className="mt-4 text-zinc-400 text-sm hover:text-white transition">
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Subjects Tab ─────────────────────────────────────────────

function SubjectsTab({ examId }: { examId: string }) {
  const [mappings, setMappings] = useState<ExamSubject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: ExamSubject[] }>(`/api/admin/exams/${examId}/subjects`);
      setMappings(res.data.data.sort((a, b) => a.order - b.order));
    } catch { setError('Failed to load subjects.'); }
    finally { setLoading(false); }
  }, [examId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleRemove = async (subjectId: string) => {
    if (!confirm('Remove this subject from the exam? This will fail if topics or decks exist under it.')) return;
    setRemoving(subjectId); setError('');
    try {
      await adminApi.delete(`/api/admin/exams/${examId}/subjects/${subjectId}`);
      await fetch();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to remove subject.');
    }
    finally { setRemoving(null); }
  };

  const handleReorder = async (subjectId: string, order: number) => {
    setReordering(subjectId);
    try {
      await adminApi.patch(`/api/admin/exams/${examId}/subjects/${subjectId}/order`, { order });
      await fetch();
    } catch { setError('Failed to reorder.'); }
    finally { setReordering(null); }
  };

  const attachedIds = new Set(mappings.map(m => m.subjectId));

  return (
    <div>
      {showAdd && (
        <AddSubjectModal
          examId={examId}
          attachedIds={attachedIds}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetch(); }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{mappings.length} subject{mappings.length !== 1 ? 's' : ''} attached</p>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={13} /> Add Subject
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : mappings.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center text-zinc-600 text-sm">
          No subjects attached yet. Click "Add Subject" to begin.
        </div>
      ) : (
        <ul className="space-y-2">
          {mappings.map((m, idx) => (
            <li key={m.id} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  disabled={idx === 0 || reordering === m.subjectId}
                  onClick={() => handleReorder(m.subjectId, m.order - 1)}
                  className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  disabled={idx === mappings.length - 1 || reordering === m.subjectId}
                  onClick={() => handleReorder(m.subjectId, m.order + 1)}
                  className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-white">{m.subject?.name ?? m.subjectId}</p>
                <p className="text-xs text-zinc-600 mt-0.5">Order: {m.order}</p>
              </div>

              {/* Navigate to topics */}
              <Link
                href={`/exams/${examId}/subjects/${m.subjectId}/topics`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition"
              >
                <Layers size={12} /> Topics
              </Link>

              <button
                disabled={removing === m.subjectId}
                onClick={() => handleRemove(m.subjectId)}
                className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"
                title="Remove from exam"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Delete Exam ──────────────────────────────────────────────

function DangerZone({ exam }: { exam: Exam }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${exam.title}"? This cannot be undone.`)) return;
    setDeleting(true); setError('');
    try {
      await adminApi.delete(`/api/admin/exams/${exam.id}`);
      router.push('/exams');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to delete exam.');
      setDeleting(false);
    }
  };

  return (
    <div className="border border-red-900/50 rounded-xl p-5 max-w-lg">
      <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
      <p className="text-xs text-zinc-500 mb-4">Deleting an exam is permanent and removes all associated metadata.</p>
      {error && <ErrorBanner message={error} />}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-800/60 text-red-400 text-sm font-medium hover:bg-red-900/60 transition disabled:opacity-50"
      >
        {deleting ? 'Deleting…' : 'Delete Exam'}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

type Tab = 'info' | 'subjects';

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [exam, setExam]     = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [tab, setTab]       = useState<Tab>('info');

  const fetchExam = useCallback(async () => {
    setError('');
    try {
      const res = await adminApi.get<{ data: Exam }>(`/api/admin/exams/${id}`);
      setExam(res.data.data);
    } catch { setError('Failed to load exam.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchExam(); }, [fetchExam]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info',     label: 'Info & Edit' },
    { key: 'subjects', label: 'Subjects' },
  ];

  return (
    <PageShell
      title={exam?.title ?? 'Exam'}
      subtitle={exam ? `${exam.category} · ${exam.durationMinutes} min` : ''}
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/exams')}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft size={14} /> Exams
          </button>
          {exam && (
            <Badge
              label={exam.isPublished ? 'Published' : 'Draft'}
              variant={exam.isPublished ? 'green' : 'zinc'}
            />
          )}
        </div>
      }
    >
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : !exam ? null : (
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-zinc-800">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t.key
                    ? 'border-violet-500 text-violet-300'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'info' && (
            <div className="space-y-8">
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <BookOpen size={12} /> Exam Details
                </h2>
                <EditForm exam={exam} onSaved={fetchExam} />
              </section>
              <section>
                <DangerZone exam={exam} />
              </section>
            </div>
          )}

          {tab === 'subjects' && <SubjectsTab examId={id} />}
        </div>
      )}
    </PageShell>
  );
}
