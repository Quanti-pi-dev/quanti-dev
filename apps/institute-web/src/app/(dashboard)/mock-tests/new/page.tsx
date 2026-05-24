'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Save, Send, Info,
  ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────

interface Section {
  id: string;
  subjectId: string;
  subjectLabel: string;
  questionCount: number;
  marksPerCorrect: number;
  marksPerIncorrect: number;
}

// ── Exam templates — mirrors what server-admin manages ──────────
const EXAM_TEMPLATES = [
  {
    id: 'neet',
    name: 'NEET',
    durationMinutes: 200,
    sections: [
      { subjectId: 'physics',   subjectLabel: 'Physics',   questionCount: 45, marksPerCorrect: 4, marksPerIncorrect: -1 },
      { subjectId: 'chemistry', subjectLabel: 'Chemistry', questionCount: 45, marksPerCorrect: 4, marksPerIncorrect: -1 },
      { subjectId: 'biology',   subjectLabel: 'Biology',   questionCount: 90, marksPerCorrect: 4, marksPerIncorrect: -1 },
    ],
  },
  {
    id: 'jee-main',
    name: 'JEE Main',
    durationMinutes: 180,
    sections: [
      { subjectId: 'physics',   subjectLabel: 'Physics',   questionCount: 30, marksPerCorrect: 4, marksPerIncorrect: -1 },
      { subjectId: 'chemistry', subjectLabel: 'Chemistry', questionCount: 30, marksPerCorrect: 4, marksPerIncorrect: -1 },
      { subjectId: 'maths',     subjectLabel: 'Mathematics', questionCount: 30, marksPerCorrect: 4, marksPerIncorrect: -1 },
    ],
  },
  {
    id: 'jee-advanced',
    name: 'JEE Advanced',
    durationMinutes: 180,
    sections: [
      { subjectId: 'physics',   subjectLabel: 'Physics',   questionCount: 18, marksPerCorrect: 4, marksPerIncorrect: -2 },
      { subjectId: 'chemistry', subjectLabel: 'Chemistry', questionCount: 18, marksPerCorrect: 4, marksPerIncorrect: -2 },
      { subjectId: 'maths',     subjectLabel: 'Mathematics', questionCount: 18, marksPerCorrect: 4, marksPerIncorrect: -2 },
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

function makeSectionId() { return crypto.randomUUID(); }

function makeCustomSection(): Section {
  return {
    id: makeSectionId(),
    subjectId: '',
    subjectLabel: 'Subject',
    questionCount: 30,
    marksPerCorrect: 4,
    marksPerIncorrect: -1,
  };
}

// ── Main page ────────────────────────────────────────────────────

export default function NewMockTestPage() {
  const { instituteId } = useAuth();
  const router = useRouter();

  const [title, setTitle]           = useState('');
  const [templateId, setTemplateId] = useState<TemplateId>('neet');
  const [duration, setDuration]     = useState(200);
  const [sections, setSections]     = useState<Section[]>(
    EXAM_TEMPLATES[0].sections.map(s => ({ ...s, id: makeSectionId() })),
  );
  const [scheduledAt, setScheduledAt] = useState('');
  const [closesAt, setClosesAt]       = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState(true);

  const applyTemplate = (id: TemplateId) => {
    setTemplateId(id);
    const tmpl = EXAM_TEMPLATES.find(t => t.id === id)!;
    setDuration(tmpl.durationMinutes);
    setSections(tmpl.sections.map(s => ({ ...s, id: makeSectionId() })));
    const defaultTitle = id !== 'custom' ? `${tmpl.name} Mock Test — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '';
    if (!title || title.match(/Mock Test/)) setTitle(defaultTitle);
  };

  const updateSection = (id: string, patch: Partial<Section>) =>
    setSections(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));

  const removeSection = (id: string) =>
    setSections(ss => ss.filter(s => s.id !== id));

  const totalMarks = sections.reduce((sum, s) => sum + s.questionCount * s.marksPerCorrect, 0);
  const totalQuestions = sections.reduce((sum, s) => sum + s.questionCount, 0);

  const save = async (publish = false) => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (sections.length === 0) { setError('Add at least one section'); return; }
    if (sections.some(s => !s.subjectId.trim())) { setError('All sections need a subject ID'); return; }

    setSaving(true); setError(null);
    try {
      const res = await api.post(`/api/inst/v1/institutes/${instituteId}/mock-tests`, {
        examTemplateId: templateId,
        examTemplateName: EXAM_TEMPLATES.find(t => t.id === templateId)?.name,
        title: title.trim(),
        sections: sections.map(s => ({
          subjectId: s.subjectId,
          questionCount: s.questionCount,
          marksPerCorrect: s.marksPerCorrect,
          marksPerIncorrect: s.marksPerIncorrect,
        })),
        durationMinutes: duration,
        scheduledAt: scheduledAt || null,
        closesAt: closesAt || null,
      });
      const testId: string = res.data.data.id;

      if (publish) {
        await api.post(`/api/inst/v1/institutes/${instituteId}/mock-tests/${testId}/publish`);
      }
      router.push('/mock-tests');
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
        <Link href="/mock-tests" className="p-2 rounded-xl transition-colors hover:text-white shrink-0"
          style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Create Mock Test</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-surface-300)' }}>
            {totalQuestions} questions · {totalMarks} marks · {duration} min
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => void save(false)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
            style={{ background: 'var(--color-surface-800)', color: 'var(--color-surface-300)', border: '1px solid var(--color-surface-600)' }}>
            <Save className="w-4 h-4" /> Draft
          </button>
          <button onClick={() => void save(true)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <Send className="w-4 h-4" /> Publish
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Exam template selector */}
      <div className="glass p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Exam Format</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {EXAM_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => applyTemplate(t.id)}
              className="py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-150"
              style={templateId === t.id
                ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }
                : { background: 'var(--color-surface-800)', color: 'var(--color-surface-300)', border: '1px solid var(--color-surface-600)' }}>
              {t.name}
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
            Test Title *
          </label>
          <input id="mock-test-title" value={title} onChange={e => setTitle(e.target.value)}
            placeholder={`e.g. ${EXAM_TEMPLATES.find(t => t.id === templateId)?.name ?? 'Mock'} Mock Test — June 2025`}
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
            style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
        </div>

        {/* Duration + schedule */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Duration (min)</label>
            <input type="number" min="30" max="600" value={duration} onChange={e => setDuration(+e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Scheduled At</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)', colorScheme: 'dark' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Closes At</label>
            <input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)', colorScheme: 'dark' }} />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="glass p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setExpandedSections(v => !v)}
            className="flex items-center gap-2 text-white font-semibold">
            {expandedSections ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Sections ({sections.length})
          </button>
          {templateId === 'custom' && (
            <button onClick={() => setSections(ss => [...ss, makeCustomSection()])}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Plus className="w-3.5 h-3.5" /> Add Section
            </button>
          )}
        </div>

        {/* Info banner for non-custom */}
        {templateId !== 'custom' && (
          <div className="flex items-start gap-2 p-3 rounded-lg mb-4 text-xs"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Sections are pre-configured for {EXAM_TEMPLATES.find(t => t.id === templateId)?.name}.
            Switch to &quot;Custom&quot; to modify them freely.
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
                    <button onClick={() => removeSection(sec.id)} className="p-1 hover:text-red-400 transition-colors"
                      style={{ color: 'var(--color-surface-400)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-surface-400)' }}>Subject Name</label>
                    <input value={sec.subjectLabel}
                      onChange={e => updateSection(sec.id, { subjectLabel: e.target.value, subjectId: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
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
                {/* Section summary */}
                <p className="text-xs mt-2" style={{ color: 'var(--color-surface-400)' }}>
                  {sec.questionCount} questions · Max {sec.questionCount * sec.marksPerCorrect} marks
                  · Min {sec.questionCount * sec.marksPerIncorrect} marks
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Total summary */}
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
    </div>
  );
}
