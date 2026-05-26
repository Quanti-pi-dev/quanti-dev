'use client';

// ─── Subscriptions Page ───────────────────────────────────────
// Lists subscriptions with status filter, detail slide-out, status
// override, and manual grant modal.
// Routes wired:
//   GET   /api/admin/subscriptions
//   GET   /api/admin/subscriptions/:id    (detail slide-out)
//   PATCH /api/admin/subscriptions/:id    (status override)
//   POST  /api/admin/subscriptions        (manual grant)
//   GET   /api/admin/users/search         (user lookup in grant modal)
//   GET   /api/admin/plans                (plan selector in grant modal)

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Plus, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface SubscriptionRow {
  id: string;
  userEmail: string;
  planName: string;
  planTier: number;
  status: 'active' | 'expired' | 'cancelled' | 'pending' | 'past_due' | 'paused';
  startedAt: string;
  expiresAt: string | null;
  amountPaise: number;
  adminNotes?: string;
}

interface Plan {
  id: string;
  displayName: string;
  billingCycle: string;
  pricePaise: number;
  isActive: boolean;
}

type SubStatus = SubscriptionRow['status'];

const STATUS_VARIANT: Record<SubStatus, 'green' | 'red' | 'yellow' | 'zinc' | 'violet'> = {
  active:    'green',
  expired:   'red',
  cancelled: 'zinc',
  pending:   'yellow',
  past_due:  'yellow',
  paused:    'violet',
};

function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

const STATUSES: Array<SubStatus | 'all'> = ['all', 'active', 'expired', 'cancelled', 'pending', 'past_due', 'paused'];
const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Detail Slide-out Panel ───────────────────────────────────

