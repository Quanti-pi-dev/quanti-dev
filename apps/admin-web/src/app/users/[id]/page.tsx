'use client';

// ─── User Detail Page ─────────────────────────────────────────
// Full user profile: identity, plan tier, subscription history,
// payment history, and admin role management.
//
// Routes wired:
//   GET    /api/admin/users/:id
//   PATCH  /api/admin/users/:id/role
//   DELETE /api/admin/users/:id

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner, InlineSpinner } from '@/components/page-shell';
import { useToast } from '@/components/toast';
import {
  User, CreditCard, ReceiptText, ShieldCheck, Calendar, Mail,
  Hash, Fingerprint, ChevronDown, Trash2, AlertOctagon,
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

  const ROLES = ['student', 'admin', 'educator', 'examiner', 'institute_admin'] as const;

  const ROLE_LABELS: Record<string, string> = {
    student: 'Student',
    admin: 'Platform Admin',
    educator: 'Educator',
    examiner: 'Examiner',
    institute_admin: 'Institute Admin',
  };

  const handleChange = async (role: string) => {
    if (role === currentRole) { setOpen(false); return; }
    setSaving(true); setOpen(false);
    try {
      await adminApi.patch(`/api/admin/users/${userId}/role`, { role });
      toast.success(`Role changed to "${ROLE_LABELS[role] ?? role}"`);
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
        {ROLE_LABELS[currentRole] ?? currentRole}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-20 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden min-w-[150px]">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => handleChange(r)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                r === currentRole ? 'text-violet-400 bg-violet-950/40' : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {ROLE_LABELS[r] ?? r}
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
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser]         = useState<UserDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // ── Deletion state ──────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmEmail, setConfirmEmail]       = useState('');
  const [deleting, setDeleting]               = useState(false);

  const fetchUser = useCallback(async () => {
    setError('');
    try {
      const res = await adminApi.get<{ data: UserDetail }>(`/api/admin/users/${id}`);
      setUser(res.data.data);
    } catch { setError('Failed to load user. They may not exist.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const handleDelete = async () => {
    if (!user || confirmEmail !== user.email) return;
    setDeleting(true);
    try {
      await adminApi.delete(`/api/admin/users/${id}`);
      toast.success('User and all data permanently deleted.');
      router.push('/users');
    } catch {
      toast.error('Failed to delete user. Please try again.');
      setDeleting(false);
      setShowDeleteModal(false);
      setConfirmEmail('');
    }
  };

  const closeModal = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setConfirmEmail('');
  };

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

            {/* Danger Zone */}
            <div className="bg-zinc-900 border border-red-950/50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertOctagon size={14} className="text-red-500 shrink-0" />
                <p className="text-xs font-semibold uppercase tracking-widest text-red-500">Danger Zone</p>
              </div>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                Permanently delete this user account along with all subscriptions, payments, study history, and Firebase credentials. This action is <strong className="text-zinc-300">irreversible</strong>.
              </p>
              <button
                id="btn-delete-user"
                onClick={() => setShowDeleteModal(true)}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold border transition-all duration-150 flex items-center justify-center gap-2 bg-red-950/20 border-red-900/50 text-red-400 hover:bg-red-900/40 hover:text-red-200 hover:border-red-700/60"
              >
                <Trash2 size={13} />
                Delete User &amp; All Data
              </button>
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

      {/* ── Delete confirmation modal ────────────────────────── */}
      {showDeleteModal && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          onClick={closeModal}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center justify-center shrink-0">
                <AlertOctagon size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanent Deletion</h3>
                <p className="text-xs text-zinc-500 mt-0.5">This cannot be undone</p>
              </div>
            </div>

            {/* Warning details */}
            <div className="rounded-xl p-3 mb-5 text-xs space-y-1 leading-relaxed" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <p className="text-zinc-300 font-medium">The following will be permanently deleted:</p>
              <ul className="text-zinc-500 list-disc list-inside space-y-0.5 mt-1">
                <li>Firebase Authentication account</li>
                <li>All subscription &amp; payment records</li>
                <li>All study sessions, badges &amp; progress</li>
                <li>All MongoDB analytics &amp; annotations</li>
                <li>Friendships, challenges &amp; social data</li>
              </ul>
            </div>

            {/* Email confirmation */}
            <div className="mb-5">
              <p className="text-xs text-zinc-400 mb-2">
                Type <span className="font-mono text-zinc-200 select-none">{user.email}</span> to confirm:
              </p>
              <input
                id="input-confirm-email"
                type="text"
                autoComplete="off"
                placeholder="Enter user email…"
                value={confirmEmail}
                onChange={e => setConfirmEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition-colors"
                style={{
                  background: 'var(--color-surface-950, #09090b)',
                  border: confirmEmail === user.email
                    ? '1px solid rgba(239,68,68,0.6)'
                    : '1px solid var(--color-surface-700, #3f3f46)',
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete"
                onClick={handleDelete}
                disabled={deleting || confirmEmail !== user.email}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: confirmEmail === user.email ? '#dc2626' : 'rgba(220,38,38,0.3)',
                  color: 'white',
                }}
              >
                {deleting ? (
                  <><InlineSpinner /> Deleting…</>
                ) : (
                  <><Trash2 size={13} /> Delete Permanently</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

