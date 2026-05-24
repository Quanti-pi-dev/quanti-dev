'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Trophy, Target, Users, TrendingUp,
  TrendingDown, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────

interface QuestionStat {
  questionId: string;
  questionText: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyRate: number;       // 0-100
  averageTimeMs: number;
  discriminationIndex: number; // how well the Q separates high/low scorers
}

interface SubmissionSummary {
  firebaseUid: string;
  displayName: string;
  studentUid: string | null;
  score: number;
  maxScore: number;
  percentage: number;
  timeTakenMinutes: number;
  submittedAt: string;
  rank: number;
}

interface TestAnalytics {
  testId: string;
  title: string;
  status: string;
  totalSubmissions: number;
  averageScore: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  maxScore: number;
  passRate: number;           // % who scored ≥ passingScore
  scoreDistribution: { range: string; count: number }[];
  questionStats: QuestionStat[];
  submissions: SubmissionSummary[];
  generatedAt: string;
}

// ── Score distribution colours ───────────────────────────────────
const DIST_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#6366f1'];

// ── Custom tooltip ───────────────────────────────────────────────
function BarTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs">
      <p className="text-white font-semibold mb-0.5">{label}</p>
      <p style={{ color: '#a5b4fc' }}>{payload[0]!.value} students</p>
    </div>
  );
}

function AccuracyTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs max-w-48">
      <p className="text-white font-semibold mb-0.5 truncate">{label}</p>
      <p style={{ color: '#4ade80' }}>Accuracy: {payload[0]!.value}%</p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────

