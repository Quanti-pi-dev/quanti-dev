'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Eye } from 'lucide-react';
import Link from 'next/link';

interface QuestionDraft {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
  marks: number;
  source: 'custom';
}

function makeOption(text = '') { return { id: crypto.randomUUID(), text }; }
function makeQuestion(): QuestionDraft {
  const opts = [makeOption(), makeOption(), makeOption(), makeOption()];
  return { id: crypto.randomUUID(), text: '', options: opts, correctAnswerId: opts[0]!.id, explanation: '', marks: 4, source: 'custom' };
}

export default function NewTestPage() {
  const { instituteId } = useAuth();
  const router = useRouter();

  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [duration, setDuration]   = useState(60);
  const [negMarking, setNegMark]  = useState(false);
  const [negValue, setNegValue]   = useState(1);
  const [showResults, setShow]    = useState<'immediate'|'after_close'|'manual'>('immediate');
  const [questions, setQuestions] = useState<QuestionDraft[]>([makeQuestion()]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Question helpers ──────────────────────────────────────────

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

  // ── Save ──────────────────────────────────────────────────────

  const save = async (publish = false) => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await api.post(`/api/inst/v1/institutes/${instituteId}/tests`, {
        title: title.trim(),
        description: description.trim(),
        subjectId: '000000000000000000000000', // placeholder — will be subject picker in v2
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
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Title *</label>
          <input id="test-title" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Chapter 5 — Laws of Motion"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
            style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Description</label>
          <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
            placeholder="Optional instructions for students…"
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none resize-none"
            style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Duration (minutes)</label>
            <input type="number" min="5" max="480" value={duration} onChange={e => setDuration(+e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Show Results</label>
            <select value={showResults} onChange={e => setShow(e.target.value as typeof showResults)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }}>
              <option value="immediate">Immediately</option>
              <option value="after_close">After Close</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Negative Marking</label>
            <div className="flex items-center gap-3 h-11">
              <button onClick={() => setNegMark(!negMarking)}
                className={`w-10 h-6 rounded-full transition-all duration-200 relative ${negMarking ? '' : ''}`}
                style={{ background: negMarking ? '#6366f1' : 'var(--color-surface-700)' }}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${negMarking ? 'left-5' : 'left-1'}`} />
              </button>
              {negMarking && (
                <input type="number" min="0" step="0.25" value={negValue}
                  onChange={e => setNegValue(+e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, qIdx) => (
          <div key={q.id} className="glass p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-brand-400)' }}>
                Q{qIdx + 1}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Marks</label>
                  <input type="number" min="1" value={q.marks} onChange={e => updateQ(qIdx, { marks: +e.target.value })}
                    className="w-14 px-2 py-1 rounded-lg text-sm text-white text-center outline-none"
                    style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
                </div>
                {questions.length > 1 && (
                  <button onClick={() => removeQ(qIdx)} className="p-1.5 rounded-lg hover:text-red-400 transition-colors"
                    style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <textarea value={q.text} onChange={e => updateQ(qIdx, { text: e.target.value })}
              placeholder="Enter your question…"
              rows={2} className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none resize-none mb-4"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />

            <div className="space-y-2 mb-4">
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
            </div>

            {q.options.length < 5 && (
              <button onClick={() => addOption(qIdx)}
                className="text-xs flex items-center gap-1.5 transition-colors hover:text-indigo-400 mb-4"
                style={{ color: 'var(--color-surface-400)' }}>
                <Plus className="w-3.5 h-3.5" /> Add option
              </button>
            )}

            <input value={q.explanation} onChange={e => updateQ(qIdx, { explanation: e.target.value })}
              placeholder="Explanation (shown after submit, optional)…"
              className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
              style={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-700)' }} />
          </div>
        ))}

        <button onClick={() => setQuestions(qs => [...qs, makeQuestion()])}
          className="w-full py-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
          style={{ background: 'rgba(99,102,241,0.08)', border: '2px dashed rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
          <Plus className="w-4 h-4" /> Add Question
        </button>
      </div>
    </div>
  );
}
