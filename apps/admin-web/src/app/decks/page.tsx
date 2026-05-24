'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface DeckRow {
  id: string;
  title: string;
  category: string;
  cardCount: number;
  isPublished: boolean;
  createdAt: string;
}

const COLUMNS: ColumnDef<DeckRow, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ getValue }) => <span className="font-medium text-white">{getValue() as string}</span>,
  },
  { accessorKey: 'category', header: 'Category' },
  {
    accessorKey: 'cardCount',
    header: 'Cards',
    cell: ({ getValue }) => (
      <span className="tabular-nums">{(getValue() as number).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: 'isPublished',
    header: 'Status',
    cell: ({ getValue }) => (
      <Badge label={(getValue() as boolean) ? 'Published' : 'Draft'} variant={(getValue() as boolean) ? 'green' : 'zinc'} />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
  },
];

export default function DecksPage() {
  const [decks, setDecks]     = useState<DeckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchDecks = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: { data: DeckRow[] } }>('/api/admin/decks');
      setDecks(res.data.data.data);
    } catch { setError('Failed to load decks.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  return (
    <PageShell
      title="Flashcard Decks"
      subtitle={`${decks.length} decks · ${decks.reduce((s, d) => s + d.cardCount, 0).toLocaleString()} cards`}
      actions={
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500
                           text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={14} /> New Deck
        </button>
      }
    >
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={decks} pageSize={20} />}
    </PageShell>
  );
}
