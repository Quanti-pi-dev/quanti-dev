'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Plus, Clock, FileText, Send, Trash2, Eye, Search } from 'lucide-react';


interface MockTest {
  id: string;
  title: string;
  examTemplateName?: string;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  status: 'draft' | 'scheduled' | 'live' | 'closed';
  scheduledAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', scheduled: 'Scheduled', live: 'Live', closed: 'Closed',
};

export default function MockTestsPage() {
  const { instituteId } = useAuth();
  const [tests, setTests]     = useState<MockTest[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const fetchTests = async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/inst/v1/institutes/${instituteId}/mock-tests?limit=50`);
      setTests(res.data.data);
      setTotal(res.data.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchTests(); }, [instituteId]);

  const handlePublish = async (testId: string) => {
    setPublishing(testId);
    try {
      await api.post(`/api/inst/v1/institutes/${instituteId}/mock-tests/${testId}/publish`);
      await fetchTests();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Publish failed';
      alert(msg);
    } finally {
      setPublishing(null);
    }
  };

  const handleDelete = async (test: MockTest) => {
    if (!confirm(`Delete "${test.title}"? This cannot be undone.`)) return;
    setDeleting(test.id);
    try {
      await api.delete(`/api/inst/v1/institutes/${instituteId}/mock-tests/${test.id}`);
      await fetchTests();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Delete failed';
      alert(msg);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = tests.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.examTemplateName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mock Tests</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            {total} mock test{total !== 1 ? 's' : ''} · exam-format tests for students
          </p>
        </div>
        <Link href="/mock-tests/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
          <Plus className="w-4 h-4" />
          New Mock Test
        </Link>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-surface-400)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search mock tests or exam type…"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
          style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass p-5">
              <div className="skeleton h-5 w-48 rounded mb-3" />
              <div className="skeleton h-4 w-64 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--color-surface-300)' }} />
          <p className="text-white font-semibold">No mock tests yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            Create a NEET, JEE, or custom exam-format mock test
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(test => (
            <div key={test.id} className="glass p-5 hover:border-amber-500/30 transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="text-white font-semibold">{test.title}</h3>
                    {test.examTemplateName && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                        {test.examTemplateName}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${test.status}`}>
                      {STATUS_LABELS[test.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs mt-2" style={{ color: 'var(--color-surface-400)' }}>
                    <span>{test.totalQuestions} questions</span>
                    <span>{test.totalMarks} marks</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {test.durationMinutes} min</span>
                    {test.scheduledAt && (
                      <span>Scheduled: {new Date(test.scheduledAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/mock-tests/${test.id}`}
                    className="p-2 rounded-lg transition-colors hover:text-amber-400"
                    style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
                    <Eye className="w-4 h-4" />
                  </Link>
                  {test.status === 'draft' && (
                    <>
                      <button onClick={() => handlePublish(test.id)} disabled={publishing === test.id}
                        className="p-2 rounded-lg transition-colors hover:text-emerald-400 disabled:opacity-50"
                        style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(test)} disabled={deleting === test.id}
                        className="p-2 rounded-lg transition-colors hover:text-red-400 disabled:opacity-50"
                        style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
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
