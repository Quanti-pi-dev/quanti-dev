'use client';

// ─── Coupons Management Page ──────────────────────────────────
// Full CRUD for discount coupons.
// Routes wired:
//   GET    /api/admin/coupons
//   POST   /api/admin/coupons
//   PATCH  /api/admin/coupons/:id
//   DELETE /api/admin/coupons/:id

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Tag } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  maxDiscountPaise?: number;
  minOrderPaise: number;
  maxUses?: number;
  maxUsesPerUser: number;
  currentUses: number;
  validUntil?: string | null;
  isActive: boolean;
  firstTimeOnly: boolean;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────

/** Converts rupees (display) → paise (storage). */
function rupeesToPaise(v: string | number) {
  return Math.round(Number(v) * 100);
}

/** Converts paise (storage) → rupees (display). */
function paiseToRupees(v: number) {
  return (v / 100).toFixed(0);
}

function paiseDisplay(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Coupon Modal ─────────────────────────────────────────────

function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!coupon;
  const { toast } = useToast();
  const [form, setForm] = useState({
    code:              coupon?.code              ?? '',
    discountType:      coupon?.discountType      ?? 'percentage' as 'percentage' | 'fixed_amount',
    // percentage: stored as plain value; fixed_amount: stored in paise, displayed in rupees
    discountValue:     coupon?.discountValue     ?? 10,
    // monetary fields stored in paise, form displays in rupees
    maxDiscountRupees: coupon?.maxDiscountPaise != null ? paiseToRupees(coupon.maxDiscountPaise) : '',
    minOrderRupees:    coupon?.minOrderPaise != null ? paiseToRupees(coupon.minOrderPaise) : '0',
    maxUses:           coupon?.maxUses           ?? '',
    maxUsesPerUser:    coupon?.maxUsesPerUser    ?? 1,
    validUntil:        coupon?.validUntil        ? coupon.validUntil.slice(0, 10) : '',
    isActive:          coupon?.isActive          ?? true,
    firstTimeOnly:     coupon?.firstTimeOnly     ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({
      ...prev,
      [k]: ['discountValue', 'maxUsesPerUser'].includes(k)
        ? Number(e.target.value)
        : e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code) { setError('Coupon code is required.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      code: form.code.toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      // Convert rupees → paise for monetary fields
      minOrderPaise: rupeesToPaise(form.minOrderRupees || '0'),
      maxUsesPerUser: Number(form.maxUsesPerUser),
      isActive: form.isActive,
      firstTimeOnly: form.firstTimeOnly,
    };
    if (form.maxDiscountRupees !== '') payload.maxDiscountPaise = rupeesToPaise(form.maxDiscountRupees);
    if (form.maxUses !== '') payload.maxUses = Number(form.maxUses);
    if (form.validUntil) payload.validUntil = new Date(form.validUntil).toISOString();

    try {
      if (isEdit) {
        await adminApi.patch(`/api/admin/coupons/${coupon!.id}`, payload);
        toast.success(`Coupon ${coupon!.code} updated`);
      } else {
        await adminApi.post('/api/admin/coupons', payload);
        toast.success('Coupon created');
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? `Failed to ${isEdit ? 'update' : 'create'} coupon.`);
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Coupon' : 'New Coupon'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Code *{isEdit && <span className="text-zinc-600 ml-1">(read-only)</span>}</label>
              <input value={form.code} onChange={setF('code')} disabled={isEdit} placeholder="SAVE20" className={INPUT + (isEdit ? ' opacity-50 cursor-not-allowed font-mono' : ' font-mono uppercase')} />
            </div>
            <div>
              <label className={LABEL}>Discount Type</label>
              <select value={form.discountType} onChange={setF('discountType')} className={INPUT}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (₹)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>
                {form.discountType === 'percentage' ? 'Discount %' : 'Discount Amount (₹)'}
              </label>
              <input type="number" min={1} value={form.discountValue} onChange={setF('discountValue')} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Max Discount Cap (₹, optional)</label>
              <input
                type="number" min={0} step="0.01"
                value={form.maxDiscountRupees}
                onChange={setF('maxDiscountRupees')}
                placeholder="No cap"
                className={INPUT}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Min Order Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">₹</span>
                <input
                  type="number" min={0} step="0.01"
                  value={form.minOrderRupees}
                  onChange={setF('minOrderRupees')}
                  className={INPUT + ' pl-7'}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Max Total Uses (optional)</label>
              <input type="number" min={1} value={form.maxUses} onChange={setF('maxUses')} placeholder="Unlimited" className={INPUT} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Max Uses / User</label>
              <input type="number" min={1} value={form.maxUsesPerUser} onChange={setF('maxUsesPerUser')} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Valid Until (optional)</label>
              <input type="date" value={form.validUntil} onChange={setF('validUntil')} className={INPUT} />
            </div>
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className="flex items-center gap-2 text-sm text-zinc-300">
              {form.isActive ? <ToggleRight size={22} className="text-violet-400" /> : <ToggleLeft size={22} className="text-zinc-600" />}
              {form.isActive ? 'Active' : 'Inactive'}
            </button>
            <button type="button" onClick={() => setForm(p => ({ ...p, firstTimeOnly: !p.firstTimeOnly }))} className="flex items-center gap-2 text-sm text-zinc-300">
              {form.firstTimeOnly ? <ToggleRight size={22} className="text-yellow-400" /> : <ToggleLeft size={22} className="text-zinc-600" />}
              First-time users only
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function CouponsPage() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | Coupon>(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchCoupons = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: Coupon[] }>('/api/admin/coupons');
      setCoupons(res.data.data);
    } catch { setError('Failed to load coupons.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/coupons/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success(`Coupon ${deleteTarget.code} deleted`);
      await fetchCoupons();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setDeleteError(msg ?? 'Failed to delete coupon.');
    } finally { setDeleting(false); }
  };

  const COLUMNS: ColumnDef<Coupon, unknown>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ getValue }) => <span className="font-mono font-bold text-white">{getValue() as string}</span>,
    },
    {
      accessorKey: 'discountType',
      header: 'Type',
      cell: ({ row }) => {
        const c = row.original;
        return c.discountType === 'percentage'
          ? `${c.discountValue}% off`
          : paiseDisplay(c.discountValue);
      },
    },
    {
      accessorKey: 'minOrderPaise',
      header: 'Min Order',
      cell: ({ getValue }) => paiseDisplay(getValue() as number),
    },
    {
      accessorKey: 'currentUses',
      header: 'Uses',
      cell: ({ row }) => {
        const c = row.original;
        return `${c.currentUses}${c.maxUses ? ` / ${c.maxUses}` : ''}`;
      },
    },
    {
      accessorKey: 'validUntil',
      header: 'Expires',
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleDateString('en-IN') : '—';
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge label={(getValue() as boolean) ? 'Active' : 'Inactive'} variant={(getValue() as boolean) ? 'green' : 'zinc'} />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setModal(row.original)}
            className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => { setDeleteTarget(row.original); setDeleteError(''); }}
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Coupons"
      subtitle={`${coupons.length} coupon${coupons.length !== 1 ? 's' : ''}`}
      actions={
        <button onClick={() => setModal('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
          <Plus size={14} /> New Coupon
        </button>
      }
    >
      {modal !== false && (
        <CouponModal
          coupon={typeof modal === 'object' ? modal : null}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); fetchCoupons(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Coupon"
          description={`Permanently delete coupon "${deleteTarget.code}"? This cannot be undone.`}
          confirmLabel="Delete Coupon"
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
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Tag size={20} className="text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No coupons yet</p>
          <p className="text-zinc-600 text-sm mt-1">Create your first discount code to offer to users.</p>
        </div>
      ) : (
        <DataTable columns={COLUMNS} data={coupons} pageSize={25} />
      )}
    </PageShell>
  );
}
