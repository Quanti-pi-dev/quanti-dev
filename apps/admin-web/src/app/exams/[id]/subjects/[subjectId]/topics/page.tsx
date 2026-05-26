'use client';

// ─── Topics Management Page ──────────────────────────────────
// Lists and manages topics for a specific exam+subject pair.
// Each topic row expands to show 4 difficulty-level decks with
// card counts, drill-down links, and find-or-create actions.
//
// Routes wired:
//   GET    /api/admin/exams/:examId/subjects/:subjectId/topics
//   POST   /api/admin/exams/:examId/subjects/:subjectId/topics
//   PATCH  /api/admin/exams/:examId/subjects/:subjectId/topics/:topicId
//   DELETE /api/admin/exams/:examId/subjects/:subjectId/topics/:topicId
//   POST   /api/admin/exams/:examId/subjects/:subjectId/topics/bulk
//   GET    /api/admin/exams/:examId/subjects/:subjectId/topics/:topicSlug/decks  ← (Phase 2A)
//   POST   /api/admin/exams/:examId/subjects/:subjectId/topics/:topicSlug/levels/:level/deck  ← find-or-create

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, ErrorBanner } from '@/components/page-shell';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { ArrowLeft, Plus, Pencil, Trash2, Upload, X, ChevronDown, ChevronRight, BookOpen, Layers } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface Topic {
  id: string;
  slug: string;
  displayName: string;
  order: number;
}

interface TopicsResponse {
  subjectId: string;
  subjectName: string;
  topics: Topic[];
}

interface LevelDeck {
  level: 'Emerging' | 'Developing' | 'Proficient' | 'Master';
  deckId: string | null;
  cardCount: number;
  exists: boolean;
}

interface TopicDecksResponse {
  examId: string;
  subjectId: string;
  topicSlug: string;
  levels: LevelDeck[];
}

const LEVEL_COLORS: Record<LevelDeck['level'], { bg: string; text: string; badge: string }> = {
  Emerging:   { bg: 'bg-sky-950/40',     text: 'text-sky-300',     badge: 'border-sky-800/50 text-sky-400' },
  Developing: { bg: 'bg-violet-950/40',  text: 'text-violet-300',  badge: 'border-violet-800/50 text-violet-400' },
  Proficient: { bg: 'bg-amber-950/40',   text: 'text-amber-300',   badge: 'border-amber-800/50 text-amber-400' },
  Master:     { bg: 'bg-rose-950/40',    text: 'text-rose-300',    badge: 'border-rose-800/50 text-rose-400' },
};

const INPUT  = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL  = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Topic Modal (create / edit) ──────────────────────────────

