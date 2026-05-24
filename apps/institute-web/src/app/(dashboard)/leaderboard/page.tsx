'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Trophy, TrendingUp, Medal, Crown } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  studentUid: string | null;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  totalParticipants: number;
  updatedAt: string;
}

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Crown className="w-4 h-4 text-yellow-400" />,
  2: <Medal className="w-4 h-4 text-gray-300" />,
  3: <Medal className="w-4 h-4 text-amber-600" />,
};

export default function LeaderboardPage() {
  const { instituteId } = useAuth();
  const [type, setType]     = useState<'global' | 'weekly'>('weekly');
  const [data, setData]     = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instituteId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(
          `/api/inst/v1/institutes/${instituteId}/leaderboard?type=${type}&limit=50`,
        );
        setData(res.data.data);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [instituteId, type]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            {data?.totalParticipants ?? '—'} participants ·{' '}
            updated {data ? new Date(data.updatedAt).toLocaleTimeString() : '—'}
          </p>
        </div>
        {/* Toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-surface-800)' }}>
          {(['weekly', 'global'] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={type === t
                ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }
                : { color: 'var(--color-surface-300)' }}>
              {t === 'weekly' ? '🔥 This Week' : '🌍 All Time'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass p-4 flex items-center gap-4">
              <div className="skeleton w-8 h-8 rounded-full" />
              <div className="skeleton w-8 h-8 rounded-full" />
              <div className="flex-1"><div className="skeleton h-4 w-40 rounded mb-2" /><div className="skeleton h-3 w-24 rounded" /></div>
              <div className="skeleton h-6 w-16 rounded" />
            </div>
          ))}
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="glass p-12 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--color-surface-300)' }} />
          <p className="text-white font-semibold">No rankings yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            Rankings will appear once students complete tests and earn scores.
          </p>
        </div>
      ) : (
        <div className="glass overflow-hidden">
          {/* Top 3 podium */}
          {data.entries.length >= 3 && (
            <div className="flex items-end justify-center gap-4 p-8 mb-2"
              style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.1) 0%, transparent 100%)' }}>
              {/* 2nd */}
              <PodiumCard entry={data.entries[1]!} />
              {/* 1st */}
              <PodiumCard entry={data.entries[0]!} tall />
              {/* 3rd */}
              <PodiumCard entry={data.entries[2]!} />
            </div>
          )}

          {/* Full list */}
          <div className="divide-y" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
            {data.entries.map((entry, idx) => {
              const isTop3 = idx < 3;
              const initials = entry.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={entry.userId}
                  className={`flex items-center gap-4 px-6 py-4 transition-colors ${isTop3 ? '' : 'hover:bg-indigo-500/5'}`}
                  style={isTop3 ? { background: 'rgba(99,102,241,0.05)' } : {}}>
                  {/* Rank */}
                  <div className="w-8 text-center shrink-0">
                    {RANK_ICONS[entry.rank] ?? (
                      <span className="text-sm font-bold" style={{ color: 'var(--color-surface-400)' }}>
                        {entry.rank}
                      </span>
                    )}
                  </div>
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                    {entry.avatarUrl
                      ? <img src={entry.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                      : initials}
                  </div>
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{entry.displayName}</p>
                    {entry.studentUid && (
                      <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>#{entry.studentUid}</p>
                    )}
                  </div>
                  {/* Score */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-bold text-white">{entry.score.toLocaleString()}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumCard({ entry, tall }: { entry: LeaderboardEntry; tall?: boolean }) {
  const initials = entry.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const height = tall ? 'h-24' : 'h-16';
  const crown = entry.rank === 1;
  return (
    <div className="flex flex-col items-center gap-2 w-24">
      {crown && <Crown className="w-5 h-5 text-yellow-400" />}
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
        style={{
          background: crown ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          border: crown ? '2px solid #fbbf24' : '2px solid rgba(99,102,241,0.4)',
        }}>
        {entry.avatarUrl
          ? <img src={entry.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
          : initials}
      </div>
      <p className="text-white text-xs font-semibold text-center truncate w-full">{entry.displayName}</p>
      <p className="text-indigo-400 text-sm font-bold">{entry.score.toLocaleString()}</p>
      <div className={`w-full ${height} rounded-t-lg flex items-center justify-center`}
        style={{ background: crown ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <span className="text-lg font-bold" style={{ color: crown ? '#fbbf24' : '#a5b4fc' }}>#{entry.rank}</span>
      </div>
    </div>
  );
}
