'use client';

import { useAuth } from '@/contexts/auth-context';
import { Sidebar } from '@/components/sidebar';
import { adminApi } from '@/lib/api';
import { useEffect, useState } from 'react';
import { Users, BookOpen, Layers, CreditCard } from 'lucide-react';

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
  activeSubscriptions?: number;
  totalExams?: number;
  totalDecks?: number;
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

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Total Users"
            icon={Users}
            value={fetching ? '—' : (stats.totalUsers?.toLocaleString() ?? '—')}
          />
          <StatCard
            label="Active Subscriptions"
            icon={CreditCard}
            value={fetching ? '—' : (stats.activeSubscriptions?.toLocaleString() ?? '—')}
          />
          <StatCard
            label="Exams"
            icon={BookOpen}
            value={fetching ? '—' : (stats.totalExams?.toLocaleString() ?? '—')}
          />
          <StatCard
            label="Decks"
            icon={Layers}
            value={fetching ? '—' : (stats.totalDecks?.toLocaleString() ?? '—')}
          />
        </div>

        {/* Placeholder — more widgets in Phase 4 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-600 text-sm">
          More analytics widgets coming in Phase 4 (Users, Revenue, Engagement charts)
        </div>
      </main>
    </div>
  );
}
