'use client';

// ─── Mock Tests Page ──────────────────────────────────────────
// CRUD for curated mock test templates.
// Routes wired:
//   GET    /api/admin/mock-tests
//   POST   /api/admin/mock-tests
//   PUT    /api/admin/mock-tests/:id
//   DELETE /api/admin/mock-tests/:id
//
// The "New / Edit" wizard has 3 steps:
//   1. Pick Exam        — dropdown from /api/admin/exams
//   2. Pick Subjects    — checkboxes from /api/admin/exams/:id/subjects
//                         (skippable with "Use All Subjects")
//   3. Settings         — title, time limit, card count, sort order, active

import { useEffect, useState, useCallback, useId } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { Latex } from '@/components/latex';
import { ImagePicker } from '@/components/image-picker';
import {
  Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, Check, BookOpen, Layers, Settings2,
  Search, MessageSquarePlus, CircleCheck, Circle, Sparkles,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface MockTest {
  _id: string;
  title: string;
  description: string;
  examId: string;
  cardIds: string[];
  subjectIds: string[];
  cardCount: number;
  timeLimitMinutes: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  customQuestions?: CustomQuestion[];
}

interface CustomQuestion {
  _id: string;
  question: string;
  options: { id: string; text: string; imageUrl?: string | null }[];
  correctAnswerId: string;
  explanation: string;
  imageUrl?: string | null;
  explanationImageUrl?: string | null;
}

interface ExamOption {
  id: string;
  title: string;
  category: string;
  isPublished: boolean;
}

interface SubjectOption {
  subjectId: string;
  subject: { id: string; name: string; accent?: string } | null;
}

// ─── Shared styles ────────────────────────────────────────────

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';
const PREVIEW_LABEL = 'text-[10px] text-zinc-600 mb-0.5';

/** Live LaTeX preview shown under a textarea when the text contains $ */
function LatexPreview({ text }: { text: string }) {
  if (!text || !text.includes('$')) return null;
  return (
    <div className="mt-1.5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800">
      <p className={PREVIEW_LABEL}>Preview</p>
      <Latex text={text} className="text-sm text-zinc-300" />
    </div>
  );
}

function apiError(err: unknown) {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Unknown error';
}

// ─── Step Indicator ──────────────────────────────────────────

const STEPS = [
  { icon: BookOpen,  label: 'Exam' },
  { icon: Layers,    label: 'Subjects' },
  { icon: Settings2, label: 'Settings' },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  done   ? 'bg-violet-600 text-white'
                  : active ? 'bg-violet-600/20 border-2 border-violet-500 text-violet-400'
                           : 'bg-zinc-800 border border-zinc-700 text-zinc-600'
                }`}
              >
                {done ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-violet-400' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 h-px mx-1 mb-4 transition-colors duration-300 ${i < current ? 'bg-violet-600' : 'bg-zinc-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Exam Picker ─────────────────────────────────────

function StepExam({
  exams, loading, selected, onSelect,
}: {
  exams: ExamOption[];
  loading: boolean;
  selected: ExamOption | null;
  onSelect: (e: ExamOption) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400 mb-4">Choose the exam this mock test belongs to.</p>
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exams…"
          className={`${INPUT} pl-8`}
          autoFocus
        />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">Loading exams…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-sm">No exams found</div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {filtered.map(exam => (
            <button
              key={exam.id}
              onClick={() => onSelect(exam)}
              className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 ${
                selected?.id === exam.id
                  ? 'border-violet-500 bg-violet-600/10 text-white'
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{exam.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{exam.category}</span>
                  {selected?.id === exam.id && <Check size={14} className="text-violet-400 shrink-0" />}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Subject Picker ───────────────────────────────────

function StepSubjects({
  subjects, loading, selected, onToggle, onUseAll,
}: {
  subjects: SubjectOption[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onUseAll: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-zinc-400">Pick subjects to sample cards from.</p>
        <button
          onClick={onUseAll}
          className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2 transition"
        >
          Use All Subjects →
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">Loading subjects…</div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-zinc-400 text-sm">No subjects attached to this exam.</p>
          <p className="text-zinc-600 text-xs mt-1">All cards will be sampled globally.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => subjects.forEach(s => s.subject && !selected.has(s.subjectId) && onToggle(s.subjectId))}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
            >
              Select All
            </button>
            <button
              onClick={() => subjects.forEach(s => selected.has(s.subjectId) && onToggle(s.subjectId))}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
            >
              Clear
            </button>
            {selected.size > 0 && (
              <span className="text-xs text-violet-400 px-2 py-1">{selected.size} selected</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {subjects.map(s => {
              const id    = s.subjectId;
              const name  = s.subject?.name ?? id;
              const color = s.subject?.accent ?? '#7c3aed';
              const on    = selected.has(id);
              return (
                <button
                  key={id}
                  onClick={() => onToggle(id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
                    on
                      ? 'border-violet-500 bg-violet-600/10 text-white'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium leading-tight line-clamp-2">{name}</span>
                  {on && <Check size={11} className="text-violet-400 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 3: Settings ─────────────────────────────────────────

interface SettingsForm {
  title: string;
  description: string;
  cardCount: number;
  timeLimitMinutes: number;
  sortOrder: number;
  isActive: boolean;
}

function StepSettings({
  form, setForm, selectedExam, selectedSubjectCount,
}: {
  form: SettingsForm;
  setForm: React.Dispatch<React.SetStateAction<SettingsForm>>;
  selectedExam: ExamOption | null;
  selectedSubjectCount: number;
}) {
  const set = (k: keyof SettingsForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({
      ...p,
      [k]: ['cardCount', 'timeLimitMinutes', 'sortOrder'].includes(k) ? Number(e.target.value) : e.target.value,
    }));

  return (
    <div className="space-y-4">
      {/* Summary pill */}
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-xs bg-violet-600/15 border border-violet-500/30 text-violet-400 px-2.5 py-1 rounded-full">
          {selectedExam?.title}
        </span>
        <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 px-2.5 py-1 rounded-full">
          {selectedSubjectCount === 0 ? 'All subjects' : `${selectedSubjectCount} subject${selectedSubjectCount !== 1 ? 's' : ''}`}
        </span>
      </div>

      <div>
        <label className={LABEL}>Title *</label>
        <input value={form.title} onChange={set('title')} placeholder="e.g. UPSC 2024 Full Mock" className={INPUT} autoFocus />
      </div>
      <div>
        <label className={LABEL}>Description</label>
        <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Optional description…" className={INPUT} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={LABEL}>Card Count</label>
          <input type="number" min={1} max={200} value={form.cardCount} onChange={set('cardCount')} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Time (min, 0=∞)</label>
          <input type="number" min={0} max={300} value={form.timeLimitMinutes} onChange={set('timeLimitMinutes')} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Sort Order</label>
          <input type="number" min={0} value={form.sortOrder} onChange={set('sortOrder')} className={INPUT} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
        className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition"
      >
        {form.isActive
          ? <ToggleRight size={22} className="text-violet-400" />
          : <ToggleLeft size={22} className="text-zinc-600" />}
        {form.isActive ? 'Active (visible to students)' : 'Inactive (hidden)'}
      </button>
    </div>
  );
}

// ─── Wizard Modal ─────────────────────────────────────────────

function MockTestWizard({
  test,
  onClose,
  onSaved,
}: {
  test: MockTest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!test;

  // ── wizard state ──────────────────────────────────────────
  const [step, setStep] = useState(isEdit ? 2 : 0);

  // Step 1
  const [exams, setExams]         = useState<ExamOption[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamOption | null>(null);

  // Step 2
  const [subjects, setSubjects]         = useState<SubjectOption[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    new Set(test?.subjectIds ?? []),
  );

  // Step 3
  const [form, setForm] = useState<SettingsForm>({
    title:            test?.title            ?? '',
    description:      test?.description      ?? '',
    cardCount:        test?.cardCount        ?? 30,
    timeLimitMinutes: test?.timeLimitMinutes ?? 45,
    sortOrder:        test?.sortOrder        ?? 0,
    isActive:         test?.isActive         ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  // ── Load exams ──────────────────────────────────────────
  useEffect(() => {
    setExamsLoading(true);
    adminApi.get<{ data: ExamOption[] }>('/api/admin/exams?pageSize=200')
      .then(res => {
        setExams(res.data.data);
        // If editing, pre-select the exam
        if (isEdit && test?.examId) {
          const found = res.data.data.find(e => e.id === test.examId);
          if (found) setSelectedExam(found);
        }
      })
      .catch(() => {/* silent – user sees no exam list */})
      .finally(() => setExamsLoading(false));
  }, [isEdit, test?.examId]);

  // ── Load subjects when exam changes ─────────────────────
  useEffect(() => {
    if (!selectedExam) { setSubjects([]); return; }
    setSubjectsLoading(true);
    adminApi.get<{ data: SubjectOption[] }>(`/api/admin/exams/${selectedExam.id}/subjects`)
      .then(res => setSubjects(res.data.data))
      .catch(() => setSubjects([]))
      .finally(() => setSubjectsLoading(false));
  }, [selectedExam]);

  // ── Navigation ───────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return !!selectedExam;
    return true;
  };

  const goNext = () => {
    setError('');
    if (step === 2) { handleSubmit(); return; }
    setStep(s => s + 1);
  };

  const goBack = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handleUseAll = () => {
    setSelectedSubjects(new Set());
    setStep(2);
  };

  const toggleSubject = (id: string) =>
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!selectedExam && !isEdit) { setError('Please select an exam.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      title:            form.title,
      description:      form.description,
      examId:           selectedExam?.id ?? test?.examId,
      cardCount:        form.cardCount,
      timeLimitMinutes: form.timeLimitMinutes,
      isActive:         form.isActive,
      sortOrder:        form.sortOrder,
      subjectIds:       Array.from(selectedSubjects),
      cardIds:          [], // managed separately via custom questions
    };
    try {
      if (isEdit) await adminApi.put(`/api/admin/mock-tests/${test!._id}`, payload);
      else await adminApi.post('/api/admin/mock-tests', payload);
      onSaved();
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  };

  // ── Backdrop click ───────────────────────────────────────
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8 px-4"
    >
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? 'Edit Mock Test' : 'New Mock Test'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 transition text-zinc-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Error */}
        {error && <ErrorBanner message={error} />}

        {/* Step content */}
        <div className="min-h-[220px]">
          {step === 0 && (
            <StepExam
              exams={exams}
              loading={examsLoading}
              selected={selectedExam}
              onSelect={setSelectedExam}
            />
          )}
          {step === 1 && (
            <StepSubjects
              subjects={subjects}
              loading={subjectsLoading}
              selected={selectedSubjects}
              onToggle={toggleSubject}
              onUseAll={handleUseAll}
            />
          )}
          {step === 2 && (
            <StepSettings
              form={form}
              setForm={setForm}
              selectedExam={selectedExam}
              selectedSubjectCount={selectedSubjects.size}
            />
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center gap-3 pt-5 mt-2 border-t border-zinc-800">
          {step > 0 ? (
            <button
              onClick={goBack}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white hover:border-zinc-600 transition"
            >
              <ChevronLeft size={14} /> Back
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={goNext}
            disabled={!canNext() || saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-40"
          >
            {saving
              ? 'Saving…'
              : step === 2
              ? isEdit ? 'Save Changes' : 'Create Mock Test'
              : <>Next <ChevronRight size={14} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Question Editor Modal ────────────────────────────

const OPTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];

function QuestionEditorModal({
  test,
  onClose,
}: {
  test: MockTest;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const uid = useId();

  // list of questions already saved on this mock test
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // inline form
  const blank = (): Omit<CustomQuestion, '_id'> => ({
    question: '',
    options: [
      { id: 'A', text: '', imageUrl: null },
      { id: 'B', text: '', imageUrl: null },
      { id: 'C', text: '', imageUrl: null },
      { id: 'D', text: '', imageUrl: null },
    ],
    correctAnswerId: 'A',
    explanation: '',
    imageUrl: null,
    explanationImageUrl: null,
  });
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // load questions
  const fetchQuestions = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await adminApi.get<{ data: CustomQuestion[] }>(
        `/api/admin/mock-tests/${test._id}/questions`,
      );
      setQuestions(res.data.data);
    } catch { /* silent */ } finally { setListLoading(false); }
  }, [test._id]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // option helpers
  const setOptionText = (idx: number, val: string) =>
    setForm(p => {
      const opts = [...p.options];
      opts[idx] = { ...opts[idx], text: val };
      return { ...p, options: opts };
    });

  const setOptionImage = (idx: number, url: string | null) =>
    setForm(p => {
      const opts = [...p.options];
      opts[idx] = { ...opts[idx], imageUrl: url };
      return { ...p, options: opts };
    });

  const addOption = () =>
    setForm(p => ({
      ...p,
      options: [...p.options, { id: OPTION_IDS[p.options.length] ?? String(p.options.length + 1), text: '', imageUrl: null }],
    }));

  const removeOption = (idx: number) =>
    setForm(p => ({
      ...p,
      options: p.options.filter((_, i) => i !== idx),
      correctAnswerId: p.options[idx]?.id === p.correctAnswerId ? p.options[0]?.id ?? '' : p.correctAnswerId,
    }));

  // start editing an existing question
  const startEdit = (q: CustomQuestion) => {
    setEditingId(q._id);
    setForm({
      question: q.question,
      options: q.options.map(o => ({ ...o, imageUrl: o.imageUrl ?? null })),
      correctAnswerId: q.correctAnswerId,
      explanation: q.explanation,
      imageUrl: q.imageUrl ?? null,
      explanationImageUrl: q.explanationImageUrl ?? null,
    });
    setFormError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(blank());
    setFormError('');
  };

  // save (create or update)
  const handleSave = async () => {
    if (!form.question.trim()) { setFormError('Question text is required.'); return; }
    if (form.options.some(o => !o.text.trim())) { setFormError('All option texts must be filled.'); return; }
    if (!form.options.find(o => o.id === form.correctAnswerId)) { setFormError('Select a correct answer.'); return; }
    setSaving(true); setFormError('');
    try {
      if (editingId) {
        await adminApi.put(`/api/admin/mock-tests/${test._id}/questions/${editingId}`, form);
        toast.success('Question updated');
      } else {
        await adminApi.post(`/api/admin/mock-tests/${test._id}/questions`, form);
        toast.success('Question added');
      }
      setEditingId(null);
      setForm(blank());
      await fetchQuestions();
    } catch (err) { setFormError(apiError(err)); } finally { setSaving(false); }
  };

  // delete
  const handleDelete = async (qid: string) => {
    setDeletingId(qid);
    try {
      await adminApi.delete(`/api/admin/mock-tests/${test._id}/questions/${qid}`);
      toast.success('Question removed');
      await fetchQuestions();
    } catch { toast.error('Failed to delete question'); } finally { setDeletingId(null); }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 backdrop-blur-sm py-8 px-4"
    >
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-white">Custom Questions</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{test.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Existing questions list ── */}
          {listLoading ? (
            <div className="flex items-center justify-center py-6 text-zinc-500 text-sm">Loading…</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-6">
              <Sparkles size={20} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No custom questions yet. Add one below.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div key={q._id} className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-md shrink-0 mt-0.5">Q{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-200 leading-snug">
                        <Latex text={q.question} />
                      </div>
                      {q.imageUrl && (
                        <img src={q.imageUrl} alt="Question" className="mt-2 rounded-lg border border-zinc-700 max-h-20 object-contain" />
                      )}
                      <div className="grid grid-cols-2 gap-1 mt-2">
                        {q.options.map(opt => (
                          <div
                            key={opt.id}
                            className={`text-xs px-2 py-1 rounded-lg ${
                              opt.id === q.correctAnswerId
                                ? 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-300'
                                : 'text-zinc-400'
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              {opt.id === q.correctAnswerId
                                ? <CircleCheck size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                                : <Circle size={11} className="text-zinc-600 shrink-0 mt-0.5" />}
                              <Latex text={opt.text} className="leading-snug" />
                            </div>
                            {opt.imageUrl && (
                              <img src={opt.imageUrl} alt={`Option ${opt.id}`} className="mt-1 ml-4 rounded max-h-14 object-contain" />
                            )}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="mt-2 text-xs text-zinc-500 italic">
                          <Latex text={q.explanation} />
                        </div>
                      )}
                      {q.explanationImageUrl && (
                        <img src={q.explanationImageUrl} alt="Explanation" className="mt-1.5 rounded-lg border border-zinc-700 max-h-16 object-contain" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => editingId === q._id ? cancelEdit() : startEdit(q)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"
                        title="Edit"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(q._id)}
                        disabled={deletingId === q._id}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Question form ── */}
          <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {editingId ? 'Edit Question' : 'New Question'}
            </p>

            {formError && <ErrorBanner message={formError} />}

            {/* Question text */}
            <div>
              <label htmlFor={`${uid}-q`} className={LABEL}>
                Question <span className="text-zinc-600 font-normal">(supports LaTeX: $E=mc^2$)</span>
              </label>
              <textarea
                id={`${uid}-q`}
                rows={3}
                value={form.question}
                onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
                placeholder="Type question here. Use $…$ for inline math, $$…$$ for display math."
                className={INPUT}
              />
              <LatexPreview text={form.question} />
            </div>

            {/* Question image */}
            <ImagePicker
              value={form.imageUrl}
              onChange={url => setForm(p => ({ ...p, imageUrl: url }))}
              label="Question Image (optional)"
              compact
            />

            {/* Options */}
            <div>
              <label className={LABEL}>Options <span className="text-zinc-600 font-normal">(click ● to mark correct)</span></label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={opt.id} className="flex items-start gap-2">
                    <button
                      onClick={() => setForm(p => ({ ...p, correctAnswerId: opt.id }))}
                      title="Mark as correct answer"
                      className={`mt-2 shrink-0 transition ${
                        opt.id === form.correctAnswerId ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      {opt.id === form.correctAnswerId
                        ? <CircleCheck size={16} />
                        : <Circle size={16} />}
                    </button>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-4 shrink-0">{opt.id}.</span>
                        <input
                          value={opt.text}
                          onChange={e => setOptionText(i, e.target.value)}
                          placeholder={`Option ${opt.id}`}
                          className={INPUT}
                        />
                        {form.options.length > 2 && (
                          <button
                            onClick={() => removeOption(i)}
                            className="text-zinc-600 hover:text-red-400 transition shrink-0"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <LatexPreview text={opt.text} />
                      <div className="ml-4">
                        <ImagePicker
                          value={opt.imageUrl ?? null}
                          onChange={url => setOptionImage(i, url)}
                          label={`Option ${opt.id} Image`}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {form.options.length < 6 && (
                <button
                  onClick={addOption}
                  className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition flex items-center gap-1"
                >
                  <Plus size={12} /> Add Option
                </button>
              )}
            </div>

            {/* Explanation */}
            <div>
              <label htmlFor={`${uid}-exp`} className={LABEL}>
                Explanation <span className="text-zinc-600 font-normal">(optional, shown after answer)</span>
              </label>
              <textarea
                id={`${uid}-exp`}
                rows={2}
                value={form.explanation}
                onChange={e => setForm(p => ({ ...p, explanation: e.target.value }))}
                placeholder="Optional explanation. Supports LaTeX."
                className={INPUT}
              />
              <LatexPreview text={form.explanation} />
              <div className="mt-1.5">
                <ImagePicker
                  value={form.explanationImageUrl}
                  onChange={url => setForm(p => ({ ...p, explanationImageUrl: url }))}
                  label="Explanation Image (optional)"
                  compact
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center gap-2 pt-1">
              {editingId && (
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-40"
              >
                <MessageSquarePlus size={14} />
                {saving ? 'Saving…' : editingId ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>

        </div>{/* /p-6 */}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function MockTestsPage() {
  const [tests, setTests]       = useState<MockTest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [modal, setModal]       = useState<false | 'new' | MockTest>(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MockTest | null>(null);
  const [deleteError, setDeleteError]   = useState('');
  const [questionsTarget, setQuestionsTarget] = useState<MockTest | null>(null);
  const { toast } = useToast();

  const fetchTests = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: MockTest[] }>('/api/admin/mock-tests');
      setTests(res.data.data);
    } catch { setError('Failed to load mock tests.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget._id); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/mock-tests/${deleteTarget._id}`);
      setDeleteTarget(null);
      toast.success('Mock test deleted');
      await fetchTests();
    } catch (err) { setDeleteError(apiError(err)); } finally { setDeleting(null); }
  };

  const COLUMNS: ColumnDef<MockTest, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ getValue }) => (
        <span className="font-medium text-white text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'cardCount',
      header: 'Cards',
      cell: ({ row }) => (
        <span className="text-zinc-400 text-sm">
          {row.original.cardCount} cards
          {row.original.subjectIds.length > 0 && (
            <span className="ml-1.5 text-[10px] text-zinc-600">
              · {row.original.subjectIds.length} subject{row.original.subjectIds.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'timeLimitMinutes',
      header: 'Time',
      cell: ({ getValue }) => {
        const mins = getValue() as number;
        return <span className="text-zinc-400 text-sm">{mins === 0 ? 'Untimed' : `${mins} min`}</span>;
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge label={(getValue() as boolean) ? 'Active' : 'Draft'} variant={(getValue() as boolean) ? 'green' : 'zinc'} />
      ),
    },
    {
      accessorKey: 'sortOrder',
      header: 'Order',
      cell: ({ getValue }) => <span className="text-zinc-500 text-sm">#{getValue() as number}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const qCount = row.original.customQuestions?.length ?? 0;
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setQuestionsTarget(row.original)}
              className="flex items-center gap-1 p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition text-xs"
              title="Manage custom questions"
            >
              <MessageSquarePlus size={13} />
              {qCount > 0 && <span className="text-[10px] text-violet-400">{qCount}</span>}
            </button>
            <button
              onClick={() => setModal(row.original)}
              className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => { setDeleteTarget(row.original); setDeleteError(''); }}
              disabled={deleting === row.original._id}
              className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      title="Mock Tests"
      subtitle={`${tests.length} template${tests.length !== 1 ? 's' : ''}`}
      actions={
        <button
          onClick={() => setModal('new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={14} /> New Mock Test
        </button>
      }
    >
      {questionsTarget && (
        <QuestionEditorModal
          test={questionsTarget}
          onClose={() => { setQuestionsTarget(null); fetchTests(); }}
        />
      )}
      {modal !== false && (
        <MockTestWizard
          test={typeof modal === 'object' ? modal : null}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); fetchTests(); }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Mock Test"
          description={`Are you sure you want to delete "${deleteTarget.title}"?`}
          confirmLabel="Delete Mock Test"
          destructive
          loading={deleting === deleteTarget._id}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={tests} pageSize={20} />}
    </PageShell>
  );
}
