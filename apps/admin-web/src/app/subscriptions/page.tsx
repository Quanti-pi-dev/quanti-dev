'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface SubscriptionRow {
  id: string;
  userEmail: string;
  planName: string;
  planTier: number;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  startedAt: string;
  expiresAt: string | null;
  amountPaise: number;
}

type SubStatus = SubscriptionRow['status'];

const STATUS_VARIANT: Record<SubStatus, 'green' | 'red' | 'yellow' | 'zinc'> = {
  active:    'green',
  expired:   'red',
  cancelled: 'zinc',
  pending:   'yellow',
};

function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

// ─── Columns ─────────────────────────────────────────────────

const COLUMNS: ColumnDef<SubscriptionRow, unknown>[] = [
  {
    accessorKey: 'userEmail',
    header: 'User',
    cell: ({ getValue }) => (
      <span className="font-medium text-white">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'planName',
    header: 'Plan',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue() as SubStatus;
      return <Badge label={s} variant={STATUS_VARIANT[s]} />;
    },
  },
  {
    accessorKey: 'amountPaise',
    header: 'Amount',
    cell: ({ getValue }) => paise(getValue() as number),
  },
  {
    accessorKey: 'startedAt',
    header: 'Started',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
  },
  {
    accessorKey: 'expiresAt',
    header: 'Expires',
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString('en-IN') : '—';
    },
  },
];

// ─── Filter bar ──────────────────────────────────────────────

const STATUSES: Array<SubStatus | 'all'> = ['all', 'active', 'expired', 'cancelled', 'pending'];

// ─── Page ─────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [rows, setRows]         = useState<SubscriptionRow[]>([]);
  const [filtered, setFiltered] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [status, setStatus]     = useState<SubStatus | 'all'>('all');

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.get<{ data: SubscriptionRow[] }>('/api/admin/subscriptions');
      setRows(res.data.data);
    } catch {
      setError('Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  useEffect(() => {
    setFiltered(status === 'all' ? rows : rows.filter((r) => r.status === status));
  }, [rows, status]);

  return (
    <PageShell
      title="Subscriptions"
      subtitle={`${filtered.length} subscriptions`}
    >
      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              status === s
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={filtered} pageSize={25} />}
    </PageShell>
  );
}
