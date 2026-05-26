'use client';

// ─── Institutes Page ──────────────────────────────────────────
// Manage institutes: list, create, toggle active, grant subscriptions,
// view members, sync Firebase role claims, and delete.
// Routes wired:
//   GET    /api/admin/institutes
//   POST   /api/admin/institutes
//   PATCH  /api/admin/institutes/:id/activate
//   DELETE /api/admin/institutes/:id
//   POST   /api/admin/institutes/:id/subscriptions
//   GET    /api/admin/institutes/:id/members
//   POST   /api/admin/claims/sync
//   GET    /api/admin/plans  (for grant-sub dropdown)

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { Plus, X, Users, ToggleLeft, ToggleRight, BadgeCheck, Trash2, Building2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface Institute {
  id: string;
  name: string;
  code: string;
  type: 'coaching' | 'school' | 'university';
  contactEmail: string;
  contactPhone?: string;
  logoUrl?: string | null;
  isActive: boolean;
  memberCount?: number;
  createdAt: string;
}

interface Member {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  instituteRole?: string;
  joinedAt: string;
}

interface Plan {
  id: string;
  displayName: string;
  slug: string;
  tier: number;
  billingCycle: string;
  pricePaise: number;
  isActive: boolean;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

function apiError(err: unknown) {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Unknown error';
}

// ─── Create Institute Modal ───────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', code: '', type: 'coaching' as 'coaching' | 'school' | 'university', contactEmail: '', contactPhone: '', logoUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code || !form.contactEmail) { setError('Name, code and contact email are required.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      name: form.name,
      code: form.code.toUpperCase(),
      type: form.type,
      contactEmail: form.contactEmail,
    };
    if (form.contactPhone) payload.contactPhone = form.contactPhone;
    if (form.logoUrl) payload.logoUrl = form.logoUrl;
    try {
      await adminApi.post('/api/admin/institutes', payload);
      toast.success(`Institute "${form.name}" created`);
      onCreated(); onClose();
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">New Institute</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Name *</label><input value={form.name} onChange={set('name')} placeholder="Brilliant Coaching" className={INPUT} /></div>
            <div><label className={LABEL}>Code * (unique)</label><input value={form.code} onChange={set('code')} placeholder="BRC" className={`${INPUT} uppercase`} /></div>
          </div>
          <div>
            <label className={LABEL}>Type</label>
            <select value={form.type} onChange={set('type')} className={INPUT}>
              <option value="coaching">Coaching</option>
              <option value="school">School</option>
              <option value="university">University</option>
            </select>
          </div>
          <div><label className={LABEL}>Contact Email *</label><input type="email" value={form.contactEmail} onChange={set('contactEmail')} className={INPUT} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Phone (optional)</label><input value={form.contactPhone} onChange={set('contactPhone')} className={INPUT} /></div>
            <div><label className={LABEL}>Logo URL (optional)</label><input value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://…" className={INPUT} /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">{saving ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Grant Subscription Modal ─────────────────────────────────
// #5 fix: fetches plans from the API instead of asking for a raw UUID

function GrantSubModal({ institute, onClose, onGranted }: { institute: Institute; onClose: () => void; onGranted: () => void }) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [form, setForm] = useState({ planId: '', maxSeats: 50, periodStartDays: 0, periodDays: 365 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch available plans on mount
  useEffect(() => {
    adminApi.get<{ data: Plan[] }>('/api/admin/plans')
      .then(r => {
        const active = r.data.data.filter(p => p.isActive);
        setPlans(active);
        if (active.length > 0) setForm(f => ({ ...f, planId: active[0].id }));
      })
      .catch(() => setError('Failed to load plans.'))
      .finally(() => setPlansLoading(false));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: k === 'planId' ? e.target.value : Number(e.target.value) }));

  const handleGrant = async () => {
    if (!form.planId) { setError('Please select a plan.'); return; }
    setSaving(true); setError('');
    try {
      await adminApi.post(`/api/admin/institutes/${institute.id}/subscriptions`, form);
      toast.success(`Subscription granted to ${institute.name}`);
      onGranted(); onClose();
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Grant Subscription — {institute.name}</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <div className="space-y-4 mt-2">
          <div>
            <label className={LABEL}>Plan *</label>
            {plansLoading ? (
              <div className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
            ) : (
              <select value={form.planId} onChange={set('planId')} className={INPUT}>
                {plans.length === 0 ? (
                  <option value="">No active plans found</option>
                ) : (
                  plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} — ₹{(p.pricePaise / 100).toLocaleString('en-IN')}/{p.billingCycle} (Tier {p.tier})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Max Seats</label><input type="number" min={1} value={form.maxSeats} onChange={set('maxSeats')} className={INPUT} /></div>
            <div><label className={LABEL}>Period (days)</label><input type="number" min={1} value={form.periodDays} onChange={set('periodDays')} className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Starts in (days from now)</label><input type="number" min={0} value={form.periodStartDays} onChange={set('periodStartDays')} className={INPUT} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button onClick={handleGrant} disabled={saving || plansLoading || plans.length === 0} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">{saving ? 'Granting…' : 'Grant'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Members Panel ────────────────────────────────────────────

function MembersPanel({ institute, onClose }: { institute: Institute; onClose: () => void }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Claims sync
  const [syncUid, setSyncUid] = useState('');
  const [syncRole, setSyncRole] = useState('educator');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    adminApi.get<{ data: Member[] }>(`/api/admin/institutes/${institute.id}/members`)
      .then(r => setMembers(r.data.data))
      .catch(() => setError('Failed to load members.'))
      .finally(() => setLoading(false));
  }, [institute.id]);

  const handleSync = async () => {
    if (!syncUid) return;
    setSyncing(true); setError('');
    try {
      await adminApi.post('/api/admin/claims/sync', {
        firebaseUid: syncUid,
        role: syncRole,
        instituteId: institute.id,
        instituteRole: syncRole,
      });
      toast.success(`Claims synced for ${syncUid}`);
      setSyncUid('');
    } catch (err) { setError(apiError(err)); } finally { setSyncing(false); }
  };

  const MEMBER_COLS: ColumnDef<Member, unknown>[] = [
    { accessorKey: 'email', header: 'Email', cell: ({ getValue }) => <span className="text-white text-xs">{getValue() as string}</span> },
    { accessorKey: 'role', header: 'Platform Role', cell: ({ getValue }) => <span className="font-mono text-xs text-violet-400">{getValue() as string}</span> },
    { accessorKey: 'instituteRole', header: 'Institute Role', cell: ({ getValue }) => <span className="text-zinc-400 text-xs">{(getValue() as string) ?? '—'}</span> },
    { accessorKey: 'joinedAt', header: 'Joined', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN') },
  ];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
    >
      <div className="bg-zinc-900 border-l border-zinc-700 w-full max-w-2xl h-full overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-semibold text-white">Members — {institute.name}</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {error && <ErrorBanner message={error} />}

          {/* Claims Sync */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Sync Firebase Role Claim</p>
            <div className="flex gap-2 flex-col sm:flex-row">
              <input
                value={syncUid}
                onChange={e => setSyncUid(e.target.value)}
                placeholder="Firebase UID"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <select
                value={syncRole}
                onChange={e => setSyncRole(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="student">student</option>
                <option value="educator">educator</option>
                <option value="examiner">examiner</option>
                <option value="institute_admin">institute_admin</option>
              </select>
              <button
                onClick={handleSync}
                disabled={syncing || !syncUid}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {syncing ? '…' : 'Sync'}
              </button>
            </div>
          </div>

          {/* Members table */}
          {loading ? <Spinner /> : members.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">No members found.</p>
          ) : <DataTable columns={MEMBER_COLS} data={members} pageSize={20} />}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function InstitutesPage() {
  const { toast } = useToast();
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showCreate, setShowCreate]   = useState(false);
  const [grantSub, setGrantSub]       = useState<Institute | null>(null);
  const [members, setMembers]         = useState<Institute | null>(null);
  const [toggling, setToggling]       = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Institute | null>(null);
  const [deleting, setDeleting]       = useState(false);
  // Separate error state for the delete modal (fix #2 — was sharing page-level `error`)
  const [deleteError, setDeleteError] = useState('');

  const fetchInstitutes = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: Institute[] }>('/api/admin/institutes');
      setInstitutes(res.data.data);
    } catch { setError('Failed to load institutes.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInstitutes(); }, [fetchInstitutes]);

  const handleToggle = async (inst: Institute) => {
    setToggling(inst.id); setError('');
    try {
      await adminApi.patch(`/api/admin/institutes/${inst.id}/activate`, { isActive: !inst.isActive });
      toast.success(`${inst.name} ${!inst.isActive ? 'activated' : 'deactivated'}`);
      await fetchInstitutes();
    } catch (err) { setError(apiError(err)); } finally { setToggling(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/institutes/${deleteTarget.id}`);
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      await fetchInstitutes();
    } catch (err) { setDeleteError(apiError(err)); } finally { setDeleting(false); }
  };

  const COLUMNS: ColumnDef<Institute, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Institute',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-white text-sm">{row.original.name}</p>
          <p className="text-xs font-mono text-zinc-500 mt-0.5">{row.original.code}</p>
        </div>
      ),
    },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <span className="capitalize text-zinc-400 text-xs">{getValue() as string}</span> },
    { accessorKey: 'contactEmail', header: 'Email', cell: ({ getValue }) => <span className="text-zinc-400 text-xs">{getValue() as string}</span> },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <button
          onClick={() => handleToggle(row.original)}
          disabled={toggling === row.original.id}
          className="flex items-center gap-1.5 text-xs transition disabled:opacity-50"
        >
          {row.original.isActive
            ? <><ToggleRight size={16} className="text-emerald-400" /><span className="text-emerald-400">Active</span></>
            : <><ToggleLeft size={16} className="text-zinc-600" /><span className="text-zinc-500">Inactive</span></>
          }
        </button>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setMembers(row.original)} className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition" title="Members"><Users size={13} /></button>
          <button onClick={() => setGrantSub(row.original)} className="p-2 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition" title="Grant Subscription"><BadgeCheck size={13} /></button>
          <button onClick={() => { setDeleteTarget(row.original); setDeleteError(''); }} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition" title="Delete Institute"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Institutes"
      subtitle={`${institutes.length} institution${institutes.length !== 1 ? 's' : ''}`}
      actions={
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
          <Plus size={14} /> New Institute
        </button>
      }
    >
      {showCreate    && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchInstitutes} />}
      {grantSub     && <GrantSubModal institute={grantSub} onClose={() => setGrantSub(null)} onGranted={fetchInstitutes} />}
      {members      && <MembersPanel institute={members} onClose={() => setMembers(null)} />}

      {/* Delete confirm modal — uses its own deleteError state (fix #2) */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Institute"
          description={`Permanently delete "${deleteTarget.name}"? This action cannot be undone. The institute must have no active members before it can be deleted.`}
          confirmLabel="Delete Institute"
          destructive
          loading={deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}

      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Spinner />
      ) : institutes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Building2 size={20} className="text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No institutes yet</p>
          <p className="text-zinc-600 text-sm mt-1">Click &ldquo;New Institute&rdquo; to onboard your first coaching or school.</p>
        </div>
      ) : (
        <DataTable columns={COLUMNS} data={institutes} pageSize={20} />
      )}
    </PageShell>
  );
}
