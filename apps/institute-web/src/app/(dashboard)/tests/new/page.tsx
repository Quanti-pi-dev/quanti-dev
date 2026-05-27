'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Eye, ChevronDown, Sparkles, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { Latex } from '@/components/latex';

// ── Types ──────────────────────────────────────────────────────────

interface SubjectOption {
  id: string;
  name: string;
  accent: string | null;
  topics: { slug: string; displayName: string }[];
}

interface QuestionDraft {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
  marks: number;
  topicSlug: string | null;
  source: 'custom';
}

// ── Helpers ────────────────────────────────────────────────────────

function makeOption(text = '') { return { id: crypto.randomUUID(), text }; }
function makeQuestion(): QuestionDraft {
  const opts = [makeOption(), makeOption(), makeOption(), makeOption()];
  return { id: crypto.randomUUID(), text: '', options: opts, correctAnswerId: opts[0]!.id, explanation: '', marks: 4, topicSlug: null, source: 'custom' };
}

// ── Component ──────────────────────────────────────────────────────

export default function NewTestPage() {
  const { instituteId } = useAuth();
  const router = useRouter();

  // ── Form state ─────────────────────────────────────────────────
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [duration, setDuration]   = useState(60);
  const [negMarking, setNegMark]  = useState(false);
  const [negValue, setNegValue]   = useState(1);
  const [showResults, setShow]    = useState<'immediate'|'after_close'|'manual'>('immediate');
  const [questions, setQuestions] = useState<QuestionDraft[]>([makeQuestion()]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── AI generation state ────────────────────────────────────
  const [showAIModal, setShowAI]  = useState(false);
  const [aiTopic, setAiTopic]     = useState('');
  const [aiCount, setAiCount]     = useState(5);
  const [aiDifficulty, setAiDiff] = useState<'easy'|'medium'|'hard'|'mixed'>('mixed');
  const [aiInstructions, setAiInstr] = useState('');
  const [aiGenerating, setAiGen]  = useState(false);
  const [aiError, setAiError]     = useState<string | null>(null);

  // ── Subject / Topic state ──────────────────────────────────────
  const [subjects, setSubjects]       = useState<SubjectOption[]>([]);
  const [subjectsLoading, setSubjLoad] = useState(false);
  const [selectedSubjectId, setSubjectId] = useState<string>('');

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId) ?? null;

  useEffect(() => {
    if (!instituteId) return;
    setSubjLoad(true);
    api.get<{ data: SubjectOption[] }>(`/api/inst/v1/institutes/${instituteId}/content/subjects`)
      .then(res => setSubjects(res.data.data))
      .catch(() => {/* non-fatal */})
      .finally(() => setSubjLoad(false));
  }, [instituteId]);

  // ── Question helpers ───────────────────────────────────────────

  const updateQ = (idx: number, patch: Partial<QuestionDraft>) =>
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));

  const updateOpt = (qIdx: number, oIdx: number, text: string) =>
    setQuestions(qs => qs.map((q, i) => i !== qIdx ? q : {
      ...q, options: q.options.map((o, j) => j === oIdx ? { ...o, text } : o),
    }));

  const addOption = (qIdx: number) =>
    setQuestions(qs => qs.map((q, i) => i !== qIdx ? q : {
      ...q, options: [...q.options, makeOption()],
    }));

  const removeOption = (qIdx: number, oIdx: number) =>
    setQuestions(qs => qs.map((q, i) => i !== qIdx ? q : {
      ...q, options: q.options.filter((_, j) => j !== oIdx),
    }));

  const removeQ = (idx: number) => setQuestions(qs => qs.filter((_, i) => i !== idx));

  // ── AI Generate handler ────────────────────────────────────
  const handleAIGenerate = async () => {
    if (!selectedSubjectId) { setAiError('Please select a subject first'); return; }
    if (!aiTopic.trim()) { setAiError('Enter a topic for question generation'); return; }
    setAiGen(true); setAiError(null);
    try {
      const subjectName = selectedSubject?.name ?? 'General';
      const res = await api.post<{ data: { questions: { id: string; text: string; options: { id: string; text: string }[]; correctAnswerId: string; explanation: string; marks: number }[] } }>(
        `/api/inst/v1/institutes/${instituteId}/ai/generate-questions`,
        {
          topic: aiTopic.trim(),
          subject: subjectName,
          count: aiCount,
          difficulty: aiDifficulty,
          instructions: aiInstructions.trim() || undefined,
        },
        {
          timeout: 120_000, // 2 minutes timeout for slow AI generation
        }
      );
      // Merge generated questions into the form
      const generated: QuestionDraft[] = (res.data.data.questions ?? []).map(q => ({
        id: q.id ?? crypto.randomUUID(),
        text: q.text ?? '',
        options: q.options ?? [],
        correctAnswerId: q.correctAnswerId ?? '',
        explanation: q.explanation ?? '',
        marks: q.marks ?? 4,
        topicSlug: null,
        source: 'custom' as const,
      }));
      setQuestions(qs => {
        // Remove empty placeholder questions
        const existing = qs.filter(q => q.text.trim());
        return [...existing, ...generated];
      });
      setShowAI(false);
      setAiTopic('');
    } catch (e: unknown) {
      setAiError((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'AI generation failed. Check AI Settings.');
    } finally { setAiGen(false); }
  };

  // ── Save ───────────────────────────────────────────────────────

  const save = async (publish = false) => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!selectedSubjectId) { setError('Please select a subject for this test'); return; }
    setSaving(true); setError(null);
    try {
      const res = await api.post(`/api/inst/v1/institutes/${instituteId}/tests`, {
        title: title.trim(),
        description: description.trim(),
        subjectId: selectedSubjectId,
        durationMinutes: duration,
        settings: { negativeMarking: negMarking, negativeMarkValue: negValue, showResults },
        questions: questions.filter(q => q.text.trim()),
      });
      const testId: string = res.data.data.id;

      if (publish) {
        await api.post(`/api/inst/v1/institutes/${instituteId}/tests/${testId}/publish`);
      }
      router.push('/tests');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Common input styles ─────────────────────────────────────────

  const inputStyle = { background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' } as const;
  const labelCls = 'block text-xs font-medium mb-2' as const;

  return (
    <div className="animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/tests" className="p-2 rounded-xl transition-colors hover:text-white"
          style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Test</h1>
          <p className="text-sm" style={{ color: 'var(--color-surface-300)' }}>
            {questions.filter(q => q.text.trim()).length} question{questions.filter(q => q.text.trim()).length !== 1 ? 's' : ''}
            {selectedSubject && <span className="ml-2 text-indigo-400">· {selectedSubject.name}</span>}
          </p>
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => save(false)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
            style={{ background: 'var(--color-surface-800)', color: 'var(--color-surface-300)', border: '1px solid var(--color-surface-600)' }}>
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button onClick={() => save(true)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
            <Eye className="w-4 h-4" /> Save & Publish
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Test details */}
      <div className="glass p-6 mb-6 space-y-5">
        <h2 className="text-white font-semibold">Test Details</h2>

        <div>
          <label className={`${labelCls}`} style={{ color: 'var(--color-surface-300)' }}>Title *</label>
          <input id="test-title" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Chapter 5 — Laws of Motion"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
            style={inputStyle} />
        </div>

        <div>
          <label className={`${labelCls}`} style={{ color: 'var(--color-surface-300)' }}>Description</label>
          <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
            placeholder="Optional instructions for students…"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none resize-none"
            style={inputStyle} />
        </div>

        {/* Subject Picker */}
        <div>
          <label className={`${labelCls}`} style={{ color: 'var(--color-surface-300)' }}>
            Subject *
            <span className="ml-1.5 font-normal text-xs" style={{ color: 'var(--color-surface-500)' }}>
              (determines which metrics are tracked for your students)
            </span>
          </label>
          <div className="relative">
            <select
              value={selectedSubjectId}
              onChange={e => {
                setSubjectId(e.target.value);
                // Reset all question topicSlugs when subject changes
                setQuestions(qs => qs.map(q => ({ ...q, topicSlug: null })));
              }}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none appearance-none"
              style={inputStyle}
            >
              <option value="">{subjectsLoading ? 'Loading subjects…' : '— Select a subject —'}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--color-surface-400)' }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={`${labelCls}`} style={{ color: 'var(--color-surface-300)' }}>Duration (minutes)</label>
            <input type="number" min="5" max="480" value={duration} onChange={e => setDuration(+e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={inputStyle} />
          </div>
          <div>
            <label className={`${labelCls}`} style={{ color: 'var(--color-surface-300)' }}>Show Results</label>
            <select value={showResults} onChange={e => setShow(e.target.value as typeof showResults)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={inputStyle}>
              <option value="immediate">Immediately</option>
              <option value="after_close">After Close</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className={`${labelCls}`} style={{ color: 'var(--color-surface-300)' }}>Negative Marking</label>
            <div className="flex items-center gap-3 h-11">
              <button onClick={() => setNegMark(!negMarking)}
                className="w-10 h-6 rounded-full transition-all duration-200 relative"
                style={{ background: negMarking ? '#6366f1' : 'var(--color-surface-700)' }}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${negMarking ? 'left-5' : 'left-1'}`} />
              </button>
              {negMarking && (
                <input type="number" min="0" step="0.25" value={negValue}
                  onChange={e => setNegValue(+e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg text-sm text-white outline-none"
                  style={inputStyle} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, qIdx) => (
          <div key={q.id} className="glass p-6">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Question {qIdx + 1}
              </span>
              <div className="flex items-center gap-3">
                {/* Topic Picker — only shown when a subject is selected and has topics */}
                {selectedSubject && selectedSubject.topics.length > 0 && (
                  <div className="relative">
                    <select
                      value={q.topicSlug ?? ''}
                      onChange={e => updateQ(qIdx, { topicSlug: e.target.value || null })}
                      className="pl-3 pr-7 py-1 rounded-lg text-xs text-white outline-none appearance-none"
                      style={{ ...inputStyle, minWidth: 140 }}
                      title="Tag this question to a topic for metric tracking"
                    >
                      <option value="">— No topic —</option>
                      {selectedSubject.topics.map(t => (
                        <option key={t.slug} value={t.slug}>{t.displayName}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3"
                      style={{ color: 'var(--color-surface-400)' }} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Marks</label>
                  <input type="number" min="1" value={q.marks} onChange={e => updateQ(qIdx, { marks: +e.target.value })}
                    className="w-14 px-2 py-1 rounded-lg text-sm text-white text-center outline-none"
                    style={inputStyle} />
                </div>
                {questions.length > 1 && (
                  <button onClick={() => removeQ(qIdx)} className="p-1.5 rounded-lg hover:text-red-400 transition-colors"
                    style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form Inputs (Left) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-surface-300)' }}>Question Text *</label>
                  <textarea value={q.text} onChange={e => updateQ(qIdx, { text: e.target.value })}
                    placeholder="Enter your question…"
                    rows={3} className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none resize-none"
                    style={inputStyle} />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-surface-300)' }}>Options & Correct Answer *</label>
                  {q.options.map((opt, oIdx) => (
                    <div key={opt.id} className="flex items-center gap-3">
                      <button onClick={() => updateQ(qIdx, { correctAnswerId: opt.id })}
                        className="w-5 h-5 rounded-full border-2 shrink-0 transition-all duration-150 flex items-center justify-center"
                        style={{ borderColor: q.correctAnswerId === opt.id ? '#6366f1' : 'var(--color-surface-600)', background: q.correctAnswerId === opt.id ? '#6366f1' : 'transparent' }}>
                        {q.correctAnswerId === opt.id && <span className="w-2 h-2 rounded-full bg-white" />}
                      </button>
                      <input value={opt.text} onChange={e => updateOpt(qIdx, oIdx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                        className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-gray-600 outline-none"
                        style={{
                          background: q.correctAnswerId === opt.id ? 'rgba(99,102,241,0.1)' : 'var(--color-surface-800)',
                          border: `1px solid ${q.correctAnswerId === opt.id ? 'rgba(99,102,241,0.4)' : 'var(--color-surface-600)'}`,
                        }} />
                      {q.options.length > 2 && (
                        <button onClick={() => removeOption(qIdx, oIdx)} className="p-1 hover:text-red-400 transition-colors"
                          style={{ color: 'var(--color-surface-500)' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {q.options.length < 5 && (
                    <button onClick={() => addOption(qIdx)}
                      className="text-xs flex items-center gap-1.5 transition-colors hover:text-indigo-400 pt-1"
                      style={{ color: 'var(--color-surface-400)' }}>
                      <Plus className="w-3.5 h-3.5" /> Add option
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-surface-300)' }}>Explanation (optional)</label>
                  <input value={q.explanation} onChange={e => updateQ(qIdx, { explanation: e.target.value })}
                    placeholder="Explanation (shown after submit)…"
                    className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
                    style={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-700)' }} />
                </div>
              </div>

              {/* Live Preview (Right) */}
              <div className="flex flex-col border-t md:border-t-0 md:border-l border-zinc-800 pt-5 md:pt-0 md:pl-6">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Live Question Preview</span>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-lg min-h-[220px] flex flex-col justify-between">
                    <div>
                      {/* Question Text */}
                      {q.text.trim() ? (
                        <div className="text-sm text-white font-medium leading-relaxed">
                          <Latex text={q.text} />
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-600 italic">No question text entered yet…</p>
                      )}

                      {/* Topic tag pill */}
                      {q.topicSlug && (
                        <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                          {selectedSubject?.topics.find(t => t.slug === q.topicSlug)?.displayName ?? q.topicSlug}
                        </span>
                      )}

                      {/* Options */}
                      <div className="space-y-2 mt-4">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors duration-200 ${
                              opt.id === q.correctAnswerId
                                ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                                : 'bg-zinc-900 border border-zinc-800/50 text-zinc-500'
                            }`}
                          >
                            <span className="text-xs font-bold w-5 text-center shrink-0"
                              style={{ color: opt.id === q.correctAnswerId ? '#4ade80' : 'var(--color-surface-500)' }}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className="truncate flex-1">
                              {opt.text.trim() ? (
                                <Latex text={opt.text} />
                              ) : (
                                <span className="text-zinc-700 italic">Empty option…</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    {q.explanation.trim() && (
                      <div className="mt-3 text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3">
                        <span>💡 </span><Latex text={q.explanation} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <button onClick={() => setQuestions(qs => [...qs, makeQuestion()])}
            className="flex-1 py-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            style={{ background: 'rgba(99,102,241,0.08)', border: '2px dashed rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
            <Plus className="w-4 h-4" /> Add Question
          </button>
          <button onClick={() => setShowAI(true)}
            className="flex-1 py-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            style={{ background: 'rgba(245,158,11,0.08)', border: '2px dashed rgba(245,158,11,0.3)', color: '#fbbf24' }}>
            <Sparkles className="w-4 h-4" /> Generate with AI
          </button>
        </div>

        {/* AI Generation Modal */}
        {showAIModal && (
          <div onClick={e => { if (e.target === e.currentTarget) setShowAI(false); }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl mx-4">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <h2 className="text-base font-semibold text-white">AI Generate Questions</h2>
                </div>
                <button onClick={() => setShowAI(false)}><X className="w-4 h-4 text-zinc-500 hover:text-white" /></button>
              </div>

              {aiError && (
                <div className="mb-4 p-3 rounded-xl text-xs"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  {aiError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-surface-300)' }}>Topic *</label>
                  <input value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                    placeholder="e.g. Laws of Motion, Organic Chemistry"
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
                    style={inputStyle} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-surface-300)' }}>Count</label>
                    <input type="number" min={1} max={20} value={aiCount} onChange={e => setAiCount(+e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                      style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-surface-300)' }}>Difficulty</label>
                    <select value={aiDifficulty} onChange={e => setAiDiff(e.target.value as typeof aiDifficulty)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none appearance-none"
                      style={inputStyle}>
                      <option value="mixed">Mixed</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-surface-300)' }}>Instructions (optional)</label>
                  <input value={aiInstructions} onChange={e => setAiInstr(e.target.value)}
                    placeholder="Focus on numerical problems…"
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
                    style={inputStyle} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowAI(false)}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: 'var(--color-surface-800)', color: 'var(--color-surface-300)', border: '1px solid var(--color-surface-600)' }}>
                    Cancel
                  </button>
                  <button onClick={handleAIGenerate} disabled={aiGenerating}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' }}>
                    {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate</>}
                  </button>
                </div>
                <p className="text-[10px] text-center" style={{ color: 'var(--color-surface-500)' }}>
                  Uses the model configured in Admin → AI Settings → Quiz Generator
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
