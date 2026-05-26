'use client';

// ─── Deck Detail + Flashcards Page ───────────────────────────
// Full CRUD for flashcards within a deck.
// Works for mastery, shop, and standalone decks.
// Mastery decks show a hierarchy breadcrumb (Exam → Subject → Topic → Level).
//
// Routes wired:
//   GET    /api/admin/decks/:id/flashcards
//   GET    /api/admin/exams  (to resolve exam name for breadcrumb)
//   POST   /api/admin/decks/:id/flashcards
//   PUT    /api/admin/flashcards/:cardId
//   DELETE /api/admin/decks/:deckId/flashcards/:cardId
//   POST   /api/admin/decks/:id/flashcards/bulk

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { ArrowLeft, Plus, Pencil, Trash2, Upload, X, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface Option {
  id: string;
  text: string;
}

interface Flashcard {
  id: string;
  question: string;
  options: Option[];
  correctAnswerId: string;
  explanation?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  source?: string;
  sourceYear?: number;
  sourcePaper?: string;
}

interface DeckMeta {
  id: string;
  title: string;
  type: 'mastery' | 'shop' | 'standalone';
  examId?: string;
  subjectId?: string;
  topicSlug?: string;
  topicId?: string;
  level?: string;
  cardCount: number;
}

interface ExamRow {
  id: string;
  title: string;
}

interface SubjectRow {
  id: string;
  name: string;
}

interface Breadcrumb {
  examName?: string;
  examId?: string;
  subjectName?: string;
  subjectId?: string;
  topicSlug?: string;
  level?: string;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Card Modal (create / edit) ───────────────────────────────

function CardModal({
  deckId,
  card,
  onClose,
  onSaved,
}: {
  deckId: string;
  card: Flashcard | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!card;
  const defaultOptions = [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
  ];

  const [question, setQuestion]         = useState(card?.question ?? '');
  const [options, setOptions]           = useState<Option[]>(card?.options ?? defaultOptions);
  const [correctAnswerId, setCorrect]   = useState(card?.correctAnswerId ?? 'A');
  const [explanation, setExplanation]   = useState(card?.explanation ?? '');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const setOptionText = (idx: number, text: string) =>
    setOptions(opts => opts.map((o, i) => i === idx ? { ...o, text } : o));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || options.some(o => !o.text.trim())) {
      setError('Question and all option texts are required.');
      return;
    }
    setSaving(true); setError('');
    const payload = { question, options, correctAnswerId, explanation: explanation || null };
    try {
      if (isEdit) {
        await adminApi.put(`/api/admin/flashcards/${card!.id}`, payload);
      } else {
        await adminApi.post(`/api/admin/decks/${deckId}/flashcards`, payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? `Failed to ${isEdit ? 'update' : 'create'} flashcard.`);
    }
    finally { setSaving(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Flashcard' : 'New Flashcard'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div>
            <label className={LABEL}>Question *</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3} placeholder="Enter question text…" className={INPUT} />
          </div>

          <div>
            <label className={LABEL}>Answer Options *</label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-400 w-5 shrink-0">{opt.id}</span>
                  <input
                    value={opt.text}
                    onChange={e => setOptionText(idx, e.target.value)}
                    placeholder={`Option ${opt.id}`}
                    className={INPUT}
                  />
                  <input
                    type="radio"
                    name="correct"
                    value={opt.id}
                    checked={correctAnswerId === opt.id}
                    onChange={() => setCorrect(opt.id)}
                    className="accent-violet-500 shrink-0 w-4 h-4 cursor-pointer"
                    title="Mark as correct"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">Select the radio button next to the correct answer.</p>
          </div>

          <div>
            <label className={LABEL}>Explanation (optional)</label>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} placeholder="Why is this the correct answer?" className={INPUT} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────

function BulkImportModal({ deckId, onClose, onImported }: { deckId: string; onClose: () => void; onImported: () => void }) {
  const [raw, setRaw]       = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [result, setResult] = useState<{ created: number; requested: number } | null>(null);

  const PLACEHOLDER = JSON.stringify([{
    question: 'Which article of the constitution grants right to equality?',
    options: [
      { id: 'A', text: 'Article 12' },
      { id: 'B', text: 'Article 14' },
      { id: 'C', text: 'Article 19' },
      { id: 'D', text: 'Article 21' },
    ],
    correctAnswerId: 'B',
    explanation: 'Article 14 guarantees equality before law.',
    source: 'pyq',
    sourceYear: 2022,
  }], null, 2);

  const handleImport = async () => {
    setSaving(true); setError(''); setResult(null);
    try {
      const cards = JSON.parse(raw);
      if (!Array.isArray(cards)) throw new Error('Input must be a JSON array.');
      const res = await adminApi.post<{ data: { created: number; requested: number } }>(
        `/api/admin/decks/${deckId}/flashcards/bulk`,
        { cards },
      );
      setResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message
        ?? (err as { message?: string })?.message ?? 'Import failed.';
      setError(msg);
    }
    finally { setSaving(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Bulk Import Cards</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        {result && (
          <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-sm rounded-xl px-4 py-3 mb-4">
            ✓ Created {result.created} of {result.requested} cards
          </div>
        )}
        <p className="text-xs text-zinc-500 mb-3">Paste a JSON array of flashcard objects (max 100 per batch).</p>
        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={12}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => { onImported(); onClose(); }} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button disabled={saving || !raw.trim()} onClick={handleImport} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hierarchy Breadcrumb ─────────────────────────────────────

function HierarchyBreadcrumb({
  deck,
  router,
}: {
  deck: DeckMeta;
  router: ReturnType<typeof useRouter>;
}) {
  const [bc, setBc] = useState<Breadcrumb | null>(null);

  useEffect(() => {
    if (deck.type !== 'mastery' || !deck.examId) return;

    const resolve = async () => {
      try {
        const [examsRes, subjectsRes] = await Promise.all([
          adminApi.get<{ data: ExamRow[] }>('/api/admin/exams'),
          adminApi.get<{ data: SubjectRow[] }>('/api/admin/subjects'),
        ]);
        const exam    = examsRes.data.data.find(e => e.id === deck.examId);
        const subject = subjectsRes.data.data.find(s => s.id === deck.subjectId);
        setBc({
          examName:    exam?.title,
          examId:      deck.examId,
          subjectName: subject?.name,
          subjectId:   deck.subjectId,
          topicSlug:   deck.topicSlug,
          level:       deck.level,
        });
      } catch { /* silently fail */ }
    };
    resolve();
  }, [deck]);

  if (deck.type !== 'mastery' || !bc) return null;

  const LEVEL_COLORS: Record<string, string> = {
    Emerging: 'text-sky-400', Developing: 'text-violet-400', Proficient: 'text-amber-400', Master: 'text-rose-400',
  };

  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4 flex-wrap">
      <button
        onClick={() => router.push('/exams')}
        className="hover:text-zinc-300 transition"
      >Exams</button>
      {bc.examName && bc.examId && (
        <>
          <ChevronRight size={10} className="text-zinc-700" />
          <button onClick={() => router.push(`/exams/${bc.examId}`)} className="hover:text-zinc-300 transition truncate max-w-[140px]">
            {bc.examName}
          </button>
        </>
      )}
      {bc.subjectName && bc.examId && bc.subjectId && (
        <>
          <ChevronRight size={10} className="text-zinc-700" />
          <button
            onClick={() => router.push(`/exams/${bc.examId}/subjects/${bc.subjectId}/topics`)}
            className="hover:text-zinc-300 transition"
          >
            {bc.subjectName}
          </button>
        </>
      )}
      {bc.topicSlug && (
        <>
          <ChevronRight size={10} className="text-zinc-700" />
          <span className="font-mono">{bc.topicSlug}</span>
        </>
      )}
      {bc.level && (
        <>
          <ChevronRight size={10} className="text-zinc-700" />
          <span className={`font-semibold ${LEVEL_COLORS[bc.level] ?? 'text-zinc-400'}`}>{bc.level}</span>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function DeckFlashcardsPage() {
  const { id: deckId } = useParams<{ id: string }>();
  const router = useRouter();

  const [cards, setCards]     = useState<Flashcard[]>([]);
  const [deck, setDeck]       = useState<DeckMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | 'bulk' | Flashcard>(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [cardsRes, deckRes] = await Promise.all([
        adminApi.get<{ data: Flashcard[] }>(`/api/admin/decks/${deckId}/flashcards`),
        adminApi.get<{ data: DeckMeta }>(`/api/admin/decks/${deckId}`).catch(() => null),
      ]);
      setCards(cardsRes.data.data);
      if (deckRes) setDeck(deckRes.data.data);
    } catch { setError('Failed to load flashcards.'); }
    finally { setLoading(false); }
  }, [deckId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const [deleteTarget, setDeleteTarget] = useState<Flashcard | null>(null);
  const [deleteError, setDeleteError]   = useState('');
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/decks/${deckId}/flashcards/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success('Flashcard deleted');
      await fetchCards();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setDeleteError(msg ?? 'Failed to delete flashcard.');
    }
    finally { setDeleting(null); }
  };

  // Build context-aware back button label
  const backLabel = deck?.type === 'mastery' ? 'Topics' : 'Content Packs';
  const backHref  = deck?.type === 'mastery' && deck.examId && deck.subjectId
    ? `/exams/${deck.examId}/subjects/${deck.subjectId}/topics`
    : '/decks';

  return (
    <PageShell
      title={deck?.title ?? 'Flashcards'}
      subtitle={`${cards.length} card${cards.length !== 1 ? 's' : ''}`}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(backHref)} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition">
            <ArrowLeft size={14} /> {backLabel}
          </button>
          <button onClick={() => setModal('bulk')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition">
            <Upload size={13} /> Bulk Import
          </button>
          <button onClick={() => setModal('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
            <Plus size={14} /> Add Card
          </button>
        </div>
      }
    >
      {/* Modals */}
      {(modal === 'new' || (modal && typeof modal === 'object' && 'question' in modal)) && (
        <CardModal
          deckId={deckId}
          card={typeof modal === 'object' ? modal as Flashcard : null}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); fetchCards(); }}
        />
      )}
      {modal === 'bulk' && (
        <BulkImportModal deckId={deckId} onClose={() => setModal(false)} onImported={fetchCards} />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Flashcard"
          description="Are you sure you want to delete this flashcard? This cannot be undone."
          confirmLabel="Delete Card"
          destructive
          loading={!!deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}

      {/* Hierarchy breadcrumb for mastery decks */}
      {deck && <HierarchyBreadcrumb deck={deck} router={router} />}

      {/* Deck type badge */}
      {deck && deck.type !== 'mastery' && (
        <div className="mb-4">
          <Badge label={deck.type === 'shop' ? 'Shop Pack' : 'Standalone'} variant="zinc" />
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : cards.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-600 text-sm">
          No flashcards yet. Click &ldquo;Add Card&rdquo; or use &ldquo;Bulk Import&rdquo;.
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-white font-medium leading-relaxed flex-1">{card.question}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {card.source && (
                    <Badge
                      label={card.source === 'pyq' ? `PYQ ${card.sourceYear ?? ''}`.trim() : card.source}
                      variant={card.source === 'pyq' ? 'yellow' : 'zinc'}
                    />
                  )}
                  <button onClick={() => setModal(card)} className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"><Pencil size={13} /></button>
                  <button onClick={() => { setDeleteTarget(card); setDeleteError(''); }} disabled={deleting === card.id} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"><Trash2 size={13} /></button>
                </div>
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
                    <span>{opt.text}</span>
                  </div>
                ))}
              </div>

              {card.explanation && (
                <p className="mt-2 text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3">{card.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
