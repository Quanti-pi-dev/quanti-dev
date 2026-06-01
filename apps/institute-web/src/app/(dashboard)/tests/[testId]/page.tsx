'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, BarChart3, Send, Trash2, Clock, Users,
  CheckCircle2, Edit3, Save, X, Plus, ListOrdered, Medal,
} from 'lucide-react';
import { Latex } from '@/components/latex';

// ── Types ────────────────────────────────────────────────────────

interface TestOption { id: string; text: string; imageUrl?: string | null; }
interface TestQuestion {
  id: string; text: string; options: TestOption[];
  correctAnswerId: string; explanation?: string | null;
  marks: number; source: string;
  imageUrl?: string | null;
  explanationImageUrl?: string | null;
}
interface TestSettings {
  shuffleQuestions: boolean;
  showResults: 'immediate' | 'after_close' | 'manual';
  negativeMarking: boolean;
  negativeMarkValue: number;
  passingScore: number;
}
interface CustomTest {
  id: string; title: string; description: string;
  status: 'draft' | 'scheduled' | 'live' | 'closed' | 'graded';
  questionCount: number; durationMinutes: number;
  scheduledAt: string | null; closesAt: string | null;
  isPublished: boolean; createdBy: string; createdAt: string;
  settings: TestSettings;
  questions: TestQuestion[];
  totalMarks: number;
}

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: '#9ca3af', bg: 'rgba(107,114,128,0.15)' },
  scheduled: { label: 'Scheduled', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)' },
  live:      { label: '🔴 Live',   color: '#4ade80', bg: 'rgba(34,197,94,0.15)'  },
  closed:    { label: 'Closed',    color: '#f87171', bg: 'rgba(239,68,68,0.15)'  },
  graded:    { label: 'Graded',    color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)' },
};

interface Submission {
  firebaseUid: string;
  displayName: string;
  score: number;
  maxScore: number;
  percentage: number;
  timeTakenMinutes: number;
  submittedAt: string;
  rank: number;
}

// ── Page ─────────────────────────────────────────────────────────

