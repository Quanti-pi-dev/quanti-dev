'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';

interface TournamentRow {
  id: string;
  title: string;
  examId: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  entryFeeCoins: number;
  maxParticipants: number;
  participantCount: number;
  startAt: string;
  endAt: string;
}

const STATUS_VARIANT: Record<TournamentRow['status'], 'yellow' | 'green' | 'zinc' | 'red'> = {
  upcoming:  'yellow',
  active:    'green',
  completed: 'zinc',
  cancelled: 'red',
};

const COLUMNS: ColumnDef<TournamentRow, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Tournament',
    cell: ({ getValue }) => <span className="font-medium text-white">{getValue() as string}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue() as TournamentRow['status'];
      return <Badge label={s} variant={STATUS_VARIANT[s]} />;
    },
  },
  {
    accessorKey: 'entryFeeCoins',
    header: 'Entry',
    cell: ({ getValue }) => `${getValue() as number} coins`,
  },
  {
    id: 'participants',
    header: 'Participants',
    cell: ({ row }) => `${row.original.participantCount} / ${row.original.maxParticipants}`,
  },
  {
    accessorKey: 'startAt',
    header: 'Starts',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleString('en-IN'),
  },
  {
    accessorKey: 'endAt',
    header: 'Ends',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleString('en-IN'),
  },
];

export default function TournamentsPage() {
  const [rows, setRows]       = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: TournamentRow[] }>('/api/admin/tournaments');
      setRows(res.data.data);
    } catch { setError('Failed to load tournaments.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const active = rows.filter((r) => r.status === 'active').length;

  return (
    <PageShell
      title="Tournaments"
      subtitle={`${rows.length} total · ${active} active`}
    >
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={rows} pageSize={20} />}
    </PageShell>
  );
}
