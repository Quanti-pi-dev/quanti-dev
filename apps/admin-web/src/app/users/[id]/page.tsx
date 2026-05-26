'use client';

// ─── User Detail Page ─────────────────────────────────────────
// Full user profile: identity, plan tier, subscription history,
// payment history, and admin role management.
//
// Routes wired:
//   GET   /api/admin/users/:id
//   PATCH /api/admin/users/:id/role

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner, InlineSpinner } from '@/components/page-shell';
import { useToast } from '@/components/toast';
import {
  User, CreditCard, ReceiptText, ShieldCheck, Calendar, Mail,
  Hash, Fingerprint, ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface UserSub {
  id: string;
  status: string;
  planName: string;
  planTier: number;
  billingCycle: string;
  startDate: string | null;
  endDate: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

interface UserPayment {
  id: string;
  amountPaise: number;
  status: string;
  createdAt: string;
  razorpayPaymentId: string | null;
}

interface UserDetail {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  enrollmentId: string;
  planTier: number;
  firebaseUid: string | null;
  joinedAt: string;
  subscriptions: UserSub[];
  payments: UserPayment[];
}

// ─── Helpers ─────────────────────────────────────────────────

const TIER_LABELS: Record<number, { label: string; variant: 'zinc' | 'green' | 'violet' | 'yellow' }> = {
  0: { label: 'Free Trial', variant: 'zinc' },
  1: { label: 'Basic',      variant: 'green' },
  2: { label: 'Pro',        variant: 'violet' },
  3: { label: 'Master',     variant: 'yellow' },
};

const STATUS_VARIANT: Record<string, 'green' | 'yellow' | 'red' | 'zinc' | 'violet'> = {
  active:   'green',
  trialing: 'violet',
  past_due: 'yellow',
  canceled: 'red',
  expired:  'zinc',
  paused:   'yellow',
  captured: 'green',
  pending:  'yellow',
  failed:   'red',
  refunded: 'zinc',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// ─── Info Row ─────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      <Icon size={14} className="text-zinc-600 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 flex items-center justify-between gap-4">
        <span className="text-xs text-zinc-500 shrink-0">{label}</span>
        <span className="text-sm text-zinc-200 font-mono text-right truncate">{value ?? '—'}</span>
      </div>
    </div>
  );
}

// ─── Role Editor ──────────────────────────────────────────────

function RoleEditor({ userId, currentRole, onChanged }: { userId: string; currentRole: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [open, setOpen]     = useState(false);

  const ROLES = ['user', 'moderator', 'admin'] as const;

  const handleChange = async (role: string) => {
    if (role === currentRole) { setOpen(false); return; }
    setSaving(true); setOpen(false);
    try {
      await adminApi.patch(`/api/admin/users/${userId}/role`, { role });
      toast.success(`Role changed to "${role}"`);
      onChanged();
    } catch {
      toast.error('Failed to update role.');
    } finally { setSaving(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors disabled:opacity-50"
      >
        {saving ? <InlineSpinner /> : <ShieldCheck size={13} className="text-violet-400" />}
        {currentRole}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-20 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden min-w-[120px]">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => handleChange(r)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                r === currentRole ? 'text-violet-400 bg-violet-950/40' : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser]     = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const fetchUser = useCallback(async () => {
    setError('');
    try {
      const res = await adminApi.get<{ data: UserDetail }>(`/api/admin/users/${id}`);
      setUser(res.data.data);
    } catch { setError('Failed to load user. They may not exist.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const tier = user ? (TIER_LABELS[user.planTier] ?? { label: `Tier ${user.planTier}`, variant: 'zinc' as const }) : null;

  return (
    <PageShell
      title={user?.displayName ?? 'User Detail'}
      subtitle={user?.email}
      breadcrumbs={[
        { label: 'Users', href: '/users' },
        { label: user?.displayName ?? 'Loading…' },
      ]}
      actions={user && tier ? <Badge label={tier.label} variant={tier.variant} /> : undefined}
    >
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : !user ? null : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── Left: Identity card ─────────────────────────── */}
          <div className="xl:col-span-1 space-y-4">

            {/* Avatar + name */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center text-2xl font-bold text-white mb-3 shadow-lg shadow-violet-900/40">
                {user.displayName?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <p className="font-semibold text-white text-lg">{user.displayName}</p>
              <p className="text-zinc-500 text-sm mt-0.5 break-all">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                <Badge label={tier?.label ?? '—'} variant={tier?.variant ?? 'zinc'} />
                <Badge label={user.role} variant={user.role === 'admin' ? 'violet' : 'zinc'} />
              </div>
            </div>

            {/* Identity fields */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Identity</p>
              <InfoRow icon={Hash}        label="Enrollment ID"  value={user.enrollmentId} />
              <InfoRow icon={Fingerprint} label="Internal UUID"  value={user.id} />
              <InfoRow icon={Mail}        label="Email"          value={user.email} />
              <InfoRow icon={Calendar}    label="Joined"         value={fmt(user.joinedAt)} />
              {user.firebaseUid && (
                <InfoRow icon={User} label="Firebase UID" value={user.firebaseUid} />
              )}
            </div>

            {/* Admin actions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Admin Actions</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Role</span>
                <RoleEditor userId={user.id} currentRole={user.role} onChanged={fetchUser} />
              </div>
            </div>
          </div>

          {/* ── Right: Subscriptions + Payments ────────────── */}
          <div className="xl:col-span-2 space-y-6">

            {/* Subscriptions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
                <CreditCard size={15} className="text-violet-400" />
                <p className="font-semibold text-white text-sm">Subscription History</p>
                <span className="ml-auto text-xs text-zinc-600">{user.subscriptions.length} record{user.subscriptions.length !== 1 ? 's' : ''}</span>
              </div>
              {user.subscriptions.length === 0 ? (
                <div className="px-6 py-10 text-center text-zinc-600 text-sm">No subscriptions found.</div>
              ) : (
                <ul className="divide-y divide-zinc-800/60">
                  {user.subscriptions.map(s => (
                    <li key={s.id} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">{s.planName}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {s.billingCycle} · {s.startDate ? fmt(s.startDate) : '—'}
                          {s.endDate ? ` → ${fmt(s.endDate)}` : ''}
                          {s.cancelAtPeriodEnd && <span className="ml-2 text-yellow-500">cancels at end</span>}
                        </p>
                      </div>
                      <Badge
                        label={s.status}
                        variant={STATUS_VARIANT[s.status] ?? 'zinc'}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Payments */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
                <ReceiptText size={15} className="text-emerald-400" />
                <p className="font-semibold text-white text-sm">Payment History</p>
                <span className="ml-auto text-xs text-zinc-600">{user.payments.length} record{user.payments.length !== 1 ? 's' : ''}</span>
              </div>
              {user.payments.length === 0 ? (
                <div className="px-6 py-10 text-center text-zinc-600 text-sm">No payments found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-900/60 border-b border-zinc-800">
                      <th className="px-6 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Razorpay ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {user.payments.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-3 font-medium text-white">{paise(Number(p.amountPaise))}</td>
                        <td className="px-6 py-3">
                          <Badge label={p.status} variant={STATUS_VARIANT[p.status] ?? 'zinc'} />
                        </td>
                        <td className="px-6 py-3 text-zinc-400">{fmt(p.createdAt)}</td>
                        <td className="px-6 py-3 text-zinc-600 font-mono text-xs hidden md:table-cell">
                          {p.razorpayPaymentId ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