function TopicModal({
  topic,
  examId,
  subjectId,
  onClose,
  onSaved,
}: {
  topic: Topic | null;
  examId: string;
  subjectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!topic;
  const [form, setForm] = useState({
    slug:        topic?.slug        ?? '',
    displayName: topic?.displayName ?? '',
    order:       topic?.order       ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: k === 'order' ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug || !form.displayName) { setError('Slug and display name are required.'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await adminApi.patch(
          `/api/admin/exams/${examId}/subjects/${subjectId}/topics/${topic!.id}`,
          form,
        );
      } else {
        await adminApi.post(
          `/api/admin/exams/${examId}/subjects/${subjectId}/topics`,
          form,
        );
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? `Failed to ${isEdit ? 'update' : 'create'} topic.`);
    }
    finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Topic' : 'New Topic'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className={LABEL}>Display name *</label>
            <input value={form.displayName} onChange={set('displayName')} placeholder="e.g. Modern Indian History" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Slug * <span className="text-zinc-600">(kebab-case)</span></label>
            <input value={form.slug} onChange={set('slug')} placeholder="e.g. modern-indian-history" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Order</label>
            <input type="number" min={0} value={form.order} onChange={set('order')} className={INPUT} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────

function BulkImportModal({
  examId,
  subjectId,
  onClose,
  onImported,
}: {
  examId: string;
  subjectId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [raw, setRaw]         = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState<{ inserted: number; skipped: number } | null>(null);

  const PLACEHOLDER = JSON.stringify([
    { slug: 'polity-basics', displayName: 'Polity Basics', order: 0 },
    { slug: 'indian-constitution', displayName: 'Indian Constitution', order: 1 },
  ], null, 2);

  const handleImport = async () => {
    setSaving(true); setError(''); setResult(null);
    try {
      const topics = JSON.parse(raw);
      if (!Array.isArray(topics)) throw new Error('Input must be a JSON array');
      const res = await adminApi.post<{ data: { inserted: number; skipped: number } }>(
        `/api/admin/exams/${examId}/subjects/${subjectId}/topics/bulk`,
        { topics },
      );
      setResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message
        ?? (err as { message?: string })?.message
        ?? 'Import failed.';
      setError(msg);
    }
    finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Bulk Import Topics</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        {result && (
          <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl px-4 py-3 mb-4">
            ✓ Inserted {result.inserted}, skipped {result.skipped} duplicates
          </div>
        )}
        <p className="text-xs text-zinc-500 mb-3">Paste a JSON array of topics. Slugs must be unique kebab-case.</p>
        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button disabled={saving || !raw.trim()} onClick={handleImport} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Importing…' : 'Import'}
            </button>
          )}
          {result && (
            <button onClick={() => { onImported(); onClose(); }} className="flex-1 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Topic Row (with expandable deck levels) ──────────────────

function TopicRow({
  topic,
  examId,
  subjectId,
  deleting,
  onEdit,
  onDelete,
  router,
}: {
  topic: Topic;
  examId: string;
  subjectId: string;
  deleting: string | null;
  onEdit: (t: Topic) => void;
  onDelete: (t: Topic) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [decksData, setDecksData]       = useState<TopicDecksResponse | null>(null);
  const [decksLoading, setDecksLoading] = useState(false);
  const [creating, setCreating]         = useState<string | null>(null);

  const loadDecks = useCallback(async () => {
    if (decksData) return; // cache after first load
    setDecksLoading(true);
    try {
      const res = await adminApi.get<{ data: TopicDecksResponse }>(
        `/api/admin/exams/${examId}/subjects/${subjectId}/topics/${topic.slug}/decks`,
      );
      setDecksData(res.data.data);
    } catch {
      // silently fail — user can collapse and re-expand
    } finally {
      setDecksLoading(false);
    }
  }, [decksData, examId, subjectId, topic.slug]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadDecks();
  };

  const handleCreateDeck = async (level: string) => {
    setCreating(level);
    try {
      const res = await adminApi.post<{ data: { deckId: string; cardCount: number } }>(
        `/api/admin/exams/${examId}/subjects/${subjectId}/topics/${topic.slug}/levels/${level}/deck`,
      );
      // Refresh decks so the new row appears
      setDecksData(null); // bust cache
      const refreshed = await adminApi.get<{ data: TopicDecksResponse }>(
        `/api/admin/exams/${examId}/subjects/${subjectId}/topics/${topic.slug}/decks`,
      );
      setDecksData(refreshed.data.data);
      // Navigate directly to the newly created deck
      router.push(`/decks/${res.data.data.deckId}`);
    } catch {
      // ignore
    } finally {
      setCreating(null);
    }
  };

  const covered = decksData ? decksData.levels.filter(l => l.exists).length : 0;

  return (
    <>
      {/* ── Main topic row ── */}
      <tr className="bg-zinc-900 hover:bg-zinc-800/40 transition">
        <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{topic.order}</td>
        <td className="px-4 py-3">
          <button
            onClick={handleExpand}
            className="flex items-center gap-2 font-medium text-white hover:text-violet-300 transition text-left group"
          >
            <span className="text-zinc-600 group-hover:text-violet-400 transition">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            {topic.displayName}
          </button>
        </td>
        <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{topic.slug}</td>
        <td className="px-4 py-3">
          {decksData ? (
            <span className={`text-xs font-medium tabular-nums ${covered === 4 ? 'text-emerald-400' : covered > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
              {covered}/4
            </span>
          ) : (
            <span className="text-xs text-zinc-700">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onEdit(topic)}
              className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"
              title="Edit topic"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(topic)}
              disabled={deleting === topic.id}
              className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"
              title="Delete topic"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {/* ── Expandable level rows ── */}
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="bg-zinc-950/60 border-t border-b border-zinc-800/80 px-6 py-3">
              {decksLoading ? (
                <div className="flex items-center gap-2 py-2 text-xs text-zinc-500">
                  <Spinner size="sm" /> Loading decks…
                </div>
              ) : !decksData ? (
                <p className="text-xs text-zinc-600 py-2">Failed to load deck data.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {decksData.levels.map(ld => {
                    const colors = LEVEL_COLORS[ld.level];
                    return (
                      <div
                        key={ld.level}
                        className={`rounded-xl border px-4 py-3 flex flex-col gap-1.5 ${colors.bg} ${colors.badge} border`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${colors.text}`}>{ld.level}</span>
                          {ld.exists && (
                            <span className="text-xs text-zinc-500 tabular-nums">{ld.cardCount} cards</span>
                          )}
                        </div>
                        {ld.exists && ld.deckId ? (
                          <button
                            onClick={() => router.push(`/decks/${ld.deckId}`)}
                            className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
                          >
                            <BookOpen size={11} /> View Cards
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCreateDeck(ld.level)}
                            disabled={creating === ld.level}
                            className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600 hover:text-violet-400 transition disabled:opacity-50"
                          >
                            <Layers size={11} />
                            {creating === ld.level ? 'Creating…' : 'Create Deck'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Tiny inline Spinner (accepts size prop) ──────────────────
function Spinner({ size = 'default' }: { size?: 'sm' | 'default' }) {
  const sz = size === 'sm' ? 'h-3 w-3' : 'h-6 w-6';
  return (
    <svg className={`${sz} animate-spin text-violet-500`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function TopicsPage() {
  const { examId, subjectId } = useParams<{ examId: string; subjectId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData]       = useState<TopicsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | 'bulk' | Topic>(false);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const fetchTopics = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: TopicsResponse }>(
        `/api/admin/exams/${examId}/subjects/${subjectId}/topics`,
      );
      setData(res.data.data);
    } catch { setError('Failed to load topics.'); }
    finally { setLoading(false); }
  }, [examId, subjectId]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/exams/${examId}/subjects/${subjectId}/topics/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.displayName}" deleted`);
      setDeleteTarget(null);
      await fetchTopics();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setDeleteError(msg ?? 'Failed to delete topic.');
    }
    finally { setDeleting(null); }
  };

  const sorted = data?.topics.slice().sort((a, b) => a.order - b.order) ?? [];

  return (
    <PageShell
      title={data ? `Topics — ${data.subjectName}` : 'Topics'}
      subtitle={data ? `${sorted.length} topic${sorted.length !== 1 ? 's' : ''}` : ''}
      breadcrumbs={[
        { label: 'Exams', href: '/exams' },
        { label: 'Exam', href: `/exams/${examId}` },
        { label: data?.subjectName ?? 'Subject', href: `/exams/${examId}` },
        { label: 'Topics' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/exams/${examId}`)}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft size={14} /> Exam
          </button>
          <button
            onClick={() => setModal('bulk')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition"
          >
            <Upload size={13} /> Bulk Import
          </button>
          <button
            onClick={() => setModal('new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={14} /> New Topic
          </button>
        </div>
      }
    >
      {/* Modals */}
      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <TopicModal
          topic={typeof modal === 'object' ? modal : null}
          examId={examId}
          subjectId={subjectId}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); fetchTopics(); }}
        />
      )}
      {modal === 'bulk' && (
        <BulkImportModal
          examId={examId}
          subjectId={subjectId}
          onClose={() => setModal(false)}
          onImported={fetchTopics}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Topic"
          description={`Delete "${deleteTarget.displayName}"? This will fail if decks exist under it.`}
          confirmLabel="Delete Topic"
          destructive
          loading={deleting !== null}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}

      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : sorted.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-600 text-sm">
          No topics yet. Click &ldquo;New Topic&rdquo; or use &ldquo;Bulk Import&rdquo;.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider w-16">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Display Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider w-20" title="Decks created (out of 4 levels)">Decks</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {sorted.map(topic => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  examId={examId}
                  subjectId={subjectId}
                  deleting={deleting}
                  onEdit={t => setModal(t)}
                  onDelete={t => { setDeleteTarget(t); setDeleteError(''); }}
                  router={router}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
