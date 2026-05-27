'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { StatCard, StatCardSkeleton } from '@/components/StatCard';
import {
  GraduationCap, Users, ClipboardList, Key,
  Trophy, BookOpen, ChevronRight, BarChart3,
  AlertCircle, CheckCircle2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

interface Test {
  id: string;
  title: string;
  status: 'draft' | 'live' | 'scheduled' | 'closed' | 'graded';
  questionCount: number;
  createdAt: string;
}

interface LeaderboardEntry {
  rank: number;
  firebaseUid: string;
  displayName: string;
  email: string;
  score: number;
}

interface JoinCode {
  id: string;
  code: string;
  role: string;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
}

interface DashboardData {
  studentCount: number;
  memberCount: number;
  activeTests: number;
  draftTests: number;
  scheduledTests: number;
  tests: Test[];
  leaderboard: LeaderboardEntry[];
  activeCodes: JoinCode[];
}

const STATUS_CONFIG = {
  live:      { label: 'Live',      bg: 'rgba(34,197,94,0.12)',   text: '#4ade80',  border: 'rgba(34,197,94,0.3)' },
  draft:     { label: 'Draft',     bg: 'rgba(107,114,128,0.12)', text: '#9ca3af',  border: 'rgba(107,114,128,0.3)' },
  scheduled: { label: 'Scheduled', bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24',  border: 'rgba(245,158,11,0.3)' },
  closed:    { label: 'Closed',    bg: 'rgba(239,68,68,0.12)',   text: '#f87171',  border: 'rgba(239,68,68,0.3)' },
  graded:    { label: 'Graded',    bg: 'rgba(99,102,241,0.12)',  text: '#a5b4fc',  border: 'rgba(99,102,241,0.3)' },
} as const;

const MEDAL = ['🥇', '🥈', '🥉'];

// ── Component ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { instituteId, user, instituteRole } = useAuth();
  const router = useRouter();

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    setError(null);
    try {
      const [membersRes, studentsRes, testsRes, leaderRes, codesRes] = await Promise.allSettled([
        api.get(`/api/inst/v1/institutes/${instituteId}/members?limit=1`),
        api.get(`/api/inst/v1/institutes/${instituteId}/students?limit=1`),
        api.get(`/api/inst/v1/institutes/${instituteId}/tests?limit=50`),
        api.get(`/api/inst/v1/institutes/${instituteId}/leaderboard?limit=5`),
        api.get(`/api/inst/v1/institutes/${instituteId}/join-codes`),
      ]);

      const memberCount  = membersRes.status  === 'fulfilled' ? (membersRes.value.data.pagination?.total  ?? 0) : 0;
      const studentCount = studentsRes.status === 'fulfilled' ? (studentsRes.value.data.pagination?.total ?? 0) : 0;

      const tests: Test[] = testsRes.status === 'fulfilled' ? (testsRes.value.data.data ?? []) : [];
      const activeTests    = tests.filter(t => t.status === 'live').length;
      const draftTests     = tests.filter(t => t.status === 'draft').length;
      const scheduledTests = tests.filter(t => t.status === 'scheduled').length;

      const leaderboard: LeaderboardEntry[] =
        leaderRes.status === 'fulfilled' ? (leaderRes.value.data.data?.entries ?? []) : [];

      const allCodes: JoinCode[] =
        codesRes.status === 'fulfilled' ? (codesRes.value.data.data ?? []) : [];
      const activeCodes = allCodes.filter(c => c.isActive);

      setData({
        studentCount, memberCount,
        activeTests, draftTests, scheduledTests,
        tests: tests.slice(0, 6),
        leaderboard,
        activeCodes,
      });
    } catch {
      setError('Failed to load dashboard. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const name = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there';
  const ROLE_LABEL: Record<string, string> = {
    institute_admin: 'Admin', educator: 'Educator', examiner: 'Examiner',
  };

  return (
    <div className="animate-fade-in space-y-8">

      {/* ── Welcome header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting()}, {name} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            {ROLE_LABEL[instituteRole ?? ''] ?? ''} dashboard — here&apos;s your institute at a glance.
          </p>
        </div>
        <button
          onClick={() => router.push('/students')}
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
        >
          <GraduationCap className="w-4 h-4" />
          View Students
        </button>
      </div>

      {/* ── Error banner ───────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── KPI stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Students"
              value={data?.studentCount ?? 0}
              icon={GraduationCap}
              gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
            />
            <StatCard
              label="Staff Members"
              value={data?.memberCount ?? 0}
              icon={Users}
              gradient="linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)"
            />
            <StatCard
              label="Live Tests"
              value={data?.activeTests ?? 0}
              icon={CheckCircle2}
              gradient="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
            />
            <StatCard
              label="Active Join Codes"
              value={data?.activeCodes.length ?? 0}
              icon={Key}
              gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            />
          </>
        )}
      </div>

      {/* ── Main 2-col content ─────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Recent Tests (2/3 width) ────────────────────────── */}
        <div className="lg:col-span-2 glass p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              <h2 className="text-white font-semibold">Recent Tests</h2>
            </div>
            <div className="flex items-center gap-3">
              {!loading && data && (
                <span className="text-xs" style={{ color: 'var(--color-surface-400)' }}>
                  {data.draftTests > 0 && `${data.draftTests} draft  `}
                  {data.scheduledTests > 0 && `${data.scheduledTests} scheduled`}
                </span>
              )}
              <button onClick={() => router.push('/tests')}
                className="text-xs font-medium flex items-center gap-1 transition-colors hover:text-indigo-400"
                style={{ color: 'var(--color-surface-400)' }}>
                All tests <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ background: 'var(--color-surface-800)' }}>
                  <div className="skeleton h-4 w-48 rounded" />
                  <div className="skeleton h-5 w-16 rounded-full ml-auto" />
                </div>
              ))}
            </div>
          ) : data?.tests.length === 0 ? (
            <div className="text-center py-10">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--color-surface-300)' }} />
              <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>No tests yet</p>
              <button onClick={() => router.push('/tests/new')}
                className="mt-3 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                Create your first test →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.tests.map(t => {
                const s = STATUS_CONFIG[t.status];
                return (
                  <button key={t.id} onClick={() => router.push(`/tests/${t.id}`)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl text-left transition-all hover:bg-white/5 group"
                    style={{ background: 'var(--color-surface-800)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition-colors">
                        {t.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>
                        {t.questionCount} question{t.questionCount !== 1 ? 's' : ''} · {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                      {s.label}
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-surface-400)' }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right column ────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Top Performers */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="text-white font-semibold text-sm">Top Performers</h2>
              </div>
              <button onClick={() => router.push('/leaderboard')}
                className="text-xs flex items-center gap-1 transition-colors hover:text-indigo-400"
                style={{ color: 'var(--color-surface-400)' }}>
                Full board <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-full" />
                    <div className="flex-1">
                      <div className="skeleton h-3.5 w-28 rounded mb-1.5" />
                      <div className="skeleton h-3 w-16 rounded" />
                    </div>
                    <div className="skeleton h-5 w-10 rounded" />
                  </div>
                ))}
              </div>
            ) : data?.leaderboard.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: 'var(--color-surface-400)' }}>
                No leaderboard data yet
              </p>
            ) : (
              <div className="space-y-3">
                {data?.leaderboard.map((entry, idx) => (
                  <div key={entry.firebaseUid} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }}>
                      {idx < 3 ? MEDAL[idx] : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{entry.displayName}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-surface-400)' }}>{entry.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#a5b4fc' }}>{entry.score}</p>
                      <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Join Codes */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <h2 className="text-white font-semibold text-sm">Active Join Codes</h2>
              </div>
              <button onClick={() => router.push('/join-codes')}
                className="text-xs flex items-center gap-1 transition-colors hover:text-indigo-400"
                style={{ color: 'var(--color-surface-400)' }}>
                Manage <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 rounded-xl" />
                ))}
              </div>
            ) : data?.activeCodes.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--color-surface-400)' }}>
                No active join codes
              </p>
            ) : (
              <div className="space-y-2">
                {data?.activeCodes.slice(0, 4).map(jc => (
                  <div key={jc.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--color-surface-800)' }}>
                    <div>
                      <code className="text-sm font-bold tracking-widest" style={{ color: '#a5b4fc' }}>
                        {jc.code}
                      </code>
                      <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--color-surface-400)' }}>
                        {jc.role.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {jc.usedCount}{jc.maxUses ? `/${jc.maxUses}` : ''}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>uses</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass p-5">
            <h2 className="text-white font-semibold text-sm mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Students',           icon: GraduationCap, href: '/students',   color: '#8b5cf6' },
                { label: 'Create Test',        icon: ClipboardList, href: '/tests/new',  color: '#6366f1' },
                { label: 'Generate Join Code', icon: Key,           href: '/join-codes', color: '#f59e0b' },
                { label: 'Leaderboard',        icon: Trophy,        href: '/leaderboard', color: '#22c55e' },
              ].map(({ label, icon: Icon, href, color }) => (
                <button key={href} onClick={() => router.push(href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all hover:opacity-80"
                  style={{ background: 'var(--color-surface-800)', color: 'var(--color-surface-200)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  {label}
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--color-surface-500)' }} />
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Test status breakdown ───────────────────────────────── */}
      {!loading && data && (
        <div className="glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-white font-semibold text-sm">Test Status Breakdown</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(status => {
              const count = data.tests.filter(t => t.status === status).length;
              const s = STATUS_CONFIG[status];
              return (
                <div key={status} className="rounded-xl p-3 text-center"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <p className="text-2xl font-bold" style={{ color: s.text }}>{count}</p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: s.text }}>{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
