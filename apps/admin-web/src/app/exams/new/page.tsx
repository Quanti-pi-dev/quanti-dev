'use client';

// ─── Create Exam Modal ────────────────────────────────────────
// Standalone page rendered in a modal-like full-screen overlay.
// POST /api/admin/exams

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, ErrorBanner } from '@/components/page-shell';
import { ArrowLeft } from 'lucide-react';

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

export default function NewExamPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    durationMinutes: 60,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: k === 'durationMinutes' ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.category.trim()) {
      setError('Title, description and category are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await adminApi.post<{ data: { id: string } }>('/api/admin/exams', form);
      router.push(`/exams/${res.data.data.id}`);
    } catch {
      setError('Failed to create exam. Please try again.');
      setSaving(false);
    }
  };

  return (
    <PageShell
      title="New Exam"
      subtitle="Create a new exam"
      actions={
        <button
          onClick={() => router.push('/exams')}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft size={14} /> Back to Exams
        </button>
      }
    >
      <div className="max-w-lg">
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div>
            <label className={LABEL}>Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="e.g. UPSC CSE Prelims" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Description *</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              placeholder="Brief description of the exam…"
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Category *</label>
            <input value={form.category} onChange={set('category')} placeholder="e.g. Civil Services" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Duration (minutes)</label>
            <input
              type="number"
              min={1}
              value={form.durationMinutes}
              onChange={set('durationMinutes')}
              className={INPUT}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/exams')}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating…' : 'Create Exam'}
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
