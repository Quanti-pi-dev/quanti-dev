'use client';

// ─── Subjects Management Page ────────────────────────────────
// Global subject library — create, edit, delete subjects.
// Routes wired:
//   GET    /api/admin/subjects
//   POST   /api/admin/subjects
//   PATCH  /api/admin/subjects/:id
//   DELETE /api/admin/subjects/:id

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner } from '@/components/page-shell';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  description?: string;
  iconName?: string;
  accent?: string;
  createdAt?: string;
}

// ─── Shared styles ────────────────────────────────────────────

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Create / Edit Modal ──────────────────────────────────────

function SubjectModal({
  subject,
  onClose,
  onSaved,
}: {
  subject: Subject | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!subject;
  const [form, setForm] = useState({
    name:        subject?.name        ?? '',
    description: subject?.description ?? '',
    iconName:    subject?.iconName    ?? '',
    accent:      subject?.accent      ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await adminApi.patch(`/api/admin/subjects/${subject!.id}`, form);
      } else {
        await adminApi.post('/api/admin/subjects', form);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? `Failed to ${isEdit ? 'update' : 'create'} subject.`);
    }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Subject' : 'New Subject'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className={LABEL}>Name *</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. General Studies I" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Optional short description" className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Icon name</label>
              <input value={form.iconName} onChange={set('iconName')} placeholder="e.g. book-open" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Accent colour</label>
              <input value={form.accent} onChange={set('accent')} placeholder="#a78bfa" className={INPUT} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [modal, setModal]       = useState<Subject | null | 'new'>('new' as never);

  // null = modal closed; null used as closed state; 'new' = create mode; Subject = edit mode
  const [modalOpen, setModalOpen] = useState<false | 'new' | Subject>(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: Subject[] }>('/api/admin/subjects');
      setSubjects(res.data.data);
    } catch { setError('Failed to load subjects.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  // suppress unused 'modal' warning — remove legacy state
  void modal; void setModal;

  const handleDelete = async (s: Subject) => {
    if (!confirm(`Delete "${s.name}"? This will fail if it is attached to any exam.`)) return;
    setDeleting(s.id); setError('');
    try {
      await adminApi.delete(`/api/admin/subjects/${s.id}`);
      await fetchSubjects();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to delete subject.');
    }
    finally { setDeleting(null); }
  };

  return (
    <PageShell
      title="Subjects"
      subtitle="Global subject library — shared across all exams"
      actions={
        <button
          onClick={() => setModalOpen('new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={14} /> New Subject
        </button>
      }
    >
      {modalOpen !== false && (
        <SubjectModal
          subject={typeof modalOpen === 'object' ? modalOpen : null}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchSubjects(); }}
        />
      )}

      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : subjects.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-600 text-sm">
          No subjects yet. Click "New Subject" to create the first one.
        </div>
      ) : (
        <div className="grid gap-3">
          {subjects.map(s => (
            <div key={s.id} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
              {/* Accent swatch */}
              {s.accent && (
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: s.accent }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{s.name}</p>
                {s.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{s.description}</p>
                )}
              </div>
              {s.iconName && (
                <span className="text-xs text-zinc-600 font-mono hidden sm:inline">{s.iconName}</span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setModalOpen(s)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  disabled={deleting === s.id}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === s.id ? <Check size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