export default function TestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const { instituteId, instituteRole } = useAuth();
  const router = useRouter();

  const [test, setTest]       = useState<CustomTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle]     = useState('');
  const [saving, setSaving]             = useState(false);

  // Submissions
  const [activeTab, setActiveTab]         = useState<'questions' | 'submissions'>('questions');
  const [submissions, setSubmissions]     = useState<Submission[]>([]);
  const [subLoading, setSubLoading]       = useState(false);
  const [subTotal, setSubTotal]           = useState(0);

  const canEdit = !test?.isPublished && (instituteRole === 'institute_admin' || instituteRole === 'educator');

  const load = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/inst/v1/institutes/${instituteId}/tests/${testId}`);
      setTest(res.data.data as CustomTest);
    } catch {
      setError('Test not found or you do not have access.');
    } finally {
      setLoading(false);
    }
  }, [instituteId, testId]);

  useEffect(() => { void load(); }, [load]);

  const loadSubmissions = useCallback(async () => {
    if (!instituteId) return;
    setSubLoading(true);
    try {
      const r = await api.get(`/api/inst/v1/institutes/${instituteId}/tests/${testId}/submissions?limit=100`);
      setSubmissions(r.data.data);
      setSubTotal(r.data.pagination?.total ?? r.data.data.length);
    } catch { /* silent — submissions may be empty */ }
    finally { setSubLoading(false); }
  }, [instituteId, testId]);

  useEffect(() => {
    if (activeTab === 'submissions') void loadSubmissions();
  }, [activeTab, loadSubmissions]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.post(`/api/inst/v1/institutes/${instituteId}/tests/${testId}/publish`);
      await load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${test?.title}"? This will remove all student submissions.`)) return;
    try {
      await api.delete(`/api/inst/v1/institutes/${instituteId}/tests/${testId}`);
      router.push('/tests');
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Delete failed');
    }
  };

  const saveTitle = async () => {
    if (!draftTitle.trim() || draftTitle === test?.title) { setEditingTitle(false); return; }
    setSaving(true);
    try {
      await api.patch(`/api/inst/v1/institutes/${instituteId}/tests/${testId}`, { title: draftTitle.trim() });
      await load();
      setEditingTitle(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (error || !test) return (
    <div className="glass p-10 text-center">
      <p className="text-white font-semibold">{error ?? 'Error loading test'}</p>
      <Link href="/tests" className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-400">
        <ArrowLeft className="w-4 h-4" /> Back to tests
      </Link>
    </div>
  );

  const cfg = STATUS_CONFIG[test.status];
  const totalMarks = test.questions.reduce((s, q) => s + q.marks, 0);

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Link href="/tests" className="p-2 rounded-xl mt-1 transition-colors hover:text-white shrink-0"
          style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          {/* Title with inline edit */}
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={draftTitle} onChange={e => setDraftTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="text-2xl font-bold text-white bg-transparent outline-none border-b-2 border-indigo-500 flex-1" />
              <button onClick={() => void saveTitle()} disabled={saving} className="p-1.5 text-indigo-400 hover:text-indigo-300">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => setEditingTitle(false)} className="p-1.5 text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white truncate">{test.title}</h1>
              {canEdit && (
                <button onClick={() => { setDraftTitle(test.title); setEditingTitle(true); }}
                  className="p-1.5 rounded-lg transition-colors hover:text-indigo-400 shrink-0"
                  style={{ color: 'var(--color-surface-400)' }}>
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            <span className="text-sm" style={{ color: 'var(--color-surface-400)' }}>
              {test.questionCount} questions · {totalMarks} marks · {test.durationMinutes} min
            </span>
            {test.scheduledAt && (
              <span className="text-xs" style={{ color: 'var(--color-surface-400)' }}>
                Starts {new Date(test.scheduledAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/tests/${testId}/analytics`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:text-indigo-300"
            style={{ color: 'var(--color-surface-300)', background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }}>
            <BarChart3 className="w-4 h-4" /> Analytics
          </Link>
          {canEdit && !test.isPublished && test.questionCount > 0 && (
            <button onClick={handlePublish} disabled={publishing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <Send className="w-4 h-4" />
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
          {canEdit && test.status === 'draft' && (
            <button onClick={handleDelete}
              className="p-2 rounded-xl transition-colors hover:text-red-400"
              style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Settings cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Clock,        label: 'Duration',    value: `${test.durationMinutes} min` },
          { icon: Users,        label: 'Submissions', value: subTotal > 0 ? subTotal : (test.questionCount > 0 ? '—' : '0') },
          { icon: CheckCircle2, label: 'Pass Score',  value: `${test.settings.passingScore}%` },
          { icon: BarChart3,    label: 'Total Marks', value: totalMarks },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-indigo-400" />
              <span className="text-xs" style={{ color: 'var(--color-surface-400)' }}>{label}</span>
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Settings badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <SettingBadge label={`Results: ${test.settings.showResults.replace('_', ' ')}`} />
        <SettingBadge label={test.settings.shuffleQuestions ? '🔀 Shuffled' : 'Fixed order'} />
        <SettingBadge label={test.settings.negativeMarking
          ? `−${test.settings.negativeMarkValue} negative marking`
          : 'No negative marking'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--color-surface-700)' }}>
        {[{ key: 'questions', label: `Questions (${test.questions.length})`, icon: ListOrdered },
          { key: 'submissions', label: 'Submissions', icon: Medal }]
          .map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key as 'questions' | 'submissions')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Questions panel */}
      {activeTab === 'questions' && (
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Questions ({test.questions.length})</h2>
            {canEdit && (
              <Link href={`/tests/${testId}/edit`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:text-indigo-300"
                style={{ color: 'var(--color-surface-300)', background: 'var(--color-surface-800)' }}>
                <Plus className="w-4 h-4" /> Edit Questions
              </Link>
            )}
          </div>
          {test.questions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-white font-medium mb-2">No questions yet</p>
              <p className="text-sm mb-4" style={{ color: 'var(--color-surface-400)' }}>Add questions to publish this test.</p>
              {canEdit && (
                <Link href={`/tests/${testId}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <Plus className="w-4 h-4" /> Add Questions
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {test.questions.map((q, idx) => <QuestionCard key={q.id} question={q} index={idx} />)}
            </div>
          )}
        </div>
      )}

      {/* Submissions panel */}
      {activeTab === 'submissions' && (
        <div className="glass p-6">
          {subLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded-xl" />)}
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center">
              <Medal className="w-10 h-10 mx-auto mb-3 opacity-25" style={{ color: 'var(--color-surface-300)' }} />
              <p className="text-white font-medium">No submissions yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-surface-400)' }}>
                {test.isPublished ? 'Waiting for students to attempt this test.' : 'Publish the test so students can attempt it.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs mb-4" style={{ color: 'var(--color-surface-400)' }}>
                {subTotal} submission{subTotal !== 1 ? 's' : ''} · sorted by rank
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-surface-700)' }}>
                      {['Rank','Student','Score','%','Time','Submitted'].map(h => (
                        <th key={h} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--color-surface-400)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                    {submissions.map((s) => (
                      <tr key={s.firebaseUid} className="hover:bg-white/2 transition-colors">
                        <td className="py-3 pr-4">
                          <span className="font-bold text-base" style={{
                            color: s.rank === 1 ? '#fbbf24' : s.rank === 2 ? '#d1d5db' : s.rank === 3 ? '#d97706' : 'var(--color-surface-300)',
                          }}>
                            {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                          </span>
                        </td>
                        <td className="py-3 pr-6">
                          <p className="text-white font-medium">{s.displayName || s.firebaseUid.slice(0,8)}</p>
                        </td>
                        <td className="py-3 pr-6 tabular-nums">
                          <span className="text-white">{s.score}</span>
                          <span className="text-xs ml-1" style={{ color: 'var(--color-surface-400)' }}>/ {s.maxScore}</span>
                        </td>
                        <td className="py-3 pr-6">
                          <span className={`font-semibold ${
                            s.percentage >= test.settings.passingScore ? 'text-emerald-400' : 'text-red-400'
                          }`}>{s.percentage.toFixed(1)}%</span>
                        </td>
                        <td className="py-3 pr-6 tabular-nums" style={{ color: 'var(--color-surface-300)' }}>
                          {s.timeTakenMinutes}m
                        </td>
                        <td className="py-3" style={{ color: 'var(--color-surface-400)' }}>
                          {new Date(s.submittedAt).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function QuestionCard({ question: q, index }: { question: TestQuestion; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-700)' }}>
      {/* Question header */}
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-white text-sm ${expanded ? '' : 'line-clamp-2'}`}>
              <Latex text={q.text} />
            </div>
            {q.imageUrl && (
              <img src={q.imageUrl} alt="Question" className="mt-2 rounded-lg max-h-24 object-contain" style={{ border: '1px solid var(--color-surface-700)' }} />
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}>
              {q.marks} mk{q.marks !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded: options */}
      {expanded && (
        <div className="px-5 pb-5">
          <div className="space-y-2 ml-9">
            {q.options.map((opt, oi) => (
              <div key={opt.id} className="px-3 py-2 rounded-lg"
                style={{
                  background: opt.id === q.correctAnswerId ? 'rgba(34,197,94,0.1)' : 'var(--color-surface-800)',
                  border: `1px solid ${opt.id === q.correctAnswerId ? 'rgba(34,197,94,0.3)' : 'var(--color-surface-700)'}`,
                }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center shrink-0"
                    style={{ color: opt.id === q.correctAnswerId ? '#4ade80' : 'var(--color-surface-400)' }}>
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <div className="text-sm flex-1" style={{ color: opt.id === q.correctAnswerId ? '#4ade80' : '#e2e2f0' }}>
                    <Latex text={opt.text} />
                  </div>
                  {opt.id === q.correctAnswerId && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </div>
                {opt.imageUrl && (
                  <img src={opt.imageUrl} alt={`Option ${String.fromCharCode(65 + oi)}`} className="mt-1.5 ml-8 rounded-lg max-h-20 object-contain" style={{ border: '1px solid var(--color-surface-700)' }} />
                )}
              </div>
            ))}
          </div>
          {(q.explanation || q.explanationImageUrl) && (
            <div className="ml-9 mt-3 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--color-surface-300)', border: '1px solid rgba(99,102,241,0.15)' }}>
              {q.explanation && <><span>💡 </span><Latex text={q.explanation} /></>}
              {q.explanationImageUrl && (
                <img src={q.explanationImageUrl} alt="Explanation" className="mt-1.5 rounded-lg max-h-20 object-contain" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingBadge({ label }: { label: string }) {
  return (
    <span className="text-xs px-3 py-1.5 rounded-lg font-medium"
      style={{ background: 'var(--color-surface-800)', color: 'var(--color-surface-300)', border: '1px solid var(--color-surface-700)' }}>
      {label}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <div className="skeleton w-8 h-8 rounded-xl" />
        <div>
          <div className="skeleton h-7 w-64 rounded mb-2" />
          <div className="skeleton h-4 w-48 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass h-20 skeleton" />)}
      </div>
      <div className="glass p-6">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl mb-3" />)}
      </div>
    </div>
  );
}
