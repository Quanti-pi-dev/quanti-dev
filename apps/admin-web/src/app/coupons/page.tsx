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
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
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

function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Coupon Modal ─────────────────────────────────────────────

function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!coupon;
  const [form, setForm] = useState({
    code:              coupon?.code              ?? '',
    discountType:      coupon?.discountType      ?? 'percentage' as 'percentage' | 'fixed_amount',
    discountValue:     coupon?.discountValue     ?? 10,
    maxDiscountPaise:  coupon?.maxDiscountPaise  ?? '',
    minOrderPaise:     coupon?.minOrderPaise     ?? 0,
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
      [k]: ['discountValue', 'minOrderPaise', 'maxUsesPerUser'].includes(k)
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
      minOrderPaise: Number(form.minOrderPaise),
      maxUsesPerUser: Number(form.maxUsesPerUser),
      isActive: form.isActive,
      firstTimeOnly: form.firstTimeOnly,
    };
    if (form.maxDiscountPaise !== '') payload.maxDiscountPaise = Number(form.maxDiscountPaise);
    if (form.maxUses !== '') payload.maxUses = Number(form.maxUses);
    if (form.validUntil) payload.validUntil = new Date(form.validUntil).toISOString();

    try {
      if (isEdit) {
        await adminApi.patch(`/api/admin/coupons/${coupon!.id}`, payload);
      } else {
        await adminApi.post('/api/admin/coupons', payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? `Failed to ${isEdit ? 'update' : 'create'} coupon.`);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8">
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
                <option value="fixed_amount">Fixed Amount (paise)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{form.discountType === 'percentage' ? 'Discount %' : 'Discount (paise)'}</label>
              <input type="number" min={1} value={form.discountValue} onChange={setF('discountValue')} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Max Discount (paise, optional)</label>
              <input type="number" min={0} value={form.maxDiscountPaise} onChange={setF('maxDiscountPaise')} placeholder="Leave blank = no cap" className={INPUT} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Min Order (paise)</label>
              <input type="number" min={0} value={form.minOrderPaise} onChange={setF('minOrderPaise')} className={INPUT} />
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
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | Coupon>(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: Coupon[] }>('/api/admin/coupons');
      setCoupons(res.data.data);
    } catch { setError('Failed to load coupons.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Delete coupon "${c.code}"?`)) return;
    setDeleting(c.id); setError('');
    try {
      await adminApi.delete(`/api/admin/coupons/${c.id}`);
      await fetchCoupons();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to delete coupon.');
    } finally { setDeleting(null); }
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
          : paise(c.discountValue);
      },
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
          <button onClick={() => setModal(row.original)} className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition" title="Edit"><Pencil size={13} /></button>
          <button onClick={() => handleDelete(row.original)} disabled={deleting === row.original.id} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50" title="Delete"><Trash2 size={13} /></button>
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
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={coupons} pageSize={25} />}
    </PageShell>
  );
}
