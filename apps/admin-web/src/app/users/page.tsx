'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Search } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface UserRow {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: string;
  planTier: number;
  createdAt: string;
}

const TIER_LABELS: Record<number, { label: string; variant: 'zinc' | 'green' | 'violet' | 'yellow' }> = {
  0: { label: 'Free Trial', variant: 'zinc' },
  1: { label: 'Basic',      variant: 'green' },
  2: { label: 'Pro',        variant: 'violet' },
  3: { label: 'Master',     variant: 'yellow' },
};

// ─── Columns ─────────────────────────────────────────────────

const COLUMNS: ColumnDef<UserRow, unknown>[] = [
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ getValue }) => (
      <span className="font-medium text-white">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'displayName',
    header: 'Name',
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
    accessorKey: 'createdAt',
    header: 'Joined',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
  },
];

// ─── Page ─────────────────────────────────────────────────────

export default function UsersPage() {
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

  return (
    <PageShell
      title="Users"
      subtitle={`${users.length} users`}
      actions={
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
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
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={users} pageSize={25} />}
    </PageShell>
  );
}
