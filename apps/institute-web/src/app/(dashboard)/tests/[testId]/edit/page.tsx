'use client';

// ─── Test Question Editor ──────────────────────────────────────
// Wires:
//   GET  /api/inst/v1/institutes/:id/tests/:testId        — fetch test + current questions
//   GET  /api/inst/v1/institutes/:id/pool/questions       — browse pool (filter by subjectId)
//   POST /api/inst/v1/institutes/:id/tests/:testId/questions — save question set
//
// Strategy: load pool → let educator select → POST with replace:true

import { use, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Search, Check, X, Save, Plus, Trash2,
  AlertCircle, BookOpen,
} from 'lucide-react';
import { Latex } from '@/components/latex';

// ─── Types ────────────────────────────────────────────────────

interface PoolQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation?: string | null;
  marks: number;
  subjectId?: string;
  topicSlug?: string;
  source: string;
}

interface CustomTest {
  id: string;
  title: string;
  status: string;
  questions: PoolQuestion[];
}

// ─── Helpers ─────────────────────────────────────────────────

function apiErr(e: unknown) {
  return (e as { response?: { data?: { error?: { message?: string } } } })
    ?.response?.data?.error?.message ?? 'Request failed';
}

const GLASS = {
  background: 'var(--color-surface-800)',
  border: '1px solid var(--color-surface-600)',
};

// ─── Question card ────────────────────────────────────────────

