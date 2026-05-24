'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { ArrowLeft, Gift } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface Institute {
  id: string;
  name: string;
  code: string;
  type: string;
  contactEmail: string;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Member {
  id: string;
  email: string;
  displayName: string;
  instituteRole: string;
  joinedAt: string;
}

// ─── Grant Subscription Modal ─────────────────────────────────

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';

function GrantSubModal({ instituteId, onClose }: { instituteId: string; onClose: () => void }) {
  const [form, setForm] = useState({ planId: 'institute_standard', maxSeats: 50, periodDays: 365 });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await adminApi.post(`/api/admin/institutes/${instituteId}/subscriptions`, form);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch {
      setError('Failed to grant subscription.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-1">Grant Subscription</h2>
        <p className="text-xs text-zinc-500 mb-5">Admin-granted — no payment required.</p>

        {success ? (
          <div className="py-6 text-center text-emerald-400 font-medium">✓ Subscription granted!</div>
        ) : (
          <>
            {error && <ErrorBanner message={error} />}
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Plan ID</label>
                <input value={form.planId} onChange={e => setForm(f => ({ ...f, planId: e.target.value }))}
                  className={INPUT} placeholder="institute_standard" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Max Seats</label>
                <input type="number" min={1} value={form.maxSeats}
                  onChange={e => setForm(f => ({ ...f, maxSeats: Number(e.target.value) }))}
                  className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Duration (days)</label>
                <input type="number" min={1} value={form.periodDays}
                  onChange={e => setForm(f => ({ ...f, periodDays: Number(e.target.value) }))}
                  className={INPUT} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
                  {saving ? 'Granting…' : 'Grant'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Member columns ───────────────────────────────────────────

const MEMBER_COLUMNS: ColumnDef<Member, unknown>[] = [
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ getValue }) => <span className="font-medium text-white">{getValue() as string}</span>,
  },
  { accessorKey: 'displayName', header: 'Name' },
  {
    accessorKey: 'instituteRole',
    header: 'Role',
    cell: ({ getValue }) => {
      const role = getValue() as string;
      const variant = role === 'institute_admin' ? 'violet' : role === 'educator' ? 'green' : 'zinc';
      return <Badge label={role} variant={variant} />;
    },
  },
  {
    accessorKey: 'joinedAt',
    header: 'Joined',
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
  },
];

// ─── Page ─────────────────────────────────────────────────────

export default function InstituteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [institute, setInstitute] = useState<Institute | null>(null);
  const [members, setMembers]     = useState<Member[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showGrant, setShowGrant] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [instRes, membersRes] = await Promise.all([
        adminApi.get<{ data: Institute[] }>('/api/admin/institutes', { params: { limit: 100, offset: 0 } }),
        adminApi.get<{ data: Member[] }>(`/api/admin/institutes/${id}/members`, { params: { limit: 100, offset: 0 } }),
      ]);
      const found = instRes.data.data.find(i => i.id === id) ?? null;
      setInstitute(found);
      setMembers(membersRes.data.data);
    } catch {
      setError('Failed to load institute details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <>
      {showGrant && <GrantSubModal instituteId={id} onClose={() => { setShowGrant(false); fetchData(); }} />}

      <PageShell
        title={institute?.name ?? 'Institute'}
        subtitle={institute ? `${institute.code} · ${institute.type}` : ''}
        actions={
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/institutes')}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition">
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={() => setShowGrant(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
              <Gift size={14} /> Grant Subscription
            </button>
          </div>
        }
      >
        {error && <ErrorBanner message={error} />}
        {loading ? <Spinner /> : (
          <div className="space-y-8">
            {/* Info cards */}
            {institute && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Contact Email', value: institute.contactEmail },
                  { label: 'Phone',         value: institute.contactPhone ?? '—' },
                  { label: 'Status',        value: institute.isActive ? 'Active' : 'Inactive' },
                  { label: 'Created',       value: new Date(institute.createdAt).toLocaleDateString('en-IN') },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm text-white font-medium">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Members table */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                Members ({members.length})
              </h2>
              <DataTable columns={MEMBER_COLUMNS} data={members} pageSize={20} />
            </section>
          </div>
        )}
      </PageShell>
    </>
  );
}
