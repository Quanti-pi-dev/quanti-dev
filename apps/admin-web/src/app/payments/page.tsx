'use client';

// ─── Payments Page ────────────────────────────────────────────
// Lists all payments with refund capability.
// Routes wired:
//   GET  /api/admin/payments
//   POST /api/admin/payments/:id/refund

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { useToast } from '@/components/toast';
import { RotateCcw, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

type PaymentStatus = 'captured' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';

interface Payment {
  id: string;
  userEmail: string;
  amountPaise: number;
  refundedPaise?: number;
  status: PaymentStatus;
  gateway: string;
  razorpayPaymentId?: string;
  createdAt: string;
  capturedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

const STATUS_VARIANT: Record<PaymentStatus, 'green' | 'yellow' | 'red' | 'zinc' | 'violet'> = {
  captured:           'green',
  pending:            'yellow',
  failed:             'red',
  refunded:           'zinc',
  partially_refunded: 'violet',
};

const STATUS_ALL: Array<PaymentStatus | 'all'> = ['all', 'captured', 'pending', 'failed', 'refunded', 'partially_refunded'];

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Refund Modal ─────────────────────────────────────────────
// #4 fix: input is now in rupees (₹), converted to paise before API call.

function RefundModal({
  payment,
  onClose,
  onRefunded,
}: {
  payment: Payment;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const { toast } = useToast();
  const maxRefundable = payment.amountPaise - (payment.refundedPaise ?? 0);
  const maxRefundableRupees = maxRefundable / 100;
  // Display in rupees; convert to paise only when submitting
  const [amountRupees, setAmountRupees] = useState(maxRefundableRupees);
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState('');

  const amountPaise = Math.round(amountRupees * 100);

  const handleRefund = async () => {
    if (amountPaise <= 0 || amountPaise > maxRefundable) {
      setError(`Amount must be between ₹0.01 and ${paise(maxRefundable)}.`);
      return;
    }
    setSaving(true); setError('');
    try {
      await adminApi.post(`/api/admin/payments/${payment.id}/refund`, { amountPaise });
      toast.success(`Refund of ${paise(amountPaise)} initiated`);
      onRefunded(); onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Refund failed. Check Razorpay status.');
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Issue Refund</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4 space-y-1.5 text-sm">
            <p className="text-zinc-400">User: <span className="text-white">{payment.userEmail}</span></p>
            <p className="text-zinc-400">Payment: <span className="text-white font-mono text-xs">{payment.razorpayPaymentId ?? payment.id}</span></p>
            <p className="text-zinc-400">Original: <span className="text-white">{paise(payment.amountPaise)}</span></p>
            {payment.refundedPaise && payment.refundedPaise > 0 && (
              <p className="text-zinc-400">Already refunded: <span className="text-yellow-400">{paise(payment.refundedPaise)}</span></p>
            )}
            <p className="text-zinc-400">Max refundable: <span className="text-emerald-400 font-semibold">{paise(maxRefundable)}</span></p>
          </div>
          {error && <ErrorBanner message={error} />}
          <div>
            <label className={LABEL}>Refund Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">₹</span>
              <input
                type="number"
                min={0.01}
                max={maxRefundableRupees}
                step={0.01}
                value={amountRupees}
                onChange={e => setAmountRupees(Number(e.target.value))}
                className={INPUT + ' pl-7'}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-1">{paise(amountPaise)} will be refunded · max {paise(maxRefundable)}</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button
              onClick={handleRefund}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition disabled:opacity-50"
            >
              {saving ? 'Processing…' : `Refund ${paise(amountPaise)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filtered, setFiltered] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [status, setStatus]     = useState<PaymentStatus | 'all'>('all');
  const [refunding, setRefunding] = useState<Payment | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: Payment[] }>('/api/admin/payments');
      setPayments(res.data.data);
    } catch { setError('Failed to load payments.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => {
    setFiltered(status === 'all' ? payments : payments.filter(p => p.status === status));
  }, [payments, status]);

  const totalCaptured = payments
    .filter(p => p.status === 'captured')
    .reduce((sum, p) => sum + p.amountPaise, 0);

  const COLUMNS: ColumnDef<Payment, unknown>[] = [
    {
      accessorKey: 'userEmail',
      header: 'User',
      cell: ({ getValue }) => <span className="font-medium text-white text-xs">{getValue() as string}</span>,
    },
    {
      accessorKey: 'amountPaise',
      header: 'Amount',
      cell: ({ getValue }) => <span className="tabular-nums">{paise(getValue() as number)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as PaymentStatus;
        return <Badge label={s.replace('_', ' ')} variant={STATUS_VARIANT[s]} />;
      },
    },
    {
      accessorKey: 'gateway',
      header: 'Gateway',
      cell: ({ getValue }) => <span className="text-zinc-500 text-xs capitalize">{getValue() as string}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original;
        const canRefund = p.status === 'captured' || p.status === 'partially_refunded';
        if (!canRefund) return null;
        return (
          <button
            onClick={() => setRefunding(p)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-zinc-800 hover:bg-red-950/40 hover:text-red-400 text-zinc-400 transition"
          >
            <RotateCcw size={11} /> Refund
          </button>
        );
      },
    },
  ];

  return (
    <PageShell
      title="Payments"
      subtitle={`${payments.length} payments · ${paise(totalCaptured)} captured`}
    >
      {refunding && (
        <RefundModal
          payment={refunding}
          onClose={() => setRefunding(null)}
          onRefunded={fetchPayments}
        />
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_ALL.map(s => (
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
