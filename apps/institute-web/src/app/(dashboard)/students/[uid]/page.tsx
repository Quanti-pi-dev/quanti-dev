'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Target, TrendingUp, TrendingDown, Minus,
  Flame, Calendar, AlertTriangle, Trophy, CheckCircle2,
  BookOpen, BarChart2, Activity, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────

interface TopicMastery {
  topicSlug: string;
  topicName: string;
  correct: number;
  total: number;
  accuracy: number;
  masteryPercent: number;
  highestLevel: string | null;
  highestLevelIndex: number;
  tag: 'strong' | 'studying' | 'needs_focus';
}

interface SubjectOverview {
  subjectId: string;
  subjectName: string;
  correct: number;
  total: number;
  accuracy: number | null;
  highestLevel: string | null;
  topics: TopicMastery[];
  strongTopics: TopicMastery[];
  studyingTopics: TopicMastery[];
  needsFocusTopics: TopicMastery[];
}

interface ActivityEntry {
  date: string;
  sessions: number;
  correct: number;
  studied: number;
  accuracyPct: number;
}

interface ErrorTopic {
  topicSlug: string;
  topicName: string;
  errorCount: number;
}

interface TestSubmission {
  title: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
}

interface ProgressData {
  student: {
    firebaseUid: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    studentUid: string | null;
    department: string | null;
    joinedAt: string;
  };
  overview: {
    totalCorrect: number;
    totalAttempts: number;
    overallAccuracy: number | null;
    subjectCount: number;
    currentStreak: number;
    longestStreak: number;
    lastStudyDate: string | null;
  };
  subjects: SubjectOverview[];
  activityLog: ActivityEntry[];
  topErrorTopics: ErrorTopic[];
  recentTestSubmissions: TestSubmission[];
}

// ── Level colours ────────────────────────────────────────────────
const LEVEL_COLORS: Record<string, string> = {
  Emerging:     '#6366f1',
  Developing:   '#8b5cf6',
  Proficient:   '#06b6d4',
  Master:       '#f59e0b',
};

// ── Custom tooltip for bar chart ─────────────────────────────────
function ActivityTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: '#a5b4fc' }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────

