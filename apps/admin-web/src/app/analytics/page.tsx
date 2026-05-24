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
  activeTodayUsers: number;
  totalSessions: number;
  totalCardsStudied: number;
  avgAccuracy: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  revenue: {
    totalRevenuePaise: number;
    monthlyRevenuePaise: number;
    paidUsers: number;
  };
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
      const [overview, revenue] = await Promise.all([
        adminApi.get<{ data: OverviewData }>('/api/admin/analytics'),
        adminApi.get<{ data: { monthly: { month: string; revenue: number }[] } }>('/api/admin/analytics/revenue'),
      ]);
      setData(overview.data.data);
      setRevenueChart(revenue.data.data.monthly ?? []);
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
              <StatCard label="Active Today"    value={data.activeTodayUsers.toLocaleString()} />
              <StatCard label="Total Sessions"  value={data.totalSessions.toLocaleString()} />
              <StatCard label="Avg Accuracy"    value={`${data.avgAccuracy.toFixed(1)}%`} />
            </div>
          </section>

          {/* Revenue */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Revenue</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <StatCard label="Total Revenue"   value={paise(data.revenue.totalRevenuePaise)} />
              <StatCard label="This Month"      value={paise(data.revenue.monthlyRevenuePaise)} />
              <StatCard label="Paid Users"      value={data.revenue.paidUsers.toLocaleString()}
                        sub={`${data.activeSubscriptions} active subs`} />
            </div>

            {revenueChart.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <p className="text-sm font-medium text-zinc-400 mb-4">Monthly Revenue (₹)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueChart} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false}
                           tickFormatter={(v) => `₹${(v / 100).toLocaleString('en-IN')}`} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(v: number) => [paise(v), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Gamification */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Gamification</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Cards Studied"   value={data.totalCardsStudied.toLocaleString()} />
              <StatCard label="Coins Earned"    value={data.totalCoinsEarned.toLocaleString()} />
              <StatCard label="Coins Spent"     value={data.totalCoinsSpent.toLocaleString()} />
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
