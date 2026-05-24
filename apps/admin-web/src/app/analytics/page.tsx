'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner } from '@/components/page-shell';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────

interface OverviewData {
  totalUsers: number;
  activeUsersToday: number;
  totalSessions: number;
  totalCardsAnswered: number;
  avgAccuracyPct: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  totalCoinsInCirculation: number;
  shopItemCount: number;
  purchasedPackCount: number;
  purchasedThemeCount: number;
}

function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN')}`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData]       = useState<OverviewData | null>(null);
  const [revenueChart, setRevenueChart] = useState<{ month: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const overview = await adminApi.get<{ data: OverviewData }>('/api/admin/analytics');
      setData(overview.data.data);
    } catch { setError('Failed to load analytics.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <PageShell title="Analytics" subtitle="Platform-wide metrics">
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : data && (
        <div className="space-y-8">
          {/* Users */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Users</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users"     value={data.totalUsers.toLocaleString()} />
              <StatCard label="Active Today"    value={data.activeUsersToday.toLocaleString()} />
              <StatCard label="Total Sessions"  value={data.totalSessions.toLocaleString()} />
              <StatCard label="Avg Accuracy"    value={`${data.avgAccuracyPct.toFixed(1)}%`} />
            </div>
          </section>

          {/* Revenue section — coming soon when backend adds revenue endpoint */}

          {/* Gamification */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Gamification</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Cards Studied"   value={data.totalCardsAnswered.toLocaleString()} />
              <StatCard label="Coins Earned"    value={data.totalCoinsEarned.toLocaleString()} />
              <StatCard label="Coins Spent"     value={data.totalCoinsSpent.toLocaleString()} />
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