function QuestionCard({
  question: q, selected, onToggle, showRemove, onRemove,
}: {
  question: PoolQuestion;
  selected: boolean;
  onToggle?: () => void;
  showRemove?: boolean;
  onRemove?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all duration-150 ${
        selected ? 'ring-2 ring-indigo-500/60' : ''
      }`}
      style={{ background: 'var(--color-surface-900)', border: `1px solid ${selected ? 'rgba(99,102,241,0.4)' : 'var(--color-surface-700)'}` }}
    >
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded(e => !e)}
      >
        <span
          className="text-xs font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
        >
          {q.marks}m
        </span>
        <div className={`text-sm text-white flex-1 text-left ${expanded ? '' : 'line-clamp-2'}`}>
          <Latex text={q.text} />
        </div>
        <div className="flex gap-1 shrink-0">
          {onToggle && (
            <span
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                selected
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </span>
          )}
          {showRemove && onRemove && (
            <span
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:text-red-400"
              style={{ background: 'var(--color-surface-700)', color: 'var(--color-surface-400)' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-1.5 ml-8">
          {q.options.map((opt, i) => (
            <div
              key={opt.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
              style={{
                background: opt.id === q.correctAnswerId ? 'rgba(34,197,94,0.08)' : 'var(--color-surface-800)',
                border: `1px solid ${opt.id === q.correctAnswerId ? 'rgba(34,197,94,0.3)' : 'var(--color-surface-700)'}`,
                color: opt.id === q.correctAnswerId ? '#4ade80' : '#e2e2f0',
              }}
            >
              <span className="font-bold text-xs w-4 shrink-0">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1 text-left"><Latex text={opt.text} /></span>
              {opt.id === q.correctAnswerId && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
            </div>
          ))}
          {q.explanation && (
            <div className="text-xs mt-2 px-2 text-left" style={{ color: 'var(--color-surface-400)' }}>
              <span>💡 </span><Latex text={q.explanation} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function TestEditPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const { instituteId } = useAuth();
  const router = useRouter();

  // Test data
  const [test, setTest]       = useState<CustomTest | null>(null);
  const [loadingTest, setLT]  = useState(true);

  // Pool data
  const [pool, setPool]       = useState<PoolQuestion[]>([]);
  const [loadingPool, setLP]  = useState(false);
  const [poolSearch, setPS]   = useState('');
  const [subjectFilter, setSubF] = useState('');

  // Selected questions (working set)
  const [selected, setSelected] = useState<PoolQuestion[]>([]);

  // Save state
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Load test ───────────────────────────────────────────────
  const loadTest = useCallback(async () => {
    if (!instituteId) return;
    setLT(true);
    try {
      const r = await api.get<{ data: CustomTest }>(
        `/api/inst/v1/institutes/${instituteId}/tests/${testId}`,
      );
      setTest(r.data.data);
      setSelected(r.data.data.questions ?? []);
    } catch { setError('Failed to load test.'); }
    finally { setLT(false); }
  }, [instituteId, testId]);

  useEffect(() => { void loadTest(); }, [loadTest]);

  // ── Load pool ───────────────────────────────────────────────
  const loadPool = useCallback(async () => {
    if (!instituteId) return;
    setLP(true);
    try {
      const params = new URLSearchParams({ limit: '80' });
      if (subjectFilter) params.set('subjectId', subjectFilter);
      const r = await api.get<{ data: PoolQuestion[] }>(
        `/api/inst/v1/institutes/${instituteId}/pool/questions?${params}`,
      );
      setPool(r.data.data);
    } catch { /* pool optional */ }
    finally { setLP(false); }
  }, [instituteId, subjectFilter]);

  useEffect(() => { void loadPool(); }, [loadPool]);

  // ── Toggles ─────────────────────────────────────────────────
  const togglePool = (q: PoolQuestion) => {
    setSelected(s => s.some(x => x.id === q.id) ? s.filter(x => x.id !== q.id) : [...s, q]);
  };

  const removeSelected = (id: string) => setSelected(s => s.filter(x => x.id !== id));

  // ── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!instituteId || selected.length === 0) { setError('Add at least one question.'); return; }
    setSaving(true); setError(null); setSuccess(false);
    try {
      await api.post(
        `/api/inst/v1/institutes/${instituteId}/tests/${testId}/questions`,
        { questions: selected, replace: true },
      );
      setSuccess(true);
      setTimeout(() => router.push(`/tests/${testId}`), 800);
    } catch (e) { setError(apiErr(e)); }
    finally { setSaving(false); }
  };

  // ── Filtered pool ────────────────────────────────────────────
  const filteredPool = pool.filter(q =>
    !selected.some(s => s.id === q.id) &&
    q.text.toLowerCase().includes(poolSearch.toLowerCase()),
  );

  const totalMarks = selected.reduce((sum, q) => sum + q.marks, 0);

  // ── Loading ─────────────────────────────────────────────────
  if (loadingTest) {
    return (
      <div className="animate-fade-in space-y-4 max-w-4xl">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!test) return (
    <div className="text-center py-16">
      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
      <p className="text-white">Test not found.</p>
    </div>
  );

  const isLocked = ['live', 'closed', 'graded'].includes(test.status);

  return (
    <div className="animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/tests/${testId}`} className="p-2 rounded-xl hover:text-white transition-colors shrink-0"
          style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">Edit Questions — {test.title}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>
            {selected.length} questions · {totalMarks} marks total
          </p>
        </div>
        {!isLocked && (
          <button
            onClick={handleSave}
            disabled={saving || selected.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: success ? 'rgba(34,197,94,0.9)' : 'linear-gradient(135deg,#6366f1,#4f46e5)' }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : success ? 'Saved ✓' : 'Save Questions'}
          </button>
        )}
      </div>

      {isLocked && (
        <div className="flex items-center gap-2 p-4 rounded-xl mb-6 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          This test is {test.status} — questions cannot be edited.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl mb-6 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Selected questions ─────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">
              Selected Questions <span className="text-indigo-400 ml-1">{selected.length}</span>
            </h2>
          </div>

          {selected.length === 0 ? (
            <div className="glass p-10 text-center rounded-2xl">
              <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: 'var(--color-surface-300)' }} />
              <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>
                Select questions from the pool on the right
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {selected.map(q => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  selected={true}
                  showRemove={!isLocked}
                  onRemove={() => removeSelected(q.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Question pool ─────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">
              Question Pool <span className="text-zinc-500 ml-1">{filteredPool.length}</span>
            </h2>
          </div>

          {/* Pool filters */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-surface-400)' }} />
              <input
                value={poolSearch}
                onChange={e => setPS(e.target.value)}
                placeholder="Search questions…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
                style={GLASS}
              />
            </div>
            <input
              value={subjectFilter}
              onChange={e => setSubF(e.target.value)}
              placeholder="Subject ID"
              className="w-28 px-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
              style={GLASS}
            />
          </div>

          {loadingPool ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : filteredPool.length === 0 ? (
            <div className="glass p-8 text-center rounded-2xl">
              <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>
                {pool.length === 0 ? 'No questions in the pool yet.' : 'All pool questions are selected.'}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-surface-600)' }}>
                Questions added via the New Test form appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {filteredPool.map(q => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  selected={false}
                  onToggle={isLocked ? undefined : () => togglePool(q)}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
