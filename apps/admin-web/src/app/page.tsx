'use client';

import { useAuth } from '@/contexts/auth-context';
import { Sidebar } from '@/components/sidebar';
import { adminApi } from '@/lib/api';
import { useEffect, useState } from 'react';
import { Users, BookOpen, Layers, CreditCard, Coins, BarChart3, ClipboardList } from 'lucide-react';
import Link from 'next/link';

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, delta,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  delta?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500 font-medium">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
          <Icon size={16} className="text-violet-400" />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
      {delta && <p className="text-xs text-emerald-400">{delta}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

interface Stats {
  totalUsers?: number;
  activeUsersToday?: number;
  totalSessions?: number;
  totalCardsAnswered?: number;
  avgAccuracyPct?: number;
  totalCoinsEarned?: number;
  totalCoinsSpent?: number;
  totalCoinsInCirculation?: number;
  shopItemCount?: number;
  purchasedPackCount?: number;
  purchasedThemeCount?: number;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Stats>({});
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    adminApi.get<{ data: Stats }>('/api/admin/analytics')
      .then((r) => setStats(r.data.data))
      .catch(() => {/* stats unavailable — show skeleton */})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Welcome back, {user?.email}
          </p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Users"
            icon={Users}
            value={fetching ? '—' : (stats.totalUsers?.toLocaleString() ?? '—')}
          />
          <StatCard
            label="Active Today"
            icon={BarChart3}
            value={fetching ? '—' : (stats.activeUsersToday?.toLocaleString() ?? '—')}
          />
          <StatCard
            label="Cards Studied"
            icon={ClipboardList}
            value={fetching ? '—' : (stats.totalCardsAnswered?.toLocaleString() ?? '—')}
          />
          <StatCard
            label="Avg Accuracy"
            icon={BookOpen}
            value={fetching ? '—' : (stats.avgAccuracyPct != null ? `${stats.avgAccuracyPct.toFixed(1)}%` : '—')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Coins Earned"
            icon={Coins}
            value={fetching ? '—' : (stats.totalCoinsEarned?.toLocaleString() ?? '—')}
          />
          <StatCard
            label="Coins in Circulation"
            icon={Coins}
            value={fetching ? '—' : (stats.totalCoinsInCirculation?.toLocaleString() ?? '—')}
          />
          <StatCard
            label="Exams"
            icon={BookOpen}
            value={fetching ? '—' : (stats.shopItemCount?.toLocaleString() ?? '—')}
            delta="Shop items active"
          />
          <StatCard
            label="Pack Purchases"
            icon={Layers}
            value={fetching ? '—' : (stats.purchasedPackCount?.toLocaleString() ?? '—')}
          />
        </div>

        {/* Quick-access grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {[
            { href: '/users',         label: 'Users',         sub: 'Manage accounts' },
            { href: '/exams',         label: 'Exams',         sub: 'Published content' },
            { href: '/subscriptions', label: 'Subscriptions', sub: 'Active plans' },
            { href: '/payments',      label: 'Payments',      sub: 'Revenue & refunds' },
            { href: '/plans',         label: 'Plans',         sub: 'Tier catalogue' },
            { href: '/coupons',       label: 'Coupons',       sub: 'Discount codes' },
            { href: '/gamification',  label: 'Gamification',  sub: 'Badges & shop' },
            { href: '/analytics',     label: 'Analytics',     sub: 'Full dashboard' },
          ].map(({ href, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-violet-700/50 hover:bg-zinc-800/50 transition group"
            >
              <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition">{label}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
