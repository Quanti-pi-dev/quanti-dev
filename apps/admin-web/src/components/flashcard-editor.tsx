'use client';

// ─── Flashcard Editor ─────────────────────────────────────────
// Shared "preview-first, click-to-edit" flashcard editor.
//
// Shows a live card preview at the top. Admins click on sections
// (question, options, explanation) to reveal a focused editor
// below the preview. A pulsing highlight ring marks the active
// section in the preview so it's always clear what's being edited.
//
// Used by:  Decks CardModal, Mock Tests QuestionEditorModal

import { useState, useEffect, useRef, useCallback } from 'react';
import { Latex } from '@/components/latex';
import { ImagePicker } from '@/components/image-picker';
import { Check, Tag, Type, ListChecks, MessageSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

export interface EditorOption {
  id: string;
  text: string;
  imageUrl?: string | null;
}

export interface FlashcardData {
  question: string;
  options: EditorOption[];
  correctAnswerId: string;
  explanation: string;
  imageUrl: string | null;
  explanationImageUrl: string | null;
  /** BKT concept tags — used by the ML engine to track per-concept mastery. */
  tags: string[];
}

type EditSection = 'question' | 'options' | 'explanation' | 'tags' | null;

// ─── Styles ───────────────────────────────────────────────────

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Live LaTeX preview for textareas ─────────────────────────

function LatexPreview({ text }: { text: string }) {
  if (!text || !text.includes('$')) return null;
  return (
    <div className="mt-1.5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800">
      <p className="text-[10px] text-zinc-600 mb-0.5">Preview</p>
      <Latex text={text} className="text-sm text-zinc-300" />
    </div>
  );
}

// ─── Section Header (used in edit panels) ─────────────────────

function SectionHeader({ icon: Icon, label, onClose }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-violet-600/15 border border-violet-500/25 flex items-center justify-center">
          <Icon size={12} className="text-violet-400" />
        </div>
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{label}</span>
      </div>
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition px-2 py-1 rounded-lg hover:bg-zinc-800"
      >
        <Check size={12} /> Done
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

interface FlashcardEditorProps {
  data: FlashcardData;
  onChange: (data: FlashcardData) => void;
  /** Maximum number of options allowed (default: 4, mock tests allow up to 6) */
  maxOptions?: number;
  /** Whether options can be added/removed (default: false) */
  variableOptions?: boolean;
}

// ─── Tag Input ────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');

  const addTag = useCallback((raw: string) => {
    const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (cleaned && !tags.includes(cleaned)) {
      onChange([...tags, cleaned]);
    }
    setInput('');
  }, [tags, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-600/15 border border-violet-500/30 text-violet-300 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter(t => t !== tag))}
              className="text-violet-500 hover:text-violet-200 transition ml-0.5"
              title="Remove tag"
            >×</button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-xs text-zinc-600 italic">No concept tags yet</span>
        )}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(input);
          } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder="Type a concept tag and press Enter (e.g. kinematics-1d)"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
      />
      <p className="text-[10px] text-zinc-600">
        Tags map to BKT concepts. Use kebab-case (e.g. <span className="text-zinc-500">newtons-law-1</span>, <span className="text-zinc-500">fundamental-rights</span>). Spaces are auto-converted to hyphens.
      </p>
    </div>
  );
}

