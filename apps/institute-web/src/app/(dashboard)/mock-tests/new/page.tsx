'use client';

// ─── New Institute Mock Test ───────────────────────────────────
// Wires: POST /api/inst/v1/institutes/:id/mock-tests
//
// Creates a mock test in the institute-specific format (NEET/JEE templates or custom).
// This is distinct from /tests/new (which creates custom open-question tests).

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronUp, Info,
} from 'lucide-react';

// ─── Exam templates (match backend examTemplateId expectations) ─

const EXAM_TEMPLATES = [
  {
    id: 'neet',
    name: 'NEET UG',
    durationMinutes: 200,
    sections: [
      { subjectId: 'physics', subjectLabel: 'Physics', questionCount: 45, marksPerCorrect: 4, marksPerIncorrect: -1 },
      { subjectId: 'chemistry', subjectLabel: 'Chemistry', questionCount: 45, marksPerCorrect: 4, marksPerIncorrect: -1 },
      { subjectId: 'biology', subjectLabel: 'Biology (Botany + Zoology)', questionCount: 90, marksPerCorrect: 4, marksPerIncorrect: -1 },
    ],
  },
  {
    id: 'jee_main',
    name: 'JEE Main',
    durationMinutes: 180,
    sections: [
      { subjectId: 'physics', subjectLabel: 'Physics', questionCount: 30, marksPerCorrect: 4, marksPerIncorrect: -1 },
      { subjectId: 'chemistry', subjectLabel: 'Chemistry', questionCount: 30, marksPerCorrect: 4, marksPerIncorrect: -1 },
      { subjectId: 'maths', subjectLabel: 'Mathematics', questionCount: 30, marksPerCorrect: 4, marksPerIncorrect: -1 },
    ],
  },
  {
    id: 'jee_adv',
    name: 'JEE Advanced',
    durationMinutes: 180,
    sections: [
      { subjectId: 'physics', subjectLabel: 'Physics', questionCount: 54, marksPerCorrect: 3, marksPerIncorrect: -1 },
      { subjectId: 'chemistry', subjectLabel: 'Chemistry', questionCount: 54, marksPerCorrect: 3, marksPerIncorrect: -1 },
      { subjectId: 'maths', subjectLabel: 'Mathematics', questionCount: 54, marksPerCorrect: 3, marksPerIncorrect: -1 },
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    durationMinutes: 120,
    sections: [],
  },
] as const;

type TemplateId = typeof EXAM_TEMPLATES[number]['id'];

interface Section {
  id: string;
  subjectId: string;
  subjectLabel: string;
  questionCount: number;
  marksPerCorrect: number;
  marksPerIncorrect: number;
}

function makeCustomSection(): Section {
  return {
    id: crypto.randomUUID(),
    subjectId: '',
    subjectLabel: '',
    questionCount: 30,
    marksPerCorrect: 4,
    marksPerIncorrect: -1,
  };
}

function apiErr(e: unknown) {
  return (e as { response?: { data?: { error?: { message?: string } } } })
    ?.response?.data?.error?.message ?? 'Request failed';
}

export default function NewMockTestPage() {
  const { instituteId } = useAuth();
  const router = useRouter();

  const [templateId, setTemplateId] = useState<TemplateId>('neet');
  const [title, setTitle]           = useState('');
  const [duration, setDuration]     = useState(200);
  const [scheduledAt, setScheduledAt] = useState('');
  const [closesAt, setClosesAt]       = useState('');
  const [sections, setSections]       = useState<Section[]>(
    EXAM_TEMPLATES[0].sections.map(s => ({ ...s, id: crypto.randomUUID() })),
  );
  const [expandedSections, setExpandedSections] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ── Template change ──────────────────────────────────────────
  const handleTemplateChange = (id: TemplateId) => {
    const tpl = EXAM_TEMPLATES.find(t => t.id === id)!;
    setTemplateId(id);
    setDuration(tpl.durationMinutes);
    if (id !== 'custom') {
      setSections(tpl.sections.map(s => ({ ...s, id: crypto.randomUUID() })));
    } else {
      setSections([makeCustomSection()]);
    }
  };

  const updateSection = (id: string, patch: Partial<Section>) =>
    setSections(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));

  const removeSection = (id: string) =>
    setSections(ss => ss.filter(s => s.id !== id));

  // ── Derived totals ───────────────────────────────────────────
  const totalQuestions = sections.reduce((sum, s) => sum + s.questionCount, 0);
  const totalMarks     = sections.reduce((sum, s) => sum + s.questionCount * s.marksPerCorrect, 0);

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (sections.length === 0) { setError('Add at least one section.'); return; }
    if (templateId === 'custom' && sections.some(s => !s.subjectId.trim())) {
      setError('All custom sections need a Subject ID.'); return;
    }
    setSaving(true); setError(null);

    const payload = {
      examTemplateId: templateId,
      examTemplateName: EXAM_TEMPLATES.find(t => t.id === templateId)?.name,
      title: title.trim(),
      sections: sections.map(s => ({
        subjectId: s.subjectId,
        questionCount: s.questionCount,
        questionIds: [],
        marksPerCorrect: s.marksPerCorrect,
        marksPerIncorrect: s.marksPerIncorrect,
      })),
      durationMinutes: duration,
      scheduledAt: scheduledAt || null,
      closesAt: closesAt || null,
    };

    try {
      const r = await api.post<{ data: { id: string } }>(
        `/api/inst/v1/institutes/${instituteId}/mock-tests`,
        payload,
      );
      router.push(`/mock-tests`);
    } catch (err) {
      setError(apiErr(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in max-w-3xl">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/mock-tests"
          className="p-2 rounded-xl transition-colors hover:text-white shrink-0"
          style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">New Mock Test</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>
            NEET / JEE / Custom format mock test for your institute
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl mb-6 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Template picker */}
      <div className="glass p-6 mb-4">
        <label className="block text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: 'var(--color-surface-400)' }}>Exam Template</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {EXAM_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleTemplateChange(tpl.id)}
              className={`p-3 rounded-xl text-sm font-semibold transition-all text-left ${
                templateId === tpl.id
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
              style={{
                background: templateId === tpl.id ? 'rgba(245,158,11,0.18)' : 'var(--color-surface-900)',
                border: `1px solid ${templateId === tpl.id ? 'rgba(245,158,11,0.4)' : 'var(--color-surface-700)'}`,
              }}
            >
              <p className="font-bold mb-0.5">{tpl.name}</p>
              {tpl.id !== 'custom' && (
                <p className="text-xs opacity-60">{tpl.durationMinutes} min</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Title + timing */}
      <div className="glass p-6 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
            Test Title *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`e.g. ${EXAM_TEMPLATES.find(t => t.id === templateId)?.name ?? 'Mock'} Test — June 2025`}
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
            style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
              Duration (min)
            </label>
            <input type="number" min="30" max="600" value={duration}
              onChange={e => setDuration(+e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
              Scheduled At
            </label>
            <input type="datetime-local" value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)', colorScheme: 'dark' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
              Closes At
            </label>
            <input type="datetime-local" value={closesAt}
              onChange={e => setClosesAt(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)', colorScheme: 'dark' }} />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="glass p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => setExpandedSections(v => !v)}
            className="flex items-center gap-2 text-white font-semibold">
            {expandedSections ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Sections ({sections.length})
          </button>
          {templateId === 'custom' && (
            <button type="button"
              onClick={() => setSections(ss => [...ss, makeCustomSection()])}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Plus className="w-3.5 h-3.5" /> Add Section
            </button>
          )}
        </div>

        {templateId !== 'custom' && (
          <div className="flex items-start gap-2 p-3 rounded-lg mb-4 text-xs"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Sections are pre-configured for {EXAM_TEMPLATES.find(t => t.id === templateId)?.name}.
            Switch to &quot;Custom&quot; to modify freely.
          </div>
        )}

        {expandedSections && (
          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div key={sec.id} className="p-4 rounded-xl"
                style={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-700)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#fbbf24' }}>
                    Section {idx + 1}
                  </span>
                  {templateId === 'custom' && (
                    <button type="button" onClick={() => removeSection(sec.id)}
                      className="p-1 hover:text-red-400 transition-colors"
                      style={{ color: 'var(--color-surface-400)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-surface-400)' }}>
                      Subject {templateId === 'custom' && '(required)'}
                    </label>
                    <input
                      value={sec.subjectLabel}
                      onChange={e => updateSection(sec.id, {
                        subjectLabel: e.target.value,
                        subjectId: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                      })}
                      readOnly={templateId !== 'custom'}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                      style={{
                        background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)',
                        opacity: templateId !== 'custom' ? 0.7 : 1,
                      }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-surface-400)' }}>Questions</label>
                    <input type="number" min="1" value={sec.questionCount}
                      onChange={e => updateSection(sec.id, { questionCount: +e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                      style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-surface-400)' }}>+Marks / −Marks</label>
                    <div className="flex gap-1.5">
                      <input type="number" min="1" value={sec.marksPerCorrect}
                        onChange={e => updateSection(sec.id, { marksPerCorrect: +e.target.value })}
                        className="w-full px-2 py-2 rounded-lg text-sm text-white text-center outline-none"
                        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }} />
                      <input type="number" max="0" value={sec.marksPerIncorrect}
                        onChange={e => updateSection(sec.id, { marksPerIncorrect: +e.target.value })}
                        className="w-full px-2 py-2 rounded-lg text-sm text-white text-center outline-none"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }} />
                    </div>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--color-surface-400)' }}>
                  {sec.questionCount} questions · Max {sec.questionCount * sec.marksPerCorrect} marks
                  · Min {sec.questionCount * sec.marksPerIncorrect} marks
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="flex gap-6 mt-4 pt-4" style={{ borderTop: '1px solid rgba(245,158,11,0.15)' }}>
          <div>
            <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Total Questions</p>
            <p className="text-lg font-bold text-white">{totalQuestions}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Max Marks</p>
            <p className="text-lg font-bold" style={{ color: '#fbbf24' }}>{totalMarks}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Duration</p>
            <p className="text-lg font-bold text-white">{duration} min</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Link href="/mock-tests"
          className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ color: 'var(--color-surface-300)', background: 'var(--color-surface-800)' }}>
          Cancel
        </Link>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
          <Save className="w-4 h-4" />
          {saving ? 'Creating…' : 'Create Mock Test'}
        </button>
      </div>
    </form>
  );
}
