'use client';

// ─── Flashcard Editor (Institute Web) ────────────────────────
// "Preview-first, click-to-edit" flashcard editor for Institute Web.
//
// Shows a live card preview at the top. Educators click on a section
// (question, options, explanation) to reveal a focused editor below
// the preview. A highlight ring marks the active section.
//
// Key difference from admin-web version:
//   Institute ImagePicker requires an `instituteId` prop.
//
// Used by: tests/new/page.tsx (per-question editor)

import { useState, useEffect, useRef } from 'react';
import { Latex } from '@/components/latex';
import { ImagePicker } from '@/components/ImagePicker';
import { Check, Type, ListChecks, MessageSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

export interface EditorOption {
  id: string;
  text: string;
  imageUrl?: string | null;
}

export interface FlashcardEditorData {
  text: string;                   // question text
  options: EditorOption[];
  correctAnswerId: string;
  explanation: string;
  imageUrl: string | null;
  explanationImageUrl: string | null;
}

type EditSection = 'question' | 'options' | 'explanation' | null;

// ─── Sub-components ───────────────────────────────────────────

const inputStyle = {
  background: 'var(--color-surface-800)',
  border: '1px solid var(--color-surface-600)',
} as const;

function SectionHeader({
  icon: Icon,
  label,
  onClose,
}: {
  icon: React.ElementType;
  label: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          <Icon className="w-3 h-3" style={{ color: '#a5b4fc' }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-surface-300)' }}>
          {label}
        </span>
      </div>
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg transition-colors hover:text-white"
        style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}
      >
        <Check className="w-3 h-3" /> Done
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

interface FlashcardEditorProps {
  data: FlashcardEditorData;
  onChange: (data: FlashcardEditorData) => void;
  instituteId: string;
  /** Max options allowed (default 5) */
  maxOptions?: number;
}

export function FlashcardEditor({
  data,
  onChange,
  instituteId,
  maxOptions = 5,
}: FlashcardEditorProps) {
  const [activeSection, setActiveSection] = useState<EditSection>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to editor panel when it opens
  useEffect(() => {
    if (activeSection && editorRef.current) {
      setTimeout(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [activeSection]);

  // ── Option helpers ────────────────────────────────────────────

  const setOptionText = (idx: number, text: string) =>
    onChange({ ...data, options: data.options.map((o, i) => i === idx ? { ...o, text } : o) });

  const setOptionImage = (idx: number, url: string | null) =>
    onChange({ ...data, options: data.options.map((o, i) => i === idx ? { ...o, imageUrl: url } : o) });

  const addOption = () => {
    onChange({ ...data, options: [...data.options, { id: crypto.randomUUID(), text: '', imageUrl: null }] });
  };

  const removeOption = (idx: number) => {
    const removed = data.options[idx];
    const newOpts = data.options.filter((_, i) => i !== idx);
    onChange({
      ...data,
      options: newOpts,
      correctAnswerId: removed?.id === data.correctAnswerId ? newOpts[0]?.id ?? '' : data.correctAnswerId,
    });
  };

  // ── Section ring class ────────────────────────────────────────

  const ringStyle = (section: EditSection): React.CSSProperties =>
    activeSection === section
      ? { outline: '2px solid rgba(99,102,241,0.6)', outlineOffset: '2px', borderRadius: 10, background: 'rgba(99,102,241,0.04)' }
      : {};

  const hintColor = (section: EditSection) =>
    activeSection === section ? '#a5b4fc' : 'var(--color-surface-600)';

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── Live Preview Card ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-surface-500)' }}>
            Tap to edit
          </span>
          {activeSection && (
            <button
              onClick={() => setActiveSection(null)}
              className="text-[10px] flex items-center gap-1 transition-colors hover:text-white"
              style={{ color: '#a5b4fc' }}
            >
              <Check className="w-2.5 h-2.5" /> Collapse editor
            </button>
          )}
        </div>

        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--color-surface-950, #09090b)', border: '1px solid var(--color-surface-800)' }}
        >
          {/* Question section */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === 'question' ? null : 'question')}
            className="w-full text-left rounded-lg p-3 -m-1 transition-all duration-200 cursor-pointer"
            style={ringStyle('question')}
          >
            {data.text.trim() ? (
              <div className="text-sm text-white font-medium leading-relaxed">
                <Latex text={data.text} />
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--color-surface-600)' }}>
                Click to add question text…
              </p>
            )}
            {data.imageUrl && (
              <img src={data.imageUrl} alt="Question" className="mt-2 rounded-lg max-h-28 object-contain" style={{ border: '1px solid var(--color-surface-700)' }} />
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <Type className="w-2.5 h-2.5" style={{ color: hintColor('question') }} />
              <span className="text-[10px]" style={{ color: hintColor('question') }}>
                Question {activeSection === 'question' && '· editing'}
              </span>
            </div>
          </button>

          {/* Options section */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === 'options' ? null : 'options')}
            className="w-full text-left rounded-lg p-3 mt-3 transition-all duration-200 cursor-pointer"
            style={ringStyle('options')}
          >
            <div className="space-y-1.5">
              {data.options.map((opt, idx) => (
                <div
                  key={opt.id}
                  className="px-3 py-1.5 rounded-lg text-xs transition-colors duration-200"
                  style={{
                    background: opt.id === data.correctAnswerId ? 'rgba(34,197,94,0.08)' : 'var(--color-surface-900)',
                    border: `1px solid ${opt.id === data.correctAnswerId ? 'rgba(34,197,94,0.3)' : 'var(--color-surface-800)'}`,
                    color: opt.id === data.correctAnswerId ? '#4ade80' : 'var(--color-surface-500)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-5 text-center shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="truncate flex-1">
                      {opt.text.trim() ? (
                        <Latex text={opt.text} />
                      ) : (
                        <span style={{ color: 'var(--color-surface-700)', fontStyle: 'italic' }}>Empty…</span>
                      )}
                    </span>
                  </div>
                  {opt.imageUrl && (
                    <img src={opt.imageUrl} alt={`Option ${String.fromCharCode(65 + idx)}`} className="mt-1 ml-7 rounded max-h-14 object-contain" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <ListChecks className="w-2.5 h-2.5" style={{ color: hintColor('options') }} />
              <span className="text-[10px]" style={{ color: hintColor('options') }}>
                Options {activeSection === 'options' && '· editing'}
              </span>
            </div>
          </button>

          {/* Explanation section */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === 'explanation' ? null : 'explanation')}
            className="w-full text-left rounded-lg p-3 mt-3 transition-all duration-200 cursor-pointer"
            style={ringStyle('explanation')}
          >
            {(data.explanation.trim() || data.explanationImageUrl) ? (
              <div className="text-xs italic border-l-2 pl-3" style={{ color: 'var(--color-surface-400)', borderColor: 'var(--color-surface-700)' }}>
                {data.explanation.trim() && <><span>💡 </span><Latex text={data.explanation} /></>}
                {data.explanationImageUrl && (
                  <img src={data.explanationImageUrl} alt="Explanation" className="mt-1 rounded max-h-16 object-contain" />
                )}
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--color-surface-700)' }}>
                Click to add explanation…
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <MessageSquare className="w-2.5 h-2.5" style={{ color: hintColor('explanation') }} />
              <span className="text-[10px]" style={{ color: hintColor('explanation') }}>
                Explanation {activeSection === 'explanation' && '· editing'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ── Focused Editor Panel ─────────────────────────────── */}
      {activeSection && (
        <div
          ref={editorRef}
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'var(--color-surface-850, var(--color-surface-800))', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          {/* ─── Question editor ──────────────────────────────── */}
          {activeSection === 'question' && (
            <>
              <SectionHeader icon={Type} label="Question" onClose={() => setActiveSection(null)} />
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-surface-300)' }}>
                  Question text <span className="font-normal" style={{ color: 'var(--color-surface-500)' }}>(supports LaTeX: $E=mc^2$)</span>
                </label>
                <textarea
                  autoFocus
                  value={data.text}
                  onChange={e => onChange({ ...data, text: e.target.value })}
                  rows={3}
                  placeholder="Enter your question… Use $…$ for inline math."
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none resize-none"
                  style={inputStyle}
                />
              </div>
              <ImagePicker
                value={data.imageUrl}
                onChange={url => onChange({ ...data, imageUrl: url })}
                instituteId={instituteId}
                label="Question Image (optional)"
                compact
              />
            </>
          )}

          {/* ─── Options editor ───────────────────────────────── */}
          {activeSection === 'options' && (
            <>
              <SectionHeader icon={ListChecks} label="Answer Options" onClose={() => setActiveSection(null)} />
              <p className="text-[11px] -mt-1 mb-2" style={{ color: 'var(--color-surface-500)' }}>
                Click the circle to mark the correct answer.
              </p>
              <div className="space-y-2">
                {data.options.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className="rounded-xl p-3 transition-all duration-200"
                    style={{
                      background: data.correctAnswerId === opt.id ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${data.correctAnswerId === opt.id ? 'rgba(99,102,241,0.25)' : 'var(--color-surface-700)'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onChange({ ...data, correctAnswerId: opt.id })}
                        className="w-5 h-5 rounded-full border-2 shrink-0 transition-all duration-150 flex items-center justify-center"
                        style={{
                          borderColor: data.correctAnswerId === opt.id ? '#6366f1' : 'var(--color-surface-600)',
                          background: data.correctAnswerId === opt.id ? '#6366f1' : 'transparent',
                        }}
                        title="Mark as correct"
                      >
                        {data.correctAnswerId === opt.id && <span className="w-2 h-2 rounded-full bg-white" />}
                      </button>
                      <span className="text-xs font-bold w-4 shrink-0" style={{ color: 'var(--color-surface-400)' }}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <input
                        value={opt.text}
                        onChange={e => setOptionText(idx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-gray-600 outline-none"
                        style={{
                          background: data.correctAnswerId === opt.id ? 'rgba(99,102,241,0.1)' : 'var(--color-surface-800)',
                          border: `1px solid ${data.correctAnswerId === opt.id ? 'rgba(99,102,241,0.4)' : 'var(--color-surface-600)'}`,
                        }}
                      />
                      {data.options.length > 2 && (
                        <button
                          onClick={() => removeOption(idx)}
                          className="p-1 transition-colors hover:text-red-400 shrink-0"
                          style={{ color: 'var(--color-surface-500)' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="ml-8 mt-1.5">
                      <ImagePicker
                        value={opt.imageUrl ?? null}
                        onChange={url => setOptionImage(idx, url)}
                        instituteId={instituteId}
                        label={`Option ${String.fromCharCode(65 + idx)} Image`}
                        compact
                      />
                    </div>
                  </div>
                ))}
              </div>
              {data.options.length < maxOptions && (
                <button
                  onClick={addOption}
                  className="text-xs flex items-center gap-1.5 transition-colors hover:text-indigo-400 pt-1"
                  style={{ color: 'var(--color-surface-400)' }}
                >
                  + Add option
                </button>
              )}
            </>
          )}

          {/* ─── Explanation editor ───────────────────────────── */}
          {activeSection === 'explanation' && (
            <>
              <SectionHeader icon={MessageSquare} label="Explanation" onClose={() => setActiveSection(null)} />
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-surface-300)' }}>
                  Explanation <span className="font-normal" style={{ color: 'var(--color-surface-500)' }}>(optional, shown after answer)</span>
                </label>
                <textarea
                  autoFocus
                  value={data.explanation}
                  onChange={e => onChange({ ...data, explanation: e.target.value })}
                  rows={3}
                  placeholder="Why is this the correct answer? Supports LaTeX."
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none resize-none"
                  style={inputStyle}
                />
              </div>
              <ImagePicker
                value={data.explanationImageUrl}
                onChange={url => onChange({ ...data, explanationImageUrl: url })}
                instituteId={instituteId}
                label="Explanation Image (optional)"
                compact
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