export function FlashcardEditor({
  data,
  onChange,
  maxOptions = 4,
  variableOptions = false,
}: FlashcardEditorProps) {
  const [activeSection, setActiveSection] = useState<EditSection>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to editor when section changes
  useEffect(() => {
    if (activeSection && editorRef.current) {
      setTimeout(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [activeSection]);

  // ── Helpers ──────────────────────────────────────────────────

  const setOptionText = (idx: number, text: string) =>
    onChange({ ...data, options: data.options.map((o, i) => i === idx ? { ...o, text } : o) });

  const setOptionImage = (idx: number, url: string | null) =>
    onChange({ ...data, options: data.options.map((o, i) => i === idx ? { ...o, imageUrl: url } : o) });

  const addOption = () => {
    const OPTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
    const newId = OPTION_IDS[data.options.length] ?? String(data.options.length + 1);
    onChange({ ...data, options: [...data.options, { id: newId, text: '', imageUrl: null }] });
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

  // ── Section highlight classes ────────────────────────────────

  const sectionClass = (section: EditSection) =>
    activeSection === section
      ? 'ring-2 ring-violet-500/60 ring-offset-1 ring-offset-zinc-950 bg-violet-950/15'
      : 'hover:ring-1 hover:ring-zinc-600/50 hover:ring-offset-1 hover:ring-offset-zinc-950';

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Live Preview Card ─────────────────────────────────── */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            Tap to edit
          </span>
          {activeSection && (
            <button
              onClick={() => setActiveSection(null)}
              className="text-[10px] text-violet-400 hover:text-violet-300 transition flex items-center gap-1"
            >
              <Check size={10} /> Collapse editor
            </button>
          )}
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-lg">
          {/* Question Section */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === 'question' ? null : 'question')}
            className={`w-full text-left rounded-lg p-3 -m-1 transition-all duration-200 cursor-pointer ${sectionClass('question')}`}
          >
            {data.question.trim() ? (
              <div className="text-sm text-white font-medium leading-relaxed">
                <Latex text={data.question} />
              </div>
            ) : (
              <p className="text-sm text-zinc-600 italic">Click to add question text…</p>
            )}
            {data.imageUrl && (
              <img src={data.imageUrl} alt="Question" className="mt-2 rounded-lg border border-zinc-800 max-h-32 object-contain" />
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <Type size={10} className={activeSection === 'question' ? 'text-violet-400' : 'text-zinc-700'} />
              <span className={`text-[10px] ${activeSection === 'question' ? 'text-violet-400' : 'text-zinc-700'}`}>
                Question {activeSection === 'question' && '· editing'}
              </span>
            </div>
          </button>

          {/* Options Section */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === 'options' ? null : 'options')}
            className={`w-full text-left rounded-lg p-3 mt-3 transition-all duration-200 cursor-pointer ${sectionClass('options')}`}
          >
            <div className="grid grid-cols-2 gap-1.5">
              {data.options.map(opt => (
                <div
                  key={opt.id}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors duration-200 ${
                    opt.id === data.correctAnswerId
                      ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                      : 'bg-zinc-900 border border-zinc-800/50 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold shrink-0">{opt.id}.</span>
                    <span className="truncate">
                      {opt.text.trim() ? (
                        <Latex text={opt.text} />
                      ) : (
                        <span className="text-zinc-700 italic">Empty…</span>
                      )}
                    </span>
                  </div>
                  {opt.imageUrl && (
                    <img src={opt.imageUrl} alt={`Option ${opt.id}`} className="mt-1 rounded max-h-16 object-contain" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <ListChecks size={10} className={activeSection === 'options' ? 'text-violet-400' : 'text-zinc-700'} />
              <span className={`text-[10px] ${activeSection === 'options' ? 'text-violet-400' : 'text-zinc-700'}`}>
                Options {activeSection === 'options' && '· editing'}
              </span>
            </div>
          </button>

          {/* Explanation Section */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === 'explanation' ? null : 'explanation')}
            className={`w-full text-left rounded-lg p-3 mt-3 transition-all duration-200 cursor-pointer ${sectionClass('explanation')}`}
          >
            {(data.explanation.trim() || data.explanationImageUrl) ? (
              <div className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3">
                {data.explanation.trim() && <Latex text={data.explanation} />}
                {data.explanationImageUrl && (
                  <img src={data.explanationImageUrl} alt="Explanation" className="mt-1 rounded max-h-20 object-contain" />
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-700 italic">Click to add explanation…</p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <MessageSquare size={10} className={activeSection === 'explanation' ? 'text-violet-400' : 'text-zinc-700'} />
              <span className={`text-[10px] ${activeSection === 'explanation' ? 'text-violet-400' : 'text-zinc-700'}`}>
                Explanation {activeSection === 'explanation' && '· editing'}
              </span>
            </div>
          </button>

          {/* Tags Section */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === 'tags' ? null : 'tags')}
            className={`w-full text-left rounded-lg p-3 mt-3 transition-all duration-200 cursor-pointer ${sectionClass('tags')}`}
          >
            <div className="flex flex-wrap gap-1">
              {(data.tags ?? []).length > 0 ? (
                (data.tags ?? []).map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-violet-900/40 border border-violet-700/40 text-violet-300 text-[10px]">{t}</span>
                ))
              ) : (
                <span className="text-xs text-zinc-700 italic">Click to add ML concept tags…</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Tag size={10} className={activeSection === 'tags' ? 'text-violet-400' : 'text-zinc-700'} />
              <span className={`text-[10px] ${activeSection === 'tags' ? 'text-violet-400' : 'text-zinc-700'}`}>
                Concept Tags {activeSection === 'tags' && '· editing'}{(data.tags ?? []).length > 0 && ` · ${(data.tags ?? []).length}`}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ── Focused Editor Panel ─────────────────────────────── */}
      {activeSection && (
        <div
          ref={editorRef}
          className="bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200"
        >
          {/* ─── Question Editor ───────────────────────────── */}
          {activeSection === 'question' && (
            <>
              <SectionHeader icon={Type} label="Question" onClose={() => setActiveSection(null)} />
              <div>
                <label className={LABEL}>
                  Question text <span className="text-zinc-600 font-normal">(supports LaTeX: $E=mc^2$)</span>
                </label>
                <textarea
                  autoFocus
                  value={data.question}
                  onChange={e => onChange({ ...data, question: e.target.value })}
                  rows={3}
                  placeholder="Enter question text… Use $…$ for inline math."
                  className={INPUT}
                />
                <LatexPreview text={data.question} />
              </div>
              <ImagePicker
                value={data.imageUrl}
                onChange={url => onChange({ ...data, imageUrl: url })}
                label="Question Image (optional)"
                compact
              />
            </>
          )}

          {/* ─── Options Editor ─────────────────────────────── */}
          {activeSection === 'options' && (
            <>
              <SectionHeader icon={ListChecks} label="Answer Options" onClose={() => setActiveSection(null)} />
              <p className="text-[11px] text-zinc-500 -mt-1 mb-2">
                Click the radio button to mark the correct answer.
              </p>
              <div className="space-y-3">
                {data.options.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className="rounded-xl p-3 transition-all duration-200"
                    style={{
                      background: data.correctAnswerId === opt.id ? 'rgba(16, 185, 129, 0.06)' : 'rgba(39, 39, 42, 0.4)',
                      border: data.correctAnswerId === opt.id ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(63, 63, 70, 0.4)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="flashcard-correct"
                        value={opt.id}
                        checked={data.correctAnswerId === opt.id}
                        onChange={() => onChange({ ...data, correctAnswerId: opt.id })}
                        className="accent-emerald-500 shrink-0 w-4 h-4 cursor-pointer"
                        title="Mark as correct"
                      />
                      <span className="text-xs font-bold text-zinc-400 w-5 shrink-0">{opt.id}</span>
                      <input
                        value={opt.text}
                        onChange={e => setOptionText(idx, e.target.value)}
                        placeholder={`Option ${opt.id}`}
                        className={INPUT}
                      />
                      {variableOptions && data.options.length > 2 && (
                        <button
                          onClick={() => removeOption(idx)}
                          className="text-zinc-600 hover:text-red-400 transition shrink-0 text-xs"
                          title="Remove option"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <LatexPreview text={opt.text} />
                    <div className="ml-7 mt-1.5">
                      <ImagePicker
                        value={opt.imageUrl ?? null}
                        onChange={url => setOptionImage(idx, url)}
                        label={`Option ${opt.id} Image`}
                        compact
                      />
                    </div>
                  </div>
                ))}
              </div>
              {variableOptions && data.options.length < maxOptions && (
                <button
                  onClick={addOption}
                  className="mt-1 text-xs text-violet-400 hover:text-violet-300 transition flex items-center gap-1"
                >
                  + Add Option
                </button>
              )}
            </>
          )}

          {/* ─── Explanation Editor ─────────────────────────── */}
          {activeSection === 'explanation' && (
            <>
              <SectionHeader icon={MessageSquare} label="Explanation" onClose={() => setActiveSection(null)} />
              <div>
                <label className={LABEL}>
                  Explanation <span className="text-zinc-600 font-normal">(optional, shown after answer)</span>
                </label>
                <textarea
                  autoFocus
                  value={data.explanation}
                  onChange={e => onChange({ ...data, explanation: e.target.value })}
                  rows={3}
                  placeholder="Why is this the correct answer? Supports LaTeX."
                  className={INPUT}
                />
                <LatexPreview text={data.explanation} />
              </div>
              <ImagePicker
                value={data.explanationImageUrl}
                onChange={url => onChange({ ...data, explanationImageUrl: url })}
                label="Explanation Image (optional)"
                compact
              />
            </>
          )}

          {/* ─── Tags Editor ────────────────────────────────── */}
          {activeSection === 'tags' && (
            <>
              <SectionHeader icon={Tag} label="Concept Tags (ML)" onClose={() => setActiveSection(null)} />
              <TagInput
                tags={data.tags ?? []}
                onChange={tags => onChange({ ...data, tags })}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
