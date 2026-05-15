'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';

interface ChallengeRow {
  id: string;
  challengerEmail: string;
  opponentEmail: string;
  status: 'pending' | 'active' | 'completed' | 'expired' | 'abandoned';
  wagerCoins: number;
  createdAt: string;
}

const STATUS_VARIANT: Record<ChallengeRow['status'], 'yellow' | 'green' | 'zinc' | 'red' | 'red'> = {
  pending:   'yellow',
  active:    'green',
  completed: 'zinc',
  expired:   'red',
  abandoned: 'red',
};

const COLUMNS: ColumnDef<ChallengeRow, unknown>[] = [
  {
    accessorKey: 'challengerEmail',
    header: 'Challenger',
    cell: ({ getValue }) => <span className="text-white">{getValue() as string}</span>,
  },
  { accessorKey: 'opponentEmail', header: 'Opponent' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue() as ChallengeRow['status'];
      return <Badge label={s} variant={STATUS_VARIANT[s]} />;
    },
  },
  {
    accessorKey: 'wagerCoins',
    header: 'Wager',
    cell: ({ getValue }) => `${getValue() as number} coins`,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
  },
];

export default function ChallengesPage() {
  const [rows, setRows]       = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: ChallengeRow[] }>('/api/admin/challenges');
      setRows(res.data.data);
    } catch { setError('Failed to load challenges.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <PageShell title="P2P Challenges" subtitle={`${rows.length} challenges`}>
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={rows} pageSize={20} />}
    </PageShell>
  );
}
