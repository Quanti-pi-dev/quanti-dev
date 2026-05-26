'use client';

// ─── Admin Dashboard ──────────────────────────────────────────
// Landing page: platform KPIs + quick-access navigation links.
// Fix #7: shimmer skeleton instead of '—'
// Fix #16: icons on quick-access grid

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, ErrorBanner } from '@/components/page-shell';
import {
  Users, BookOpen, CreditCard, BarChart3, Layers, Building2,
  Tag, ReceiptText, Bell, Settings, TrendingUp, Coins,
  FileQuestion, ClipboardList, Medal, Trophy, Swords, Brain,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenuePaise: number;
  activeExams: number;
}

// ─── Helpers ─────────────────────────────────────────────────

function paiseToRupee(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// ─── Shimmer skeleton for a single stat value ─────────────────

function StatSkeleton() {
  return (
    <div className="h-8 w-24 rounded-lg bg-zinc-800 animate-pulse" />
  );
}

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  accent = 'violet',
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  loading: boolean;
  accent?: 'violet' | 'emerald' | 'amber' | 'sky';
}) {
  const accentMap = {
    violet: { icon: 'text-violet-400', bg: 'bg-violet-950/40 border-violet-800/50' },
    emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/50' },
    amber: { icon: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/50' },
    sky: { icon: 'text-sky-400', bg: 'bg-sky-950/40 border-sky-800/50' },
  };
  const a = accentMap[accent];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${a.bg}`}>
        <Icon size={18} className={a.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mb-1">{label}</p>
        {loading ? <StatSkeleton /> : (
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        )}
      </div>
    </div>
  );
}

// ─── Quick-access nav items ───────────────────────────────────

const QUICK_LINKS = [
  { label: 'Exams',         href: '/exams',         icon: BookOpen,       desc: 'Manage exam hierarchy' },
  { label: 'Users',         href: '/users',         icon: Users,          desc: 'Search & audit users' },
  { label: 'Institutes',    href: '/institutes',    icon: Building2,      desc: 'Coaching & schools' },
  { label: 'Plans',         href: '/plans',         icon: CreditCard,     desc: 'Subscription tiers' },
  { label: 'Coupons',       href: '/coupons',       icon: Tag,            desc: 'Discount codes' },
  { label: 'Payments',      href: '/payments',      icon: ReceiptText,    desc: 'Refunds & history' },
  { label: 'Analytics',     href: '/analytics',     icon: BarChart3,      desc: 'Revenue & engagement' },
  { label: 'Notifications', href: '/notifications', icon: Bell,           desc: 'Push broadcasts' },
  { label: 'Decks',         href: '/decks',         icon: Layers,         desc: 'Shop content packs' },
  { label: 'Gamification',  href: '/gamification',  icon: Medal,          desc: 'Badges & streaks' },
  { label: 'Tournaments',   href: '/tournaments',   icon: Trophy,         desc: 'Competition events' },
  { label: 'Challenges',    href: '/challenges',    icon: Swords,         desc: 'Daily challenges' },
  { label: 'PYQ',           href: '/pyq',           icon: FileQuestion,   desc: 'Previous year papers' },
  { label: 'Mock Tests',    href: '/mock-tests',    icon: ClipboardList,  desc: 'Practice tests' },
  { label: 'Coin Packs',    href: '/coin-packs',    icon: Coins,          desc: 'In-app currency' },
  { label: 'Subscriptions', href: '/subscriptions', icon: TrendingUp,     desc: 'Active subscriptions' },
  { label: 'Config',        href: '/config',        icon: Settings,   desc: 'Platform settings' },
  { label: 'AI Settings',   href: '/ai-settings',   icon: Brain,      desc: 'API keys & AI models' },
];

// ─── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    adminApi.get<{ data: Stats }>('/api/admin/analytics/overview')
      .then(r => setStats(r.data.data))
      .catch(() => setError('Failed to load platform stats.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell title="Dashboard" subtitle="QuantiPi platform overview">
      {error && <ErrorBanner message={error} />}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Users"
          value={stats ? stats.totalUsers.toLocaleString('en-IN') : ''}
          icon={Users}
          loading={loading}
          accent="violet"
        />
        <StatCard
          label="Active Subscriptions"
          value={stats ? stats.activeSubscriptions.toLocaleString('en-IN') : ''}
          icon={CreditCard}
          loading={loading}
          accent="emerald"
        />
        <StatCard
          label="Total Revenue"
          value={stats ? paiseToRupee(stats.totalRevenuePaise) : ''}
          icon={BarChart3}
          loading={loading}
          accent="amber"
        />
        <StatCard
          label="Active Exams"
          value={stats ? stats.activeExams.toLocaleString('en-IN') : ''}
          icon={BookOpen}
          loading={loading}
          accent="sky"
        />
      </div>

      {/* ── Quick Access ── */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {QUICK_LINKS.map(({ label, href, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              title={desc}
              className="group flex flex-col items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-violet-700/60 hover:bg-zinc-800/60 rounded-2xl p-4 text-center transition-all duration-150"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-800 group-hover:bg-violet-950/50 border border-zinc-700 group-hover:border-violet-700/50 flex items-center justify-center transition-all">
                <Icon size={16} className="text-zinc-400 group-hover:text-violet-400 transition-colors" />
              </div>
              <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors leading-tight">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
