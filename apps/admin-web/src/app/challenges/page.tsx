'use client';

// ─── P2P Challenges Page ──────────────────────────────────────
// Admin-level read view of all platform challenges.
// Routes wired:
//   GET /api/admin/challenges  — paginated list with status filter

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Swords, Trophy, Clock, XCircle, ShieldAlert, RefreshCw } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

type ChallengeStatus = 'pending' | 'accepted' | 'completed' | 'expired' | 'declined';
type StatusFilter = 'all' | ChallengeStatus;

interface ChallengeRow {
  id: string;
  creatorId: string;
  opponentId: string;
  creatorName: string;
  opponentName: string;
  creatorScore: number;
  opponentScore: number;
  winnerId: string | null;
  betAmount: number;
  durationSeconds: number;
  status: ChallengeStatus;
  level: string;
  startedAt: string | null;
  endedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

interface Pagination {
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ─── Status config ────────────────────────────────────────────

const STATUS_CONFIG: Record<ChallengeStatus, {
  label: string;
  variant: 'zinc' | 'yellow' | 'green' | 'red' | 'violet';
  icon: React.ReactNode;
}> = {
  pending:   { label: 'Pending',   variant: 'yellow', icon: <Clock size={11} /> },
  accepted:  { label: 'Active',    variant: 'violet', icon: <Swords size={11} /> },
  completed: { label: 'Completed', variant: 'green',  icon: <Trophy size={11} /> },
  expired:   { label: 'Expired',   variant: 'zinc',   icon: <ShieldAlert size={11} /> },
  declined:  { label: 'Declined',  variant: 'red',    icon: <XCircle size={11} /> },
};

const STATUS_FILTERS: StatusFilter[] = ['all', 'pending', 'accepted', 'completed', 'expired', 'declined'];

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCoins(n: number) {
  return n === 0 ? <span className="text-zinc-600">0</span> : (
    <span className="font-semibold text-yellow-400">{n.toLocaleString()} 🪙</span>
  );
}

// ─── Columns ──────────────────────────────────────────────────

const COLUMNS: ColumnDef<ChallengeRow, unknown>[] = [
  {
    id: 'players',
    header: 'Players',
    cell: ({ row }) => {
      const c = row.original;
      const creatorWon = c.winnerId === c.creatorId;
      const oppWon     = c.winnerId === c.opponentId;
      return (
        <div className="space-y-0.5">
          <p className={`text-sm font-medium ${creatorWon ? 'text-green-400' : 'text-white'}`}>
            {c.creatorName} {creatorWon && '🏆'}
          </p>
          <p className={`text-xs ${oppWon ? 'text-green-400' : 'text-zinc-400'}`}>
            vs {c.opponentName} {oppWon && '🏆'}
          </p>
        </div>
      );
    },
  },
  {
    id: 'scores',
    header: 'Score',
    cell: ({ row }) => {
      const c = row.original;
      if (c.status !== 'completed') return <span className="text-zinc-600 text-sm">—</span>;
      return (
        <div className="text-sm font-mono">
          <span className={c.creatorScore > c.opponentScore ? 'text-green-400 font-bold' : 'text-white'}>
            {c.creatorScore}
          </span>
          <span className="text-zinc-600 mx-1">vs</span>
          <span className={c.opponentScore > c.creatorScore ? 'text-green-400 font-bold' : 'text-white'}>
            {c.opponentScore}
          </span>
        </div>
      );
    },
  },
  {
    id: 'bet',
    header: 'Bet',
    cell: ({ row }) => fmtCoins(row.original.betAmount),
  },
  {
    id: 'level',
    header: 'Level',
    cell: ({ row }) => (
      <span className="text-xs font-mono text-zinc-400 capitalize">{row.original.level}</span>
    ),
  },
  {
    id: 'duration',
    header: 'Duration',
    cell: ({ row }) => (
      <span className="text-xs text-zinc-500">{row.original.durationSeconds}s</span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const cfg = STATUS_CONFIG[row.original.status];
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">{cfg.icon}</span>
          <Badge label={cfg.label} variant={cfg.variant} />
        </div>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => (
      <span className="text-xs text-zinc-500">{fmtDate(getValue() as string)}</span>
    ),
  },
  {
    id: 'ended',
    header: 'Ended',
    cell: ({ row }) => (
      <span className="text-xs text-zinc-500">{fmtDate(row.original.endedAt)}</span>
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function ChallengesPage() {
  const [rows, setRows]         = useState<ChallengeRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [pagination, setPagination] = useState<Pagination>({ limit: PAGE_SIZE, offset: 0, hasMore: false });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const fetchChallenges = useCallback(async (status: StatusFilter, offset: number) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        status,
        limit:  String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await adminApi.get<{
        data: { challenges: ChallengeRow[]; total: number; pagination: Pagination };
      }>(`/api/admin/challenges?${params}`);
      setRows(res.data.data.challenges);
      setTotal(res.data.data.total);
      setPagination(res.data.data.pagination);
    } catch { setError('Failed to load challenges.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void fetchChallenges(statusFilter, 0);
  }, [fetchChallenges, statusFilter]);

  // ── Summary stats derived from loaded data ────────────────
  const stats = {
    total,
    completed: statusFilter === 'all' ? rows.filter(r => r.status === 'completed').length : undefined,
    activeBets: rows.filter(r => r.betAmount > 0).reduce((s, r) => s + r.betAmount, 0),
  };

  return (
    <PageShell
      title="P2P Challenges"
      subtitle={`${total.toLocaleString()} challenge${total !== 1 ? 's' : ''} platform-wide`}
      actions={
        <button
          onClick={() => fetchChallenges(statusFilter, pagination.offset)}
          className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      }
    >
      {/* ── Stats strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center shrink-0">
            <Swords size={18} className="text-violet-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{total.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Total challenges</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-600/10 flex items-center justify-center shrink-0">
            <Trophy size={18} className="text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {rows.filter(r => r.status === 'completed').length.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500">Completed (this page)</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-600/10 flex items-center justify-center shrink-0">
            <span className="text-lg">🪙</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.activeBets.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Coins bet (this page)</p>
          </div>
        </div>
      </div>

      {/* ── Status filter tabs ───────────────────────────────── */}
      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${
              statusFilter === s
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s as ChallengeStatus].label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? <Spinner /> : (
        <>
          <DataTable columns={COLUMNS} data={rows} pageSize={PAGE_SIZE} />

          {/* ── Pagination ──────────────────────────────────── */}
          {(pagination.offset > 0 || pagination.hasMore) && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
              <button
                disabled={pagination.offset === 0}
                onClick={() => fetchChallenges(statusFilter, Math.max(0, pagination.offset - PAGE_SIZE))}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Previous
              </button>
              <p className="text-xs text-zinc-600">
                Showing {pagination.offset + 1}–{Math.min(pagination.offset + rows.length, total)} of {total.toLocaleString()}
              </p>
              <button
                disabled={!pagination.hasMore}
                onClick={() => fetchChallenges(statusFilter, pagination.offset + PAGE_SIZE)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
