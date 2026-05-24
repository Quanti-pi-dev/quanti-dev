'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, BookOpen, Send, Trash2, Edit3, Save, X, ChevronDown, ChevronUp } from 'lucide-react';

interface MockSection { subjectId: string; questionCount: number; questionIds: string[]; marksPerCorrect: number; marksPerIncorrect: number; }
interface MockTest { id: string; title: string; examTemplateId: string; examTemplateName?: string; status: 'draft' | 'scheduled' | 'live' | 'closed'; sections: MockSection[]; totalQuestions: number; totalMarks: number; durationMinutes: number; scheduledAt: string | null; closesAt: string | null; createdAt: string; }

const STATUS = {
  draft:     { label: 'Draft',     color: '#9ca3af', bg: 'rgba(107,114,128,0.15)' },
  scheduled: { label: 'Scheduled', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)' },
  live:      { label: '🔴 Live',   color: '#4ade80', bg: 'rgba(34,197,94,0.15)'  },
  closed:    { label: 'Closed',    color: '#f87171', bg: 'rgba(239,68,68,0.15)'  },
};

function apiErr(e: unknown) {
  return (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Request failed';
}

export default function MockTestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const { instituteId, instituteRole } = useAuth();
  const router = useRouter();

  const [test, setTest]         = useState<MockTest | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [publishing, setPub]    = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle]     = useState('');
  const [saving, setSaving]             = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(true);

  const canEdit = instituteRole === 'institute_admin' || instituteRole === 'examiner';

  const load = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/inst/v1/institutes/${instituteId}/mock-tests/${testId}`);
      setTest(r.data.data as MockTest);
    } catch { setError('Mock test not found or no access.'); }
    finally { setLoading(false); }
  }, [instituteId, testId]);

  useEffect(() => { void load(); }, [load]);

  const handlePublish = async () => {
    setPub(true);
    try { await api.post(`/api/inst/v1/institutes/${instituteId}/mock-tests/${testId}/publish`); await load(); }
    catch (e) { alert(apiErr(e)); } finally { setPub(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${test?.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await api.delete(`/api/inst/v1/institutes/${instituteId}/mock-tests/${testId}`); router.push('/mock-tests'); }
    catch (e) { alert(apiErr(e)); setDeleting(false); }
  };

  const saveTitle = async () => {
    if (!draftTitle.trim() || draftTitle === test?.title) { setEditingTitle(false); return; }
    setSaving(true);
    try { await api.patch(`/api/inst/v1/institutes/${instituteId}/mock-tests/${testId}`, { title: draftTitle.trim() }); await load(); setEditingTitle(false); }
    catch (e) { alert(apiErr(e)); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="animate-fade-in max-w-3xl space-y-4">
      <div className="skeleton h-8 w-64 rounded" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  );

  if (!test || error) return (
    <div className="glass p-10 text-center max-w-md mx-auto mt-12">
      <p className="text-white font-semibold mb-4">{error ?? 'Error loading test'}</p>
      <Link href="/mock-tests" className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
        <ArrowLeft className="w-4 h-4" /> Back to Mock Tests
      </Link>
    </div>
  );

  const cfg = STATUS[test.status];
  const isLocked = ['live','closed'].includes(test.status);
  const totalMarks = test.sections.reduce((s, sec) => s + sec.questionCount * sec.marksPerCorrect, 0);

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="flex items-start gap-4 mb-6">
        <Link href="/mock-tests" className="p-2 rounded-xl mt-1 shrink-0 transition-colors hover:text-white"
          style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={draftTitle} onChange={e => setDraftTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="text-2xl font-bold text-white bg-transparent outline-none border-b-2 border-amber-500 flex-1" />
              <button onClick={() => void saveTitle()} disabled={saving} className="p-1.5 text-amber-400 hover:text-amber-300"><Save className="w-4 h-4" /></button>
              <button onClick={() => setEditingTitle(false)} className="p-1.5 text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white truncate">{test.title}</h1>
              {canEdit && !isLocked && (
                <button onClick={() => { setDraftTitle(test.title); setEditingTitle(true); }}
                  className="p-1.5 rounded-lg shrink-0 transition-colors hover:text-amber-400"
                  style={{ color: 'var(--color-surface-400)' }}>
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            {test.examTemplateName && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                {test.examTemplateName}
              </span>
            )}
            <span className="text-sm" style={{ color: 'var(--color-surface-400)' }}>{test.totalQuestions} questions · {test.durationMinutes} min</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && test.status === 'draft' && (
            <>
              <button onClick={handlePublish} disabled={publishing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                <Send className="w-4 h-4" />{publishing ? 'Publishing…' : 'Publish'}
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="p-2 rounded-xl transition-colors hover:text-red-400 disabled:opacity-50"
                style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-5 text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          This test is {test.status} — editing is disabled.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { icon: Clock,    label: 'Duration',  value: `${test.durationMinutes} min` },
          { icon: BookOpen, label: 'Questions', value: test.totalQuestions },
          { icon: BookOpen, label: 'Max Marks', value: totalMarks },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-amber-400" />
              <span className="text-xs" style={{ color: 'var(--color-surface-400)' }}>{label}</span>
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {(test.scheduledAt || test.closesAt) && (
        <div className="glass p-4 mb-5 flex gap-8 text-sm">
          {test.scheduledAt && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-surface-400)' }}>Scheduled At</p><p className="text-white font-medium">{new Date(test.scheduledAt).toLocaleString()}</p></div>}
          {test.closesAt && <div><p className="text-xs mb-0.5" style={{ color: 'var(--color-surface-400)' }}>Closes At</p><p className="text-white font-medium">{new Date(test.closesAt).toLocaleString()}</p></div>}
        </div>
      )}

      <div className="glass p-6">
        <button className="flex items-center justify-between w-full mb-4" onClick={() => setSectionsOpen(o => !o)}>
          <h2 className="text-white font-semibold">Sections ({test.sections.length})</h2>
          {sectionsOpen ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-surface-400)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-surface-400)' }} />}
        </button>
        {sectionsOpen && (
          <div className="space-y-3">
            {test.sections.map((sec, idx) => (
              <div key={sec.subjectId + idx} className="p-4 rounded-xl"
                style={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-700)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#fbbf24' }}>Section {idx + 1} — {sec.subjectId}</p>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}>
                    {sec.questionIds.length} / {sec.questionCount} assigned
                  </span>
                </div>
                <div className="flex gap-6 text-sm" style={{ color: 'var(--color-surface-300)' }}>
                  <span>+{sec.marksPerCorrect} correct</span>
                  <span>{sec.marksPerIncorrect} wrong</span>
                  <span>Max {sec.questionCount * sec.marksPerCorrect} marks</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
