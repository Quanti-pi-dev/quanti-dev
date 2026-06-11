'use client';

// ─── PYQ Page ──────────────────────
// GET    /api/admin/pyq          (paginated browse with filters)
// GET    /api/admin/pyq/meta     (year + paper filter options)
// POST   /api/admin/pyq/bulk     (bulk import with deck auto-create)
// DELETE /api/admin/pyq/:cardId
//
// BulkImportModal uses cascading dropdowns:
//   Step 1 → Pick Exam   (GET /api/admin/exams)
//   Step 2 → Pick Subject (GET /api/admin/exams/:id/subjects)
//   Step 3 → Pick Topic  (GET /api/admin/exams/:examId/subjects/:subjectId/topics)
//   Step 4 → Metadata + JSON cards

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner } from '@/components/page-shell';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { Latex } from '@/components/latex';
import { Upload, Trash2, X, ChevronLeft, ChevronRight, Check, Search, BookOpen } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

interface PYQCard {
  id: string; deckId: string; question: string;
  options: Array<{ id: string; text: string; imageUrl?: string | null }>;
  correctAnswerId: string; explanation: string | null;
  imageUrl?: string | null;
  explanationImageUrl?: string | null;
  sourceYear: number | null; sourcePaper: string | null;
  tags: string[]; createdAt: string;
}
interface PYQMeta { years: number[]; papers: string[]; total: number; }
interface Pagination { page: number; pageSize: number; totalItems: number; totalPages: number; }
interface ExamOption { id: string; title: string; category: string; }
interface SubjectOption { subjectId: string; subject: { id: string; name: string } | null; }
interface TopicOption { id: string; slug: string; displayName: string; }

const INPUT = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';
const SUBJECT_LEVELS = ['easy', 'medium', 'hard', 'expert', 'mixed', 'pyq'] as const;

function apiError(err: unknown) {
  return (err as { response?: { data?: { error?: { message?: string } } }; message?: string })
    ?.response?.data?.error?.message ?? (err as { message?: string })?.message ?? 'Unknown error';
}

// ─── Searchable Exam List ─────────────────────────────────────

