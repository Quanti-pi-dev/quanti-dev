'use client';

// ─── Analytics Page ───────────────────────────────────────────
// Full platform observability + revenue dashboard.
// Routes wired:
//   GET /api/admin/analytics                  — engagement KPIs
//   GET /api/admin/analytics/revenue-dashboard — combined revenue (subs + coin packs)
//   GET /api/admin/analytics/revenue           — daily revenue last 30 days
//   GET /api/admin/analytics/coin-packs        — coin pack sales summary + daily
//   GET /api/admin/analytics/subscriptions     — sub counts by status

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, InlineSpinner, ErrorBanner } from '@/components/page-shell';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

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

interface RevenueDashboard {
  subscriptions: {
    totalRevenuePaise: number;
    paymentCount: number;
    last7dPaise: number;
    last30dPaise: number;
  };
  coinPacks: {
    totalRevenuePaise: number;
    purchaseCount: number;
    last7dPaise: number;
    last30dPaise: number;
  };
  totalRevenuePaise: number;
  totalUsers: number;
  activeToday: number;
}

interface DailyRevenue {
  day: string;
  total_paise: string;
  payment_count: string;
}

interface SubStatus {
  status: string;
  count: string;
  new_30d: string;
}

interface CoinPackAnalytics {
  summary: {
    total_purchases: string;
    total_revenue_paise: string;
    total_coins_sold: string;
    pending_count: string;
  };
  daily: Array<{
    day: string;
    revenue_paise: string;
    coins_sold: string;
    purchase_count: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────

function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function shortDay(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`;
}

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, trend }: {
  label: string; value: string | number; sub?: string;
  accent?: 'violet' | 'green' | 'yellow' | 'red' | 'blue';
  trend?: 'up' | 'down';
}) {
  const ACCENTS = {
    violet: 'text-violet-400',
    green:  'text-emerald-400',
    yellow: 'text-yellow-400',
    red:    'text-red-400',
    blue:   'text-sky-400',
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className={`text-2xl font-bold ${ACCENTS[accent ?? 'violet']}`}>{value}</p>
      {(sub || trend) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {trend === 'up'   && <TrendingUp  size={12} className="text-emerald-400" />}
          {trend === 'down' && <TrendingDown size={12} className="text-red-400" />}
          {sub && <p className="text-xs text-zinc-600">{sub}</p>}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">{label}</h2>;
}

function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">{title}</p>
      {children}
    </div>
  );
}

const TOOLTIP_STYLE = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

const TICK = { fill: '#71717a', fontSize: 11 };
const PIE_COLORS = ['#7c3aed', '#059669', '#ca8a04', '#dc2626', '#6366f1'];

// ─── Page ─────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [overview, setOverview]         = useState<OverviewData | null>(null);
  const [revDash,  setRevDash]          = useState<RevenueDashboard | null>(null);
  const [dailyRev, setDailyRev]         = useState<DailyRevenue[]>([]);
  const [subStatus, setSubStatus]       = useState<SubStatus[]>([]);
  const [coinPacks, setCoinPacks]       = useState<CoinPackAnalytics | null>(null);
  // Per-section loading (fix #17) — each section renders as its data arrives
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRevDash,  setLoadingRevDash]  = useState(true);
  const [loadingDailyRev, setLoadingDailyRev] = useState(true);
  const [loadingSubStatus,setLoadingSubStatus]= useState(true);
  const [loadingCoinPacks,setLoadingCoinPacks]= useState(true);
  const [error,    setError]            = useState('');
  const [refreshKey, setRefreshKey]     = useState(0);

  // Convenience: still true while ANY section is loading
  const loading = loadingOverview || loadingRevDash || loadingDailyRev || loadingSubStatus || loadingCoinPacks;

  const fetchAll = useCallback(async () => {
    // Reset loading states for each section independently
    setLoadingOverview(true); setLoadingRevDash(true); setLoadingDailyRev(true);
    setLoadingSubStatus(true); setLoadingCoinPacks(true);
    setError('');

    // Fire all requests simultaneously; each section renders as it resolves
    adminApi.get<{ data: OverviewData }>('/api/admin/analytics')
      .then(r => setOverview(r.data.data))
      .catch(() => setError('Failed to load engagement overview.'))
      .finally(() => setLoadingOverview(false));

    adminApi.get<{ data: RevenueDashboard }>('/api/admin/analytics/revenue-dashboard')
      .then(r => setRevDash(r.data.data))
      .catch(() => {})
      .finally(() => setLoadingRevDash(false));

    adminApi.get<{ data: DailyRevenue[] }>('/api/admin/analytics/revenue')
      .then(r => setDailyRev(r.data.data))
      .catch(() => {})
      .finally(() => setLoadingDailyRev(false));

    adminApi.get<{ data: SubStatus[] }>('/api/admin/analytics/subscriptions')
      .then(r => setSubStatus(r.data.data))
      .catch(() => {})
      .finally(() => setLoadingSubStatus(false));

    adminApi.get<{ data: CoinPackAnalytics }>('/api/admin/analytics/coin-packs')
      .then(r => setCoinPacks(r.data.data))
      .catch(() => {})
      .finally(() => setLoadingCoinPacks(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll, refreshKey]);

  // ─── Derived chart data ────────────────────────────────────

  // Daily revenue (30 days, ascending)
  const dailyChartData = [...dailyRev]
    .reverse()
    .map(r => ({
      day: shortDay(r.day),
      revenue: Math.round(parseInt(r.total_paise) / 100),
      payments: parseInt(r.payment_count),
    }));

  // Subscription status pie
  const subPieData = subStatus.map(r => ({
    name: r.status,
    value: parseInt(r.count),
    new30d: parseInt(r.new_30d),
  }));

  // Coin pack daily (last 14 days)
  const cpDailyData = (coinPacks?.daily ?? [])
    .slice(0, 14)
    .reverse()
    .map(r => ({
      day: shortDay(r.day),
      revenue: Math.round(parseInt(r.revenue_paise) / 100),
      coins: parseInt(r.coins_sold),
    }));

  // Combined revenue split for bar
  const revSplitData = revDash ? [
    { source: 'Subscriptions', revenue: Math.round(revDash.subscriptions.totalRevenuePaise / 100) },
    { source: 'Coin Packs',    revenue: Math.round(revDash.coinPacks.totalRevenuePaise / 100) },
  ] : [];

  // Coin economy from overview
  const coinEconData = overview ? [
    { label: 'Earned',         value: overview.totalCoinsEarned },
    { label: 'Spent',          value: overview.totalCoinsSpent },
    { label: 'In Circulation', value: overview.totalCoinsInCirculation },
  ] : [];

  return (
    <PageShell
      title="Analytics"
      subtitle="Platform-wide metrics, revenue & observability"
      actions={
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-sm transition disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      }
    >
      {error && <ErrorBanner message={error} />}
      <div className="space-y-12">

        {/* ── Loading skeletons for sections not yet resolved ── */}
        {(loadingRevDash || loadingDailyRev) && (
          <div className="h-40 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse flex items-center justify-center gap-2 text-zinc-700 text-sm">
            <InlineSpinner className="text-zinc-700" /> Loading revenue data…
          </div>
        )}

          {/* ── Revenue Dashboard KPIs ─────────────────────── */}
          {revDash && (
            <section>
              <SectionTitle label="Revenue Overview" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  label="Total Revenue"
                  value={paise(revDash.totalRevenuePaise)}
                  accent="green"
                  sub="All time captured"
                />
                <StatCard
                  label="Subscription Revenue"
                  value={paise(revDash.subscriptions.totalRevenuePaise)}
                  accent="violet"
                  sub={`${revDash.subscriptions.paymentCount} payments`}
                />
                <StatCard
                  label="Coin Pack Revenue"
                  value={paise(revDash.coinPacks.totalRevenuePaise)}
                  accent="yellow"
                  sub={`${revDash.coinPacks.purchaseCount} purchases`}
                />
                <StatCard
                  label="Revenue (Last 30d)"
                  value={paise(revDash.subscriptions.last30dPaise + revDash.coinPacks.last30dPaise)}
                  accent="blue"
                  sub={`7d: ${paise(revDash.subscriptions.last7dPaise + revDash.coinPacks.last7dPaise)}`}
                  trend="up"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Revenue by source */}
                {revSplitData.length > 0 && (
                  <ChartBox title="Revenue by Source (All Time)">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={revSplitData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                        <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="source" tick={{ ...TICK, fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                        <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                          <Cell fill="#7c3aed" />
                          <Cell fill="#ca8a04" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartBox>
                )}

                {/* Daily revenue 30-day area chart */}
                {dailyChartData.length > 0 && (
                  <ChartBox title="Daily Revenue (Last 30 days, ₹)">
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={dailyChartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} interval={4} />
                        <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                        <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="url(#rev-grad)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartBox>
                )}
              </div>
            </section>
          )}

          {/* ── Subscription Analytics ────────────────────── */}
          {subStatus.length > 0 && (
            <section>
              <SectionTitle label="Subscription Analytics" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartBox title="Status Distribution">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={subPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {subPieData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartBox>

                {/* Status breakdown table */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">By Status</p>
                  <div className="space-y-2">
                    {subPieData.map((s, idx) => (
                      <div key={s.name} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="text-sm text-zinc-400 capitalize flex-1">{s.name}</span>
                        <span className="text-sm font-bold text-white">{s.value.toLocaleString()}</span>
                        <span className="text-xs text-zinc-600">+{s.new30d} (30d)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Coin Pack Revenue ──────────────────────────── */}
          {coinPacks && (
            <section>
              <SectionTitle label="Coin Pack Revenue" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Purchases" value={parseInt(coinPacks.summary.total_purchases ?? '0').toLocaleString()} />
                <StatCard label="Coins Sold"      value={parseInt(coinPacks.summary.total_coins_sold ?? '0').toLocaleString()} accent="yellow" />
                <StatCard label="Coin Pack Revenue" value={paise(parseInt(coinPacks.summary.total_revenue_paise ?? '0'))} accent="green" />
                <StatCard label="Pending Purchases" value={parseInt(coinPacks.summary.pending_count ?? '0').toLocaleString()} accent="red" />
              </div>
              {cpDailyData.length > 0 && (
                <ChartBox title="Coin Pack Daily Revenue (Last 14 days, ₹)">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={cpDailyData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false} />
                      <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                      <Bar dataKey="revenue" fill="#ca8a04" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
              )}
            </section>
          )}

          {/* ── Engagement KPIs ────────────────────────────── */}
          {overview && (
            <section>
              <SectionTitle label="Users & Engagement" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Users"    value={overview.totalUsers.toLocaleString()} accent="violet" />
                <StatCard label="Active Today"   value={overview.activeUsersToday.toLocaleString()} accent="green" />
                <StatCard label="Total Sessions" value={overview.totalSessions.toLocaleString()} />
                <StatCard label="Avg Accuracy"   value={`${overview.avgAccuracyPct.toFixed(1)}%`} accent="yellow" sub={`${overview.totalCardsAnswered.toLocaleString()} cards`} />
              </div>

              <SectionTitle label="Coin Economy" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Coins Earned"      value={overview.totalCoinsEarned.toLocaleString()} accent="yellow" />
                  <StatCard label="Coins Spent"        value={overview.totalCoinsSpent.toLocaleString()} />
                  <StatCard label="In Circulation"     value={overview.totalCoinsInCirculation.toLocaleString()} accent="green" />
                  <StatCard label="Pack Purchases"     value={overview.purchasedPackCount.toLocaleString()} accent="violet" />
                </div>
                <ChartBox title="Coin Economy">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={coinEconData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" tick={{ ...TICK, fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toLocaleString(), 'Coins']} />
                      <Bar dataKey="value" fill="#ca8a04" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>
            </section>
          )}

          <p className="text-xs text-zinc-700 text-right pt-2">
            Data fetched: {new Date().toLocaleString('en-IN')}
          </p>
        </div>
    </PageShell>
  );
}
