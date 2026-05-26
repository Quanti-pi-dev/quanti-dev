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
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { Trash2, Plus, ChevronUp, ChevronDown, BookOpen, Layers } from 'lucide-react';
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

// ─── Shared input style ───────────────────────────────────────
const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Edit Form ────────────────────────────────────────────────

function EditForm({ exam, onSaved }: { exam: Exam; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: exam.title,
    description: exam.description,
    category: exam.category,
    durationMinutes: exam.durationMinutes,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: k === 'durationMinutes' ? Number(e.target.value) : e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await adminApi.put(`/api/admin/exams/${exam.id}`, form);
      toast.success('Exam details saved');
      onSaved();
    } catch { setError('Failed to save changes.'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-lg">
      {error && <ErrorBanner message={error} />}
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

// ─── Create Subject Modal (exam-scoped) ──────────────────────
// Creates a new subject globally then immediately maps it to the exam.

function CreateSubjectModal({
  examId,
  onClose,
  onAdded,
}: {
  examId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', description: '', iconName: '', accent: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      // Step 1: create the subject in the global pool
      const subjectRes = await adminApi.post<{ data: { id: string } }>('/api/admin/subjects', {
        name: form.name.trim(),
        ...(form.description.trim() && { description: form.description.trim() }),
        ...(form.iconName.trim()    && { iconName: form.iconName.trim() }),
        ...(form.accent.trim()      && { accent: form.accent.trim() }),
      });
      // Step 2: attach to this exam
      await adminApi.post(`/api/admin/exams/${examId}/subjects`, {
        subjectId: subjectRes.data.data.id,
      });
      toast.success(`"${form.name.trim()}" added to exam`);
      onAdded();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to create subject.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">New Subject</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition text-sm">✕</button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className={LABEL}>Name *</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Physics" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Optional short description" className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Icon name</label>
              <input value={form.iconName} onChange={set('iconName')} placeholder="e.g. atom" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Accent colour</label>
              <input value={form.accent} onChange={set('accent')} placeholder="#a78bfa" className={INPUT} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Subjects Tab ─────────────────────────────────────────────

function SubjectsTab({ examId }: { examId: string }) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<ExamSubject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ExamSubject | null>(null);
  const [removeError, setRemoveError] = useState('');

  const fetchSubjects = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: ExamSubject[] }>(`/api/admin/exams/${examId}/subjects`);
      setMappings(res.data.data.sort((a, b) => a.order - b.order));
    } catch { setError('Failed to load subjects.'); }
    finally { setLoading(false); }
  }, [examId]);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(removeTarget.subjectId); setRemoveError('');
    try {
      await adminApi.delete(`/api/admin/exams/${examId}/subjects/${removeTarget.subjectId}`);
      toast.success(`Subject removed from exam`);
      setRemoveTarget(null);
      await fetchSubjects();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setRemoveError(msg ?? 'Failed to remove subject.');
    }
    finally { setRemoving(null); }
  };

  const handleReorder = async (subjectId: string, order: number) => {
    setReordering(subjectId);
    try {
      await adminApi.patch(`/api/admin/exams/${examId}/subjects/${subjectId}/order`, { order });
      await fetchSubjects();
    } catch { setError('Failed to reorder.'); }
    finally { setReordering(null); }
  };

  return (
    <div>
      {showAdd && (
        <CreateSubjectModal
          examId={examId}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchSubjects(); }}
        />
      )}

      {removeTarget && (
        <ConfirmModal
          title="Remove Subject"
          description={`Remove "${removeTarget.subject?.name ?? 'this subject'}" from the exam? This will fail if topics or decks exist under it.`}
          confirmLabel="Remove Subject"
          destructive
          loading={removing !== null}
          error={removeError}
          onConfirm={handleRemove}
          onCancel={() => { setRemoveTarget(null); setRemoveError(''); }}
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
          No subjects attached yet. Click &ldquo;Add Subject&rdquo; to begin.
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
                onClick={() => setRemoveTarget(m)}
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

// ─── Delete Exam (Danger Zone) ────────────────────────────────

function DangerZone({ exam }: { exam: Exam }) {
  const router = useRouter();
  const { toast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  const handleDelete = async () => {
    setDeleting(true); setError('');
    try {
      await adminApi.delete(`/api/admin/exams/${exam.id}`);
      toast.success(`"${exam.title}" deleted`);
      router.push('/exams');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to delete exam.');
      setDeleting(false);
    }
  };

  return (
    <div className="border border-red-900/50 rounded-xl p-5 max-w-lg">
      {showConfirm && (
        <ConfirmModal
          title="Delete Exam"
          description={`Permanently delete "${exam.title}"? This removes all subjects, topics, and metadata associated with it. This cannot be undone.`}
          confirmLabel="Delete Exam"
          destructive
          loading={deleting}
          error={error}
          onConfirm={handleDelete}
          onCancel={() => { setShowConfirm(false); setError(''); }}
        />
      )}
      <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
      <p className="text-xs text-zinc-500 mb-4">Deleting an exam is permanent and removes all associated metadata.</p>
      <button
        onClick={() => setShowConfirm(true)}
        className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-800/60 text-red-400 text-sm font-medium hover:bg-red-900/60 transition"
      >
        Delete Exam
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
      breadcrumbs={[
        { label: 'Exams', href: '/exams' },
        { label: exam?.title ?? 'Loading…' },
      ]}
      actions={
        exam && (
          <Badge
            label={exam.isPublished ? 'Published' : 'Draft'}
            variant={exam.isPublished ? 'green' : 'zinc'}
          />
        )
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