function ExamPicker({ exams, loading, selected, onSelect }: {
  exams: ExamOption[]; loading: boolean;
  selected: ExamOption | null; onSelect: (e: ExamOption) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(q.toLowerCase()) ||
    e.category.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search exams…"
          className={`${INPUT} w-full pl-8`} autoFocus />
      </div>
      {loading ? <p className="text-xs text-zinc-500 py-4 text-center">Loading…</p>
        : filtered.length === 0 ? <p className="text-xs text-zinc-500 py-4 text-center">No exams found</p>
          : (
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {filtered.map(ex => (
                <button key={ex.id} onClick={() => onSelect(ex)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${selected?.id === ex.id
                      ? 'border-violet-500 bg-violet-600/10 text-white'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:text-white'
                    }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ex.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{ex.category}</span>
                      {selected?.id === ex.id && <Check size={13} className="text-violet-400" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
    </div>
  );
}

// ─── Bulk Import Modal ───────────────────────────────

function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  // cascading state
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamOption | null>(null);

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);

  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TopicOption | null>(null);

  // metadata + cards
  const [level, setLevel] = useState<typeof SUBJECT_LEVELS[number]>('pyq');
  const [sourceYear, setSourceYear] = useState(new Date().getFullYear());
  const [sourcePaper, setSourcePaper] = useState('');
  const [examLabel, setExamLabel] = useState('');
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; requested: number; deckId: string } | null>(null);

  // load exams
  useEffect(() => {
    setExamsLoading(true);
    adminApi.get<{ data: ExamOption[] }>('/api/admin/exams?pageSize=200')
      .then(r => setExams(r.data.data))
      .catch(() => { })
      .finally(() => setExamsLoading(false));
  }, []);

  // load subjects when exam changes
  useEffect(() => {
    if (!selectedExam) { setSubjects([]); setSelectedSubject(null); return; }
    setSubjectsLoading(true);
    adminApi.get<{ data: SubjectOption[] }>(`/api/admin/exams/${selectedExam.id}/subjects`)
      .then(r => setSubjects(r.data.data))
      .catch(() => setSubjects([]))
      .finally(() => setSubjectsLoading(false));
    setSelectedSubject(null); setSelectedTopic(null); setTopics([]);
  }, [selectedExam]);

  // load topics when subject changes
  useEffect(() => {
    if (!selectedExam || !selectedSubject) { setTopics([]); setSelectedTopic(null); return; }
    setTopicsLoading(true);
    adminApi.get<{ data: { topics: TopicOption[] } }>(
      `/api/admin/exams/${selectedExam.id}/subjects/${selectedSubject.subjectId}/topics`,
    ).then(r => setTopics(r.data.data.topics))
      .catch(() => setTopics([]))
      .finally(() => setTopicsLoading(false));
    setSelectedTopic(null);
  }, [selectedExam, selectedSubject]);

  const handleImport = async () => {
    if (!selectedExam || !selectedSubject || !selectedTopic) {
      setError('Please select Exam, Subject and Topic.'); return;
    }
    setSaving(true); setError(''); setResult(null);
    try {
      const cards = JSON.parse(raw);
      if (!Array.isArray(cards)) throw new Error('Input must be a JSON array.');
      const payload = {
        examId: selectedExam.id,
        subjectId: selectedSubject.subjectId,
        topicSlug: selectedTopic.slug,
        level, sourceYear, sourcePaper, examLabel, cards,
      };
      const res = await adminApi.post<{ data: { created: number; requested: number; deckId: string } }>(
        '/api/admin/pyq/bulk', payload,
      );
      setResult(res.data.data);
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  };

  // Tags MUST start with the deck's topicSlug as a prefix (Option A contract).
  // e.g. topicSlug="fundamental-rights" → tags=["fundamental-rights-article14"]
  const PLACEHOLDER = JSON.stringify([{
    question: 'Which article guarantees right to equality?',
    options: [
      { id: 'A', text: 'Article 12' }, { id: 'B', text: 'Article 14', imageUrl: 'https://…/img.png' },
      { id: 'C', text: 'Article 19' }, { id: 'D', text: 'Article 21' },
    ],
    correctAnswerId: 'B',
    explanation: 'Article 14 guarantees equality before law.',
    tags: ['fundamental-rights-article14', 'fundamental-rights-equality'],
    imageUrl: 'https://…/question.png',
    explanationImageUrl: 'https://…/explanation.png',
  }], null, 2);

  const ready = !!selectedExam && !!selectedSubject && !!selectedTopic && raw.trim().length > 0;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-6 px-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Bulk Import PYQ Cards</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>

        {error && <ErrorBanner message={error} />}

        {result ? (
          <div className="space-y-4">
            <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl px-4 py-3">
              ✓ Imported {result.created} of {result.requested} cards into deck{' '}
              <span className="font-mono text-xs">{result.deckId.slice(0, 12)}…</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { onImported(); onClose(); }}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition">Done</button>
              <button onClick={() => setResult(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Import More</button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── Row 1: Exam picker ── */}
            <div>
              <label className={LABEL}>
                <BookOpen size={11} className="inline mr-1 mb-0.5" />Exam *
              </label>
              <ExamPicker exams={exams} loading={examsLoading} selected={selectedExam} onSelect={setSelectedExam} />
            </div>

            {/* ── Row 2: Subject + Topic (shown after exam selected) ── */}
            {selectedExam && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Subject *</label>
                  {subjectsLoading ? <p className="text-xs text-zinc-500 py-2">Loading…</p> : (
                    <select value={selectedSubject?.subjectId ?? ''}
                      onChange={e => {
                        const s = subjects.find(s => s.subjectId === e.target.value) ?? null;
                        setSelectedSubject(s);
                      }}
                      className={`${INPUT} w-full`}>
                      <option value="">— Select subject —</option>
                      {subjects.map(s => (
                        <option key={s.subjectId} value={s.subjectId}>
                          {s.subject?.name ?? s.subjectId}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={LABEL}>Topic *</label>
                  {topicsLoading ? <p className="text-xs text-zinc-500 py-2">Loading…</p> : (
                    <select value={selectedTopic?.slug ?? ''}
                      onChange={e => {
                        const t = topics.find(t => t.slug === e.target.value) ?? null;
                        setSelectedTopic(t);
                      }}
                      disabled={!selectedSubject}
                      className={`${INPUT} w-full disabled:opacity-40`}>
                      <option value="">— Select topic —</option>
                      {topics.map(t => (
                        <option key={t.slug} value={t.slug}>{t.displayName}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* ── Row 3: Level + Year + Paper + Label ── */}
            {selectedTopic && (
              <>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className={LABEL}>Level</label>
                    <select value={level} onChange={e => setLevel(e.target.value as typeof SUBJECT_LEVELS[number])}
                      className={`${INPUT} w-full`}>
                      {SUBJECT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Year *</label>
                    <input type="number" min={1990} max={2099} value={sourceYear}
                      onChange={e => setSourceYear(Number(e.target.value))}
                      className={`${INPUT} w-full`} />
                  </div>
                  <div>
                    <label className={LABEL}>Paper</label>
                    <input value={sourcePaper} onChange={e => setSourcePaper(e.target.value)}
                      placeholder="e.g. Paper I" className={`${INPUT} w-full`} />
                  </div>
                  <div>
                    <label className={LABEL}>Exam Label</label>
                    <input value={examLabel} onChange={e => setExamLabel(e.target.value)}
                      placeholder="e.g. UPSC CSE" className={`${INPUT} w-full`} />
                  </div>
                </div>

                {/* Selected context pill */}
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="bg-violet-600/15 border border-violet-500/30 text-violet-400 px-2.5 py-1 rounded-full">{selectedExam?.title}</span>
                  <span className="text-zinc-600">›</span>
                  <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 px-2.5 py-1 rounded-full">{selectedSubject?.subject?.name}</span>
                  <span className="text-zinc-600">›</span>
                  <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 px-2.5 py-1 rounded-full">{selectedTopic.displayName}</span>
                </div>

                {/* Cards JSON */}
                <div>
                  <label className={LABEL}>
                    Cards JSON — array of questions (max 500 per call).
                    <span className="text-zinc-600 font-normal ml-1">Supports LaTeX in question/options via $…$</span>
                    <span className="text-amber-500/80 font-normal ml-1">· Tags must start with the topic slug as a prefix (e.g. <code className="font-mono">kinematics-velocity</code>).</span>
                  </label>
                  <textarea value={raw} onChange={e => setRaw(e.target.value)}
                    placeholder={PLACEHOLDER} rows={10}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
              <button disabled={saving || !ready} onClick={handleImport}
                className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-40">
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
  const [cards, setCards] = useState<PYQCard[]>([]);
  const [meta, setMeta] = useState<PYQMeta | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [year, setYear] = useState('');
  const [paper, setPaper] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const { toast } = useToast();
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
    if (year) params.set('year', year);
    if (paper) params.set('paper', paper);
    try {
      const res = await adminApi.get<{ data: { cards: PYQCard[]; pagination: Pagination } }>(
        `/api/admin/pyq?${params}`,
      );
      setCards(res.data.data.cards);
      setPagination(res.data.data.pagination);
    } catch { setError('Failed to load PYQ cards.'); } finally { setLoading(false); }
  }, [year, paper]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { setPage(1); fetchCards(1); }, [fetchCards]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/pyq/${deleteTarget}`);
      setDeleteTarget(null);
      toast.success('PYQ card deleted');
      await fetchCards(page);
    } catch (err: unknown) {
      setDeleteError(apiError(err));
    } finally { setDeleting(null); }
  };

  return (
    <PageShell
      title="PYQ Cards"
      subtitle={meta ? `${meta.total.toLocaleString()} total PYQ questions` : 'Previous Year Questions'}
      actions={
        <button onClick={() => setShowBulk(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
          <Upload size={14} /> Bulk Import
        </button>
      }
    >
      {showBulk && (
        <BulkImportModal
          onClose={() => setShowBulk(false)}
          onImported={() => { fetchMeta(); fetchCards(1); }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete PYQ Card"
          description="Are you sure you want to permanently delete this PYQ card?"
          confirmLabel="Delete Card" destructive
          loading={deleting === deleteTarget} error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}

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
          <button onClick={() => { setYear(''); setPaper(''); }}
            className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition">
            Clear filters
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : cards.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-600 text-sm">
          No PYQ cards found. Try &ldquo;Bulk Import&rdquo; to add some.
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {card.sourceYear && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-950/50 text-yellow-400 border border-yellow-800/50">{card.sourceYear}</span>
                    )}
                    {card.sourcePaper && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{card.sourcePaper}</span>
                    )}
                  </div>
                  <div className="text-sm text-white font-medium leading-relaxed">
                    <Latex text={card.question} />
                  </div>
                  {card.imageUrl && (
                    <img src={card.imageUrl} alt="Question" className="mt-2 rounded-lg border border-zinc-800 max-h-24 object-contain" />
                  )}
                </div>
                <button onClick={() => { setDeleteTarget(card.id); setDeleteError(''); }}
                  disabled={deleting === card.id}
                  className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                {card.options.map(opt => (
                  <div key={opt.id}
                    className={`px-3 py-1.5 rounded-lg text-xs ${opt.id === card.correctAnswerId
                        ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                        : 'bg-zinc-800/60 text-zinc-400'
                      }`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold shrink-0">{opt.id}.</span>
                      <span className="truncate"><Latex text={opt.text} /></span>
                    </div>
                    {opt.imageUrl && (
                      <img src={opt.imageUrl} alt={`Option ${opt.id}`} className="mt-1 ml-5 rounded max-h-14 object-contain" />
                    )}
                  </div>
                ))}
              </div>
              {(card.explanation || card.explanationImageUrl) && (
                <div className="mt-2 text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3 line-clamp-2">
                  {card.explanation && <Latex text={card.explanation} />}
                  {card.explanationImageUrl && (
                    <img src={card.explanationImageUrl} alt="Explanation" className="mt-1 rounded max-h-16 object-contain" />
                  )}
                </div>
              )}
            </div>
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-zinc-500">
                {pagination.totalItems.toLocaleString()} cards · Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchCards(page - 1); }}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page >= pagination.totalPages} onClick={() => { setPage(p => p + 1); fetchCards(page + 1); }}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition disabled:opacity-30">
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