export default function TestAnalyticsPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const { instituteId } = useAuth();
  const [data, setData]       = useState<TestAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [subTab, setSubTab]   = useState<'questions' | 'students'>('questions');

  useEffect(() => {
    if (!instituteId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(
          `/api/inst/v1/institutes/${instituteId}/tests/${testId}/analytics`,
        );
        setData(res.data.data as TestAnalytics);
      } catch {
        setError('Analytics not available — the test may not have any submissions yet.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [instituteId, testId]);

  if (loading) return <AnalyticsSkeleton />;

  if (error || !data) return (
    <div>
      <Link href={`/tests/${testId}`}
        className="inline-flex items-center gap-2 mb-6 text-sm transition-colors hover:text-indigo-400"
        style={{ color: 'var(--color-surface-400)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to test
      </Link>
      <div className="glass p-10 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-surface-400)' }} />
        <p className="text-white font-semibold">{error}</p>
      </div>
    </div>
  );

  const pieData = data.scoreDistribution.map((d, i) => ({
    name: d.range, value: d.count, color: DIST_COLORS[i % DIST_COLORS.length]!,
  })).filter(d => d.value > 0);

  // Sort question stats: easiest to hardest (hardest = lowest accuracy)
  const sortedQStats = [...data.questionStats].sort((a, b) => a.accuracyRate - b.accuracyRate);

  return (
    <div className="animate-fade-in max-w-6xl">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/tests/${testId}`}
          className="p-2 rounded-xl transition-colors hover:text-white shrink-0"
          style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{data.title}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-surface-300)' }}>
            Analytics · {data.totalSubmissions} submission{data.totalSubmissions !== 1 ? 's' : ''}
            {data.generatedAt && ` · updated ${new Date(data.generatedAt).toLocaleTimeString()}`}
          </p>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Users}     label="Submissions"   value={data.totalSubmissions}           color="#6366f1" />
        <KpiCard icon={Target}    label="Avg Score"     value={`${data.averagePercentage ?? 0}%`} color="#8b5cf6"
          sub={`${data.averageScore.toFixed(1)} / ${data.maxScore} marks`} />
        <KpiCard icon={CheckCircle2} label="Pass Rate"  value={`${data.passRate ?? 0}%`}        color="#22c55e" />
        <KpiCard icon={Trophy}    label="Top Score"     value={`${data.highestScore}/${data.maxScore}`} color="#f59e0b" />
      </div>

      {/* ── Two-column: distribution + summary ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Score distribution bar */}
        <div className="glass p-6">
          <h2 className="text-white font-semibold mb-4">Score Distribution</h2>
          {data.scoreDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.scoreDistribution} barSize={28}>
                <XAxis dataKey="range" tick={{ fill: '#6b6b9a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b6b9a', fontSize: 11 }} width={28} allowDecimals={false} />
                <Tooltip content={<BarTip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.scoreDistribution.map((_, i) => (
                    <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]!} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart label="No submissions yet" />}
        </div>

        {/* Pie + stats */}
        <div className="glass p-6">
          <h2 className="text-white font-semibold mb-4">Score Breakdown</h2>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]}
                    contentStyle={{ background: '#16162a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="flex-1" style={{ color: 'var(--color-surface-300)' }}>{d.name}</span>
                    <span className="font-semibold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyChart label="No data" />}

          {/* Min/Max row */}
          <div className="flex gap-4 mt-4 pt-4" style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Highest</p>
              <p className="text-white font-bold">{data.highestScore}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Lowest</p>
              <p className="text-white font-bold">{data.lowestScore}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Average</p>
              <p className="text-white font-bold">{data.averageScore.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>Max Marks</p>
              <p className="text-white font-bold">{data.maxScore}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Question accuracy bar ──────────────────────────────── */}
      {data.questionStats.length > 0 && (
        <div className="glass p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">Per-Question Accuracy</h2>
          <ResponsiveContainer width="100%" height={Math.max(200, data.questionStats.length * 36)}>
            <BarChart data={sortedQStats.map((q, i) => ({ ...q, label: `Q${i + 1}` }))}
              layout="vertical" barSize={14} margin={{ left: 8 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b6b9a', fontSize: 10 }}
                tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="label" width={28} tick={{ fill: '#6b6b9a', fontSize: 11 }} />
              <Tooltip content={<AccuracyTip />} />
              <Bar dataKey="accuracyRate" radius={[0, 4, 4, 0]} name="Accuracy">
                {sortedQStats.map((q, i) => (
                  <Cell key={i}
                    fill={q.accuracyRate >= 70 ? '#22c55e' : q.accuracyRate >= 40 ? '#f59e0b' : '#ef4444'}
                    fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs mt-3" style={{ color: 'var(--color-surface-400)' }}>
            Sorted hardest → easiest. 🔴 &lt;40% · 🟡 40–70% · 🟢 &gt;70%
          </p>
        </div>
      )}

      {/* ── Tabbed: Question detail | Student results ─────────── */}
      <div className="glass p-6">
        <div className="flex gap-2 mb-6">
          {(['questions', 'students'] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all"
              style={subTab === t
                ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }
                : { background: 'var(--color-surface-800)', color: 'var(--color-surface-300)' }}>
              {t === 'questions' ? `Questions (${data.questionStats.length})` : `Student Results (${data.submissions.length})`}
            </button>
          ))}
        </div>

        {subTab === 'questions' ? (
          <div className="space-y-3">
            {data.questionStats.length === 0 && <EmptyChart label="No question data yet" />}
            {data.questionStats.map((q, idx) => (
              <QuestionStatRow key={q.questionId} stat={q} index={idx} />
            ))}
          </div>
        ) : (
          <div>
            {/* Leaderboard-style table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
                    {['Rank', 'Student', 'Score', '%', 'Time', 'Submitted'].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--color-surface-400)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map(sub => (
                    <SubmissionRow key={sub.firebaseUid} sub={sub} maxScore={data.maxScore} />
                  ))}
                  {data.submissions.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-sm" style={{ color: 'var(--color-surface-400)' }}>
                      No submissions yet
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}22` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--color-surface-300)' }}>{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-surface-400)' }}>{sub}</p>}
    </div>
  );
}

function QuestionStatRow({ stat, index }: { stat: QuestionStat; index: number }) {
  const acc = stat.accuracyRate;
  const color = acc >= 70 ? '#4ade80' : acc >= 40 ? '#fbbf24' : '#f87171';
  const Icon = acc >= 70 ? TrendingUp : acc >= 40 ? Target : TrendingDown;

  return (
    <div className="rounded-xl p-4"
      style={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-700)' }}>
      <div className="flex items-start gap-3">
        <span className="text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm line-clamp-2 mb-3">{stat.questionText}</p>
          <div className="grid grid-cols-3 gap-4">
            {/* Accuracy */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: 'var(--color-surface-400)' }}>Accuracy</span>
                <span style={{ color }}>{acc}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-700)' }}>
                <div className="h-full rounded-full" style={{ width: `${acc}%`, background: color, opacity: 0.85 }} />
              </div>
            </div>
            {/* Attempts */}
            <div className="text-center">
              <p className="text-white font-bold text-sm">{stat.correctAttempts}/{stat.totalAttempts}</p>
              <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>correct</p>
            </div>
            {/* Avg time */}
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-surface-400)' }} />
                <p className="text-white font-bold text-sm">
                  {stat.averageTimeMs > 0 ? `${(stat.averageTimeMs / 1000).toFixed(1)}s` : '—'}
                </p>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>avg time</p>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function SubmissionRow({ sub, maxScore }: { sub: SubmissionSummary; maxScore: number }) {
  const pct = sub.percentage;
  const color = pct >= 75 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171';
  const rankColors = ['#f59e0b', '#9ca3af', '#92400e'];

  return (
    <tr className="transition-colors hover:bg-indigo-500/5"
      style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
      {/* Rank */}
      <td className="py-3 px-3">
        <span className="text-sm font-bold"
          style={{ color: sub.rank <= 3 ? (rankColors[sub.rank - 1] ?? '#e2e2f0') : 'var(--color-surface-400)' }}>
          #{sub.rank}
        </span>
      </td>
      {/* Student */}
      <td className="py-3 px-3">
        <p className="text-white text-sm font-medium">{sub.displayName}</p>
        {sub.studentUid && (
          <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>#{sub.studentUid}</p>
        )}
      </td>
      {/* Score */}
      <td className="py-3 px-3">
        <span className="text-white font-semibold">{sub.score}</span>
        <span style={{ color: 'var(--color-surface-400)' }}>/{maxScore}</span>
      </td>
      {/* % */}
      <td className="py-3 px-3">
        <span className="font-bold text-sm" style={{ color }}>{pct}%</span>
      </td>
      {/* Time */}
      <td className="py-3 px-3 text-sm" style={{ color: 'var(--color-surface-300)' }}>
        {sub.timeTakenMinutes > 0 ? `${sub.timeTakenMinutes}m` : '—'}
      </td>
      {/* Submitted */}
      <td className="py-3 px-3 text-xs" style={{ color: 'var(--color-surface-400)' }}>
        {new Date(sub.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </td>
    </tr>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--color-surface-400)' }}>
      {label}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="max-w-6xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton w-8 h-8 rounded-xl" />
        <div>
          <div className="skeleton h-7 w-56 rounded mb-2" />
          <div className="skeleton h-4 w-40 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass h-24 skeleton" />)}
      </div>
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="glass h-64 skeleton" />
        <div className="glass h-64 skeleton" />
      </div>
      <div className="glass h-80 skeleton" />
    </div>
  );
}
