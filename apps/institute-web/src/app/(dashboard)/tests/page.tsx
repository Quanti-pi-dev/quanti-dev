'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Plus, Clock, Users, Eye, Send, Trash2, BarChart3, Search } from 'lucide-react';

interface CustomTest {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'scheduled' | 'live' | 'closed' | 'graded';
  questionCount: number;
  durationMinutes: number;
  scheduledAt: string | null;
  closesAt: string | null;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', scheduled: 'Scheduled', live: 'Live', closed: 'Closed', graded: 'Graded',
};

export default function TestsPage() {
  const { instituteId } = useAuth();
  const [tests, setTests]     = useState<CustomTest[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const fetchTests = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/inst/v1/institutes/${instituteId}/tests?limit=50`);
      setTests(res.data.data);
      setTotal(res.data.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { void fetchTests(); }, [fetchTests]);

  const handlePublish = async (testId: string) => {
    setPublishing(testId);
    try {
      await api.post(`/api/inst/v1/institutes/${instituteId}/tests/${testId}/publish`);
      await fetchTests();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Publish failed';
      alert(msg);
    } finally {
      setPublishing(null);
    }
  };

  const handleDelete = async (testId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This will also delete all student submissions.`)) return;
    setDeleting(testId);
    try {
      await api.delete(`/api/inst/v1/institutes/${instituteId}/tests/${testId}`);
      setTests(prev => prev.filter(t => t.id !== testId));
    } finally {
      setDeleting(null);
    }
  };

  const filtered = tests.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Custom Tests</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            {total} test{total !== 1 ? 's' : ''} · manage and publish educator tests
          </p>
        </div>
        <Link href="/tests/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
          <Plus className="w-4 h-4" />
          New Test
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-surface-400)' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tests…"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
          style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass p-5">
              <div className="skeleton h-5 w-48 rounded mb-3" />
              <div className="skeleton h-4 w-96 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-12 text-center">
          <ClipboardListEmpty />
          <p className="text-white font-semibold mt-4">No tests yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            Create your first test to get started
          </p>
          <Link href="/tests/new"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <Plus className="w-4 h-4" /> Create Test
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(test => (
            <div key={test.id} className="glass p-5 hover:border-indigo-500/30 transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="text-white font-semibold">{test.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${test.status}`}>
                      {STATUS_LABELS[test.status]}
                    </span>
                  </div>
                  <p className="text-sm truncate mb-3" style={{ color: 'var(--color-surface-300)' }}>
                    {test.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-surface-400)' }}>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {test.questionCount} questions</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {test.durationMinutes} min</span>
                    {test.scheduledAt && (
                      <span>Scheduled: {new Date(test.scheduledAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/tests/${test.id}`}
                    className="p-2 rounded-lg transition-colors hover:text-indigo-400"
                    style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}
                    title="View / Edit">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link href={`/tests/${test.id}/analytics`}
                    className="p-2 rounded-lg transition-colors hover:text-indigo-400"
                    style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}
                    title="Analytics">
                    <BarChart3 className="w-4 h-4" />
                  </Link>
                  {!test.isPublished && test.questionCount > 0 && (
                    <button onClick={() => handlePublish(test.id)} disabled={publishing === test.id}
                      className="p-2 rounded-lg transition-colors hover:text-emerald-400 disabled:opacity-50"
                      style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}
                      title="Publish">
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  {test.status === 'draft' && (
                    <button onClick={() => handleDelete(test.id, test.title)} disabled={deleting === test.id}
                      className="p-2 rounded-lg transition-colors hover:text-red-400 disabled:opacity-50"
                      style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}
                      title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClipboardListEmpty() {
  return (
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    </div>
  );
}