function DetailPanel({
  subId,
  onClose,
  onUpdated,
}: {
  subId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [sub, setSub]       = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [newStatus, setNewStatus] = useState<SubStatus | ''>('');
  const [cancelAtEnd, setCancelAtEnd] = useState(false);
  const [patching, setPatching] = useState(false);

  useEffect(() => {
    adminApi.get<{ data: SubscriptionRow }>(`/api/admin/subscriptions/${subId}`)
      .then(r => { setSub(r.data.data); setNewStatus(r.data.data.status); })
      .catch(() => setError('Failed to load subscription.'))
      .finally(() => setLoading(false));
  }, [subId]);

  const handlePatch = async () => {
    if (!newStatus) return;
    setPatching(true); setError('');
    try {
      await adminApi.patch(`/api/admin/subscriptions/${subId}`, {
        status: newStatus,
        cancelAtPeriodEnd: cancelAtEnd,
      });
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to update subscription.');
    } finally { setPatching(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
    >
      <div className="bg-zinc-900 border-l border-zinc-700 w-full max-w-md h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-semibold text-white">Subscription Detail</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {error && <ErrorBanner message={error} />}
          {loading ? <Spinner /> : !sub ? null : (
            <>
              {/* Info */}
              <div className="bg-zinc-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">User</span>
                  <span className="text-white">{sub.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Plan</span>
                  <span className="text-white">{sub.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tier</span>
                  <Badge label={`Tier ${sub.planTier}`} variant="violet" />
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Status</span>
                  <Badge label={sub.status} variant={STATUS_VARIANT[sub.status]} />
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Amount</span>
                  <span className="text-white">{paise(sub.amountPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Started</span>
                  <span className="text-white">{new Date(sub.startedAt).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Expires</span>
                  <span className="text-white">{sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString('en-IN') : '—'}</span>
                </div>
                {sub.adminNotes && (
                  <div className="pt-2 border-t border-zinc-700">
                    <p className="text-zinc-400 text-xs mb-1">Admin Notes</p>
                    <p className="text-zinc-300 text-xs">{sub.adminNotes}</p>
                  </div>
                )}
              </div>

              {/* Status override */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Override Status</p>
                <div>
                  <label className={LABEL}>New Status</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as SubStatus)}
                    className={INPUT}
                  >
                    {(['pending', 'active', 'past_due', 'canceled', 'expired', 'paused'] as const).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    id="cancel-at-end"
                    type="checkbox"
                    checked={cancelAtEnd}
                    onChange={e => setCancelAtEnd(e.target.checked)}
                    className="accent-violet-500"
                  />
                  <label htmlFor="cancel-at-end" className="text-sm text-zinc-400 cursor-pointer">
                    Cancel at period end
                  </label>
                </div>
                <button
                  onClick={handlePatch}
                  disabled={patching || newStatus === sub.status}
                  className="mt-4 w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {patching ? 'Saving…' : 'Apply Override'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Grant Subscription Modal ─────────────────────────────────

function GrantModal({ onClose, onGranted }: { onClose: () => void; onGranted: () => void }) {
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [search, setSearch]     = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedUser, setSelectedUser]   = useState<{ id: string; email: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [customEndDate, setCustomEndDate]   = useState('');
  const [adminNotes, setAdminNotes]         = useState('');
  const [overwrite, setOverwrite]           = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    adminApi.get<{ data: Plan[] }>('/api/admin/plans')
      .then(r => {
        const active = r.data.data.filter(p => p.isActive);
        setPlans(active);
        if (active.length > 0) setSelectedPlanId(active[0].id);
      })
      .catch(() => setError('Failed to load plans.'));
  }, []);

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await adminApi.get<{ data: Array<{ id: string; email: string }> }>(
        `/api/admin/users/search?q=${encodeURIComponent(search)}&limit=10`,
      );
      setSearchResults(res.data.data);
    } catch { setError('User search failed.'); }
    finally { setSearching(false); }
  }, [search]);

  const handleGrant = async () => {
    if (!selectedUser || !selectedPlanId) { setError('Select a user and a plan.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      userId: selectedUser.id,
      planId: selectedPlanId,
      overwriteExisting: overwrite,
    };
    if (customEndDate) payload.customEndDate = new Date(customEndDate).toISOString();
    if (adminNotes)    payload.adminNotes    = adminNotes;
    try {
      await adminApi.post('/api/admin/subscriptions', payload);
      onGranted();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to grant subscription.');
    } finally { setSaving(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Grant Subscription</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}

        <div className="space-y-4">
          {/* User search */}
          <div>
            <label className={LABEL}>User (search by email)</label>
            {selectedUser ? (
              <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-3 py-2">
                <span className="text-emerald-300 text-sm">{selectedUser.email}</span>
                <button onClick={() => { setSelectedUser(null); setSearchResults([]); setSearch(''); }} className="text-zinc-500 hover:text-white"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="user@example.com"
                  className={INPUT}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !search.trim()}
                  className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm transition disabled:opacity-50 whitespace-nowrap"
                >
                  {searching ? '…' : 'Search'}
                </button>
              </div>
            )}
            {searchResults.length > 0 && !selectedUser && (
              <ul className="mt-1 border border-zinc-700 rounded-lg overflow-hidden">
                {searchResults.map(u => (
                  <li key={u.id}>
                    <button
                      onClick={() => { setSelectedUser(u); setSearchResults([]); }}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                    >
                      {u.email}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Plan selector */}
          <div>
            <label className={LABEL}>Plan</label>
            <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} className={INPUT}>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.displayName} — {p.billingCycle} — ₹{(p.pricePaise / 100).toFixed(0)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL}>Custom End Date (optional — leave blank for plan default)</label>
            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className={INPUT} />
          </div>

          <div>
            <label className={LABEL}>Admin Notes (optional)</label>
            <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} placeholder="Why was this subscription manually granted?" className={INPUT} />
          </div>

          <div className="flex items-center gap-2">
            <input id="overwrite" type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="accent-violet-500" />
            <label htmlFor="overwrite" className="text-sm text-zinc-400 cursor-pointer">
              Overwrite existing active subscription if present
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button onClick={handleGrant} disabled={saving || !selectedUser || !selectedPlanId} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Granting…' : 'Grant Subscription'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [rows, setRows]         = useState<SubscriptionRow[]>([]);
  const [filtered, setFiltered] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [status, setStatus]     = useState<SubStatus | 'all'>('all');
  const [detail, setDetail]     = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);

  const fetchSubs = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: SubscriptionRow[] }>('/api/admin/subscriptions');
      setRows(res.data.data);
    } catch { setError('Failed to load subscriptions.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);
  useEffect(() => {
    setFiltered(status === 'all' ? rows : rows.filter(r => r.status === status));
  }, [rows, status]);

  const COLUMNS: ColumnDef<SubscriptionRow, unknown>[] = [
    {
      accessorKey: 'userEmail',
      header: 'User',
      cell: ({ row }) => (
        <button
          onClick={() => setDetail(row.original.id)}
          className="font-medium text-white hover:text-violet-400 transition text-left text-xs"
        >
          {row.original.userEmail}
        </button>
      ),
    },
    { accessorKey: 'planName', header: 'Plan' },
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
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={() => setDetail(row.original.id)}
          className="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
        >
          Details →
        </button>
      ),
    },
  ];

  return (
    <PageShell
      title="Subscriptions"
      subtitle={`${filtered.length} subscriptions`}
      actions={
        <button
          onClick={() => setShowGrant(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={14} /> Grant Subscription
        </button>
      }
    >
      {detail && (
        <DetailPanel
          subId={detail}
          onClose={() => setDetail(null)}
          onUpdated={fetchSubs}
        />
      )}
      {showGrant && (
        <GrantModal
          onClose={() => setShowGrant(false)}
          onGranted={fetchSubs}
        />
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              status === s
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={filtered} pageSize={25} />}
    </PageShell>
  );
}