export default function StudentProgressPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const { instituteId } = useAuth();
  const [data, setData]       = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  useEffect(() => {
    if (!instituteId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(
          `/api/inst/v1/institutes/${instituteId}/students/${uid}/progress`,
        );
        setData(res.data.data as ProgressData);
        if (res.data.data.subjects?.[0]) setActiveSubject(res.data.data.subjects[0].subjectId);
      } catch {
        setError('Could not load student progress. The student may not be enrolled in this institute.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [instituteId, uid]);

  if (loading) return <LoadingSkeleton />;
  if (error || !data) return (
    <div className="glass p-10 text-center">
      <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400" />
      <p className="text-white font-semibold">{error ?? 'Unknown error'}</p>
      <Link href="/students" className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-400 hover:text-indigo-300">
        <ArrowLeft className="w-4 h-4" /> Back to students
      </Link>
    </div>
  );

  const { student, overview, subjects, activityLog, topErrorTopics, recentTestSubmissions } = data;
  const initials = student.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const activeSubjectData = subjects.find(s => s.subjectId === activeSubject);

  // Radar data: up to 6 subjects
  const radarData = subjects.slice(0, 6).map(s => ({
    subject: s.subjectName.length > 12 ? s.subjectName.slice(0, 12) + '…' : s.subjectName,
    accuracy: s.accuracy ?? 0,
  }));

  return (
    <div className="animate-fade-in max-w-6xl">
      {/* Back + header */}
      <div className="flex items-start gap-4 mb-8">
        <Link href="/students" className="p-2 rounded-xl mt-1 transition-colors hover:text-white shrink-0"
          style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
            {student.avatarUrl
              ? <img src={student.avatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover" />
              : initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{student.displayName}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm" style={{ color: 'var(--color-surface-300)' }}>{student.email}</span>
              {student.studentUid && (
                <span className="text-xs px-2 py-0.5 rounded font-mono"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}>
                  #{student.studentUid}
                </span>
              )}
              {student.department && (
                <span className="text-xs" style={{ color: 'var(--color-surface-400)' }}>{student.department}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Overview stat cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatMini
          icon={Target} label="Overall Accuracy"
          value={overview.overallAccuracy != null ? `${overview.overallAccuracy}%` : '—'}
          sub={`${overview.totalCorrect} / ${overview.totalAttempts} correct`}
          color="#6366f1"
        />
        <StatMini
          icon={BookOpen} label="Subjects Opted"
          value={overview.subjectCount}
          sub="active learning tracks"
          color="#8b5cf6"
        />
        <StatMini
          icon={Flame} label="Current Streak"
          value={`${overview.currentStreak}d`}
          sub={`Best: ${overview.longestStreak} days`}
          color="#f59e0b"
        />
        <StatMini
          icon={Calendar} label="Last Active"
          value={overview.lastStudyDate ? new Date(overview.lastStudyDate).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : 'Never'}
          sub={`Joined ${new Date(student.joinedAt).toLocaleDateString(undefined, { month:'short', year:'numeric' })}`}
          color="#22c55e"
        />
      </div>

      {/* ── Two-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Subject radar */}
        <div className="glass p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-400" /> Subject Accuracy
          </h2>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="rgba(99,102,241,0.2)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9898c0', fontSize: 10 }} />
                <Radar name="Accuracy" dataKey="accuracy" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']}
                  contentStyle={{ background: '#16162a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No subject data yet" />
          )}
        </div>

        {/* 30-day activity bar */}
        <div className="glass p-6 lg:col-span-2">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" /> 30-Day Activity
          </h2>
          {activityLog.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activityLog} barSize={8} barGap={2}>
                <XAxis dataKey="date" tick={{ fill: '#6b6b9a', fontSize: 10 }}
                  tickFormatter={d => new Date(d).toLocaleDateString(undefined, { month:'short', day:'numeric' })}
                  interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#6b6b9a', fontSize: 10 }} width={28} />
                <Tooltip content={<ActivityTooltip />} />
                <Bar dataKey="studied" name="Studied" fill="#6366f1" opacity={0.7} radius={[3,3,0,0]} />
                <Bar dataKey="correct" name="Correct" fill="#22c55e" opacity={0.8} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No session activity in the last 30 days" />
          )}
        </div>
      </div>

      {/* ── Subject deep-dive ──────────────────────────────────── */}
      {subjects.length > 0 && (
        <div className="glass p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" /> Subject Deep-Dive
            </h2>
            {/* Subject tabs */}
            <div className="flex flex-wrap gap-1.5">
              {subjects.map(s => (
                <button key={s.subjectId} onClick={() => setActiveSubject(s.subjectId)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                  style={activeSubject === s.subjectId
                    ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }
                    : { background: 'var(--color-surface-800)', color: 'var(--color-surface-300)' }}>
                  {s.subjectName}
                </button>
              ))}
            </div>
          </div>

          {activeSubjectData && (
            <div>
              {/* Subject header row */}
              <div className="flex flex-wrap items-center gap-6 pb-5 mb-5"
                style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                <div>
                  <p className="text-3xl font-bold text-white">
                    {activeSubjectData.accuracy != null ? `${activeSubjectData.accuracy}%` : '—'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>
                    Accuracy · {activeSubjectData.correct}/{activeSubjectData.total} answered
                  </p>
                </div>
                {activeSubjectData.highestLevel && (
                  <div>
                    <p className="text-sm font-semibold" style={{ color: LEVEL_COLORS[activeSubjectData.highestLevel] ?? '#a5b4fc' }}>
                      {activeSubjectData.highestLevel}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>Highest level</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-white">{activeSubjectData.topics.length}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>Topics studied</p>
                </div>
                <div className="flex gap-3">
                  <Pill color="emerald" count={activeSubjectData.strongTopics.length} label="Strong" />
                  <Pill color="amber"   count={activeSubjectData.studyingTopics.length} label="Studying" />
                  <Pill color="red"     count={activeSubjectData.needsFocusTopics.length} label="Needs Focus" />
                </div>
              </div>

              {/* Topic mastery grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {activeSubjectData.topics.map(topic => (
                  <TopicCard key={topic.topicSlug} topic={topic} />
                ))}
                {activeSubjectData.topics.length === 0 && (
                  <p className="text-sm col-span-full" style={{ color: 'var(--color-surface-400)' }}>
                    No topics studied in this subject yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom row: Error topics + Test submissions ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Top error topics */}
        <div className="glass p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Most Missed Topics
          </h2>
          {topErrorTopics.length === 0 ? (
            <EmptyState label="No errors recorded yet — great!" icon="✅" />
          ) : (
            <div className="space-y-3">
              {topErrorTopics.map((t, idx) => (
                <div key={t.topicSlug} className="flex items-center gap-3">
                  <span className="text-sm font-bold w-5 text-center shrink-0"
                    style={{ color: 'var(--color-surface-400)' }}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-white truncate">{t.topicName}</p>
                      <span className="text-xs font-semibold text-red-400 shrink-0 ml-2">{t.errorCount} errors</span>
                    </div>
                    {/* Error bar */}
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-700)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (t.errorCount / (topErrorTopics[0]?.errorCount ?? 1)) * 100)}%`,
                          background: 'linear-gradient(90deg, #ef4444, #f87171)',
                        }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent institute test results */}
        <div className="glass p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Recent Test Results
          </h2>
          {recentTestSubmissions.length === 0 ? (
            <EmptyState label="No institute tests taken yet" />
          ) : (
            <div className="space-y-3">
              {recentTestSubmissions.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-700)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      background: t.percentage >= 75
                        ? 'rgba(34,197,94,0.15)' : t.percentage >= 50
                        ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                      color: t.percentage >= 75 ? '#4ade80' : t.percentage >= 50 ? '#fbbf24' : '#f87171',
                    }}>
                    {t.percentage >= 75
                      ? <CheckCircle2 className="w-4 h-4" />
                      : t.percentage >= 50 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate font-medium">{t.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>
                      {new Date(t.submittedAt).toLocaleDateString(undefined, { day:'numeric', month:'short' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-bold text-sm">{t.score}/{t.maxScore}</p>
                    <p className="text-xs" style={{
                      color: t.percentage >= 75 ? '#4ade80' : t.percentage >= 50 ? '#fbbf24' : '#f87171',
                    }}>{t.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function StatMini({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub: string; color: string;
}) {
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}22` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--color-surface-300)' }}>{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-surface-400)' }}>{sub}</p>
    </div>
  );
}

function TopicCard({ topic: t }: { topic: TopicMastery }) {
  const tagConfig = {
    strong:      { icon: CheckCircle2, color: '#4ade80', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)',  label: 'Strong'      },
    studying:    { icon: TrendingUp,   color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', label: 'Studying'    },
    needs_focus: { icon: Target,       color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',  label: 'Needs Focus' },
  }[t.tag];
  const TagIcon = tagConfig.icon;

  return (
    <div className="p-4 rounded-xl transition-all duration-150"
      style={{ background: 'var(--color-surface-900)', border: `1px solid ${tagConfig.border}` }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-white text-sm font-medium leading-snug flex-1">{t.topicName}</p>
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: tagConfig.bg, border: `1px solid ${tagConfig.border}` }}>
          <TagIcon className="w-3 h-3" style={{ color: tagConfig.color }} />
          <span className="text-xs font-medium" style={{ color: tagConfig.color }}>{tagConfig.label}</span>
        </div>
      </div>

      {/* Mastery progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span style={{ color: 'var(--color-surface-400)' }}>Mastery</span>
          <span style={{ color: tagConfig.color }}>{t.masteryPercent}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-700)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${t.masteryPercent}%`, background: `linear-gradient(90deg, ${tagConfig.color}99, ${tagConfig.color})` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-surface-400)' }}>
        <span>{t.correct}/{t.total} correct</span>
        <span className="opacity-40">·</span>
        <span>{t.accuracy}% acc</span>
        {t.highestLevel && (
          <>
            <span className="opacity-40">·</span>
            <span style={{ color: LEVEL_COLORS[t.highestLevel] ?? '#a5b4fc' }}>{t.highestLevel}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Pill({ color, count, label }: { color: 'emerald' | 'amber' | 'red'; count: number; label: string }) {
  const cfg = {
    emerald: { bg: 'rgba(34,197,94,0.1)',  text: '#4ade80',  border: 'rgba(34,197,94,0.25)' },
    amber:   { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24',  border: 'rgba(245,158,11,0.25)' },
    red:     { bg: 'rgba(239,68,68,0.1)',  text: '#f87171',  border: 'rgba(239,68,68,0.25)' },
  }[color];
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}>
      <span className="text-base font-bold">{count}</span>
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-3xl mb-2">{icon ?? '📊'}</span>
      <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>{label}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <div className="skeleton w-8 h-8 rounded-xl" />
        <div className="skeleton w-14 h-14 rounded-2xl" />
        <div>
          <div className="skeleton h-6 w-48 rounded mb-2" />
          <div className="skeleton h-4 w-64 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass p-4 h-24 skeleton" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass p-6 h-72 skeleton" />
        <div className="glass p-6 h-72 skeleton lg:col-span-2" />
      </div>
      <div className="glass p-6 h-64 skeleton" />
    </div>
  );
}
