'use client';

// ─── Users Page ───────────────────────────────────────────────
// Searchable user list with click-through to detail view.
// Routes wired:
//   GET /api/admin/users/search?q=&limit=200  (q optional: returns recent if omitted)

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Search, Users, ExternalLink } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface UserRow {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: string;
  planTier: number;
  enrollmentId: string;
  joinedAt: string;
  createdAt?: string;
}

const TIER_LABELS: Record<number, { label: string; variant: 'zinc' | 'green' | 'violet' | 'yellow' }> = {
  0: { label: 'Free Trial', variant: 'zinc' },
  1: { label: 'Basic',      variant: 'green' },
  2: { label: 'Pro',        variant: 'violet' },
  3: { label: 'Master',     variant: 'yellow' },
};

// ─── Page ─────────────────────────────────────────────────────

export default function UsersPage() {
  const router  = useRouter();
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [query, setQuery]     = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.get<{ data: UserRow[] }>(
        '/api/admin/users/search',
        { params: { q: q || undefined, limit: 200 } },
      );
      setUsers(res.data.data);
    } catch {
      setError('Failed to load users. Check that the Admin API is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(debouncedQ); }, [debouncedQ, fetchUsers]);

  // Columns defined inside component so router is in scope
  const COLUMNS: ColumnDef<UserRow, unknown>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/users/${row.original.id}`)}
          className="group flex items-center gap-2 font-medium text-white hover:text-violet-400 transition-colors text-left"
        >
          <span>{row.original.email}</span>
          <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-violet-400" />
        </button>
      ),
    },
    {
      accessorKey: 'displayName',
      header: 'Name',
      cell: ({ getValue }) => (
        <span className="text-zinc-300">{getValue() as string}</span>
      ),
    },
    {
      id: 'enrollmentId',
      accessorKey: 'enrollmentId',
      header: 'ID',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-zinc-500">{(getValue() as string) ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'planTier',
      header: 'Plan',
      cell: ({ getValue }) => {
        const tier = getValue() as number;
        const t = TIER_LABELS[tier] ?? { label: `Tier ${tier}`, variant: 'zinc' as const };
        return <Badge label={t.label} variant={t.variant} />;
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const role = getValue() as string;
        return <Badge label={role} variant={role === 'admin' ? 'violet' : 'zinc'} />;
      },
    },
    {
      id: 'joined',
      header: 'Joined',
      accessorFn: (row) => row.joinedAt ?? row.createdAt ?? '',
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString('en-IN') : '—';
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/users/${row.original.id}`)}
          className="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          View →
        </button>
      ),
    },
  ];

  return (
    <PageShell
      title="Users"
      subtitle={`${users.length} users`}
      actions={
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="search"
            placeholder="Search email or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-4 py-2 text-sm text-white
                       placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 w-64"
          />
        </div>
      }
    >
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Users size={20} className="text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No users found</p>
          <p className="text-zinc-600 text-sm mt-1">
            {query ? `No results for "${query}"` : 'No users in the system yet.'}
          </p>
        </div>
      ) : (
        <DataTable
          columns={COLUMNS}
          data={users}
          pageSize={25}
          searchPlaceholder="Filter by email, name, ID…"
        />
      )}
    </PageShell>
  );
}
