'use client';

// ─── PYQ (Previous Year Questions) Page ──────────────────────
// Browse, bulk-import, and delete PYQ flashcards.
// Routes wired:
//   GET    /api/admin/pyq          (paginated browse with filters)
//   GET    /api/admin/pyq/meta     (year + paper filter options)
//   POST   /api/admin/pyq/bulk     (bulk import with deck auto-create)
//   DELETE /api/admin/pyq/:cardId

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner } from '@/components/page-shell';
import { Upload, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface PYQCard {
  id: string;
  deckId: string;
  question: string;
  options: Array<{ id: string; text: string }>;
  correctAnswerId: string;
  explanation: string | null;
  sourceYear: number | null;
  sourcePaper: string | null;
  tags: string[];
  createdAt: string;
}

interface PYQMeta {
  years: number[];
  papers: string[];
  total: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

const INPUT = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

const SUBJECT_LEVELS = ['easy', 'medium', 'hard', 'expert', 'mixed', 'pyq'] as const;

// ─── Bulk Import Modal ────────────────────────────────────────

function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [form, setForm] = useState({
    examId:     '',
    subjectId:  '',
    topicSlug:  '',
    level:      'pyq' as typeof SUBJECT_LEVELS[number],
    sourceYear: new Date().getFullYear(),
    sourcePaper: '',
    examLabel:   '',
  });
  const [raw, setRaw]       = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [result, setResult] = useState<{ created: number; requested: number; deckId: string } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: k === 'sourceYear' ? Number(e.target.value) : e.target.value }));

  const PLACEHOLDER = JSON.stringify([{
    question: 'Which article guarantees right to equality?',
    options: [
      { id: 'A', text: 'Article 12' },
      { id: 'B', text: 'Article 14' },
      { id: 'C', text: 'Article 19' },
      { id: 'D', text: 'Article 21' },
    ],
    correctAnswerId: 'B',
    explanation: 'Article 14 guarantees equality before law.',
  }], null, 2);

  const handleImport = async () => {
    if (!form.examId || !form.subjectId || !form.topicSlug) { setError('Exam ID, Subject ID and Topic Slug are required.'); return; }
    setSaving(true); setError(''); setResult(null);
    try {
      const cards = JSON.parse(raw);
      if (!Array.isArray(cards)) throw new Error('Input must be a JSON array.');
      const payload = { ...form, cards };
      const res = await adminApi.post<{ data: { created: number; requested: number; deckId: string } }>('/api/admin/pyq/bulk', payload);
      setResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message
        ?? (err as { message?: string })?.message ?? 'Import failed.';
      setError(msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-6">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Bulk Import PYQ Cards</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        {result ? (
          <div className="space-y-4">
            <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl px-4 py-3">
              ✓ Imported {result.created} of {result.requested} cards into deck <span className="font-mono text-xs">{result.deckId.slice(0, 12)}…</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { onImported(); onClose(); }} className="flex-1 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition">Done</button>
              <button onClick={() => setResult(null)} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Import More</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target fields */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LABEL}>Exam ID *</label><input value={form.examId} onChange={set('examId')} placeholder="MongoDB ObjectId" className={`${INPUT} w-full`} /></div>
              <div><label className={LABEL}>Subject ID *</label><input value={form.subjectId} onChange={set('subjectId')} placeholder="MongoDB ObjectId" className={`${INPUT} w-full`} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LABEL}>Topic Slug *</label><input value={form.topicSlug} onChange={set('topicSlug')} placeholder="e.g. polity-basics" className={`${INPUT} w-full`} /></div>
              <div>
                <label className={LABEL}>Level</label>
                <select value={form.level} onChange={set('level')} className={`${INPUT} w-full`}>
                  {SUBJECT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={LABEL}>Source Year *</label><input type="number" min={1990} max={2099} value={form.sourceYear} onChange={set('sourceYear')} className={`${INPUT} w-full`} /></div>
              <div><label className={LABEL}>Source Paper</label><input value={form.sourcePaper} onChange={set('sourcePaper')} placeholder="e.g. Paper I" className={`${INPUT} w-full`} /></div>
              <div><label className={LABEL}>Exam Label</label><input value={form.examLabel} onChange={set('examLabel')} placeholder="e.g. UPSC CSE" className={`${INPUT} w-full`} /></div>
            </div>

            {/* Cards JSON */}
            <div>
              <label className={LABEL}>Cards JSON (array, max 500 per call)</label>
              <textarea
                value={raw}
                onChange={e => setRaw(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={10}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
              <button disabled={saving || !raw.trim()} onClick={handleImport} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
                {saving ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function PYQPage() {
  const [cards, setCards]       = useState<PYQCard[]>([]);
  const [meta, setMeta]         = useState<PYQMeta | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filters
  const [year, setYear]   = useState('');
  const [paper, setPaper] = useState('');
  const [page, setPage]   = useState(1);
  const PAGE_SIZE = 20;

  const fetchMeta = useCallback(async () => {
    try {
      const res = await adminApi.get<{ data: PYQMeta }>('/api/admin/pyq/meta');
      setMeta(res.data.data);
    } catch { /* non-critical */ }
  }, []);

  const fetchCards = useCallback(async (pg = 1) => {
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(pg), pageSize: String(PAGE_SIZE) });
    if (year)  params.set('year', year);
    if (paper) params.set('paper', paper);
    try {
      const res = await adminApi.get<{ data: { cards: PYQCard[]; pagination: Pagination } }>(`/api/admin/pyq?${params}`);
      setCards(res.data.data.cards);
      setPagination(res.data.data.pagination);
    } catch { setError('Failed to load PYQ cards.'); } finally { setLoading(false); }
  }, [year, paper]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { setPage(1); fetchCards(1); }, [fetchCards]);

  const handleDelete = async (cardId: string) => {
    if (!confirm('Delete this PYQ card permanently?')) return;
    setDeleting(cardId); setError('');
    try { await adminApi.delete(`/api/admin/pyq/${cardId}`); await fetchCards(page); }
    catch (err: unknown) {
      setError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to delete card.');
    } finally { setDeleting(null); }
  };

  const handlePageChange = (newPage: number) => { setPage(newPage); fetchCards(newPage); };

  return (
    <PageShell
      title="PYQ Cards"
      subtitle={meta ? `${meta.total.toLocaleString()} total PYQ questions` : 'Previous Year Questions'}
      actions={
        <button onClick={() => setShowBulk(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
          <Upload size={14} /> Bulk Import
        </button>
      }
    >
      {showBulk && <BulkImportModal onClose={() => setShowBulk(false)} onImported={() => { fetchMeta(); fetchCards(1); }} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={year} onChange={e => setYear(e.target.value)} className={`${INPUT} min-w-32`}>
          <option value="">All Years</option>
          {meta?.years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={paper} onChange={e => setPaper(e.target.value)} className={`${INPUT} min-w-40`}>
          <option value="">All Papers</option>
          {meta?.papers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(year || paper) && (
          <button onClick={() => { setYear(''); setPaper(''); }} className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition">
            Clear filters
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : cards.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-600 text-sm">
          No PYQ cards found for these filters. Try "Bulk Import" to add some.
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {card.sourceYear && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-950/50 text-yellow-400 border border-yellow-800/50">{card.sourceYear}</span>}
                    {card.sourcePaper && <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{card.sourcePaper}</span>}
                  </div>
                  <p className="text-sm text-white font-medium leading-relaxed">{card.question}</p>
                </div>
                <button
                  onClick={() => handleDelete(card.id)}
                  disabled={deleting === card.id}
                  className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                {card.options.map(opt => (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                      opt.id === card.correctAnswerId
                        ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                        : 'bg-zinc-800/60 text-zinc-400'
                    }`}
                  >
                    <span className="font-bold shrink-0">{opt.id}.</span>
                    <span className="truncate">{opt.text}</span>
                  </div>
                ))}
              </div>
              {card.explanation && (
                <p className="mt-2 text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3 line-clamp-2">{card.explanation}</p>
              )}
            </div>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-zinc-500">{pagination.totalItems.toLocaleString()} cards · Page {pagination.page} of {pagination.totalPages}</p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
