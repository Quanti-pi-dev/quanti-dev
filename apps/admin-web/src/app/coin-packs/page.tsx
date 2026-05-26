'use client';

// ─── Coin Packs Page ──────────────────────────────────────────
// Admin CRUD for the coin pack catalogue.
// Routes wired:
//   GET    /api/admin/coin-packs
//   POST   /api/admin/coin-packs
//   PUT    /api/admin/coin-packs/:id
//   DELETE /api/admin/coin-packs/:id

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface CoinPack {
  id: string;
  name: string;
  description?: string;
  coins: number;
  pricePaise: number;
  badgeText?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

function apiError(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Unknown error';
}

// ─── Modal ────────────────────────────────────────────────────

function PackModal({ pack, onClose, onSaved }: { pack: CoinPack | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!pack;
  const [form, setForm] = useState({
    name:        pack?.name        ?? '',
    description: pack?.description ?? '',
    coins:       pack?.coins       ?? 100,
    pricePaise:  pack?.pricePaise  ?? 9900,
    badgeText:   pack?.badgeText   ?? '',
    sortOrder:   pack?.sortOrder   ?? 0,
    isActive:    pack?.isActive    ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: ['coins', 'pricePaise', 'sortOrder'].includes(k) ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.coins <= 0 || form.pricePaise <= 0) { setError('Name, coins and price are required.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      name: form.name,
      coins: form.coins,
      pricePaise: form.pricePaise,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    };
    if (form.description) payload.description = form.description;
    if (form.badgeText) payload.badgeText = form.badgeText;
    try {
      if (isEdit) await adminApi.put(`/api/admin/coin-packs/${pack!.id}`, payload);
      else await adminApi.post('/api/admin/coin-packs', payload);
      onSaved();
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Coin Pack' : 'New Coin Pack'}</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div><label className={LABEL}>Pack Name *</label><input value={form.name} onChange={set('name')} placeholder="e.g. Starter Pack" className={INPUT} /></div>
          <div><label className={LABEL}>Description</label><textarea value={form.description} onChange={set('description')} rows={2} placeholder="Optional promo text shown to user" className={INPUT} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Coins *</label>
              <input type="number" min={1} value={form.coins} onChange={set('coins')} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Price (paise) — ₹99 = 9900</label>
              <input type="number" min={1} value={form.pricePaise} onChange={set('pricePaise')} className={INPUT} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Badge Text (optional)</label>
              <input value={form.badgeText} onChange={set('badgeText')} placeholder="e.g. 🔥 Best Value" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Sort Order</label>
              <input type="number" min={0} value={form.sortOrder} onChange={set('sortOrder')} className={INPUT} />
            </div>
          </div>
          <div>
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className="flex items-center gap-2 text-sm text-zinc-300">
              {form.isActive ? <ToggleRight size={22} className="text-violet-400" /> : <ToggleLeft size={22} className="text-zinc-600" />}
              {form.isActive ? 'Active (visible to users)' : 'Inactive (hidden)'}
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Pack'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function CoinPacksPage() {
  const [packs, setPacks]     = useState<CoinPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | CoinPack>(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPacks = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: CoinPack[] }>('/api/admin/coin-packs');
      setPacks(res.data.data.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch { setError('Failed to load coin packs.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPacks(); }, [fetchPacks]);

  const [deleteTarget, setDeleteTarget] = useState<CoinPack | null>(null);
  const [deleteError, setDeleteError]   = useState('');
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/coin-packs/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success('Coin pack deleted');
      await fetchPacks();
    }
    catch (err) { setDeleteError(apiError(err)); } finally { setDeleting(null); }
  };

  return (
    <PageShell
      title="Coin Packs"
      subtitle="Manage purchasable coin bundles"
      actions={
        <button onClick={() => setModal('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
          <Plus size={14} /> New Pack
        </button>
      }
    >
      {modal !== false && <PackModal pack={typeof modal === 'object' ? modal : null} onClose={() => setModal(false)} onSaved={() => { setModal(false); fetchPacks(); }} />}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Coin Pack"
          description={`Are you sure you want to delete "${deleteTarget.name}"?`}
          confirmLabel="Delete Pack"
          destructive
          loading={deleting === deleteTarget.id}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : packs.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-600 text-sm">No coin packs yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {packs.map(pack => (
            <div key={pack.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-base font-semibold text-white">{pack.name}</p>
                  {pack.badgeText && <p className="text-xs text-yellow-400 mt-0.5">{pack.badgeText}</p>}
                </div>
                <Badge label={pack.isActive ? 'Active' : 'Inactive'} variant={pack.isActive ? 'green' : 'zinc'} />
              </div>
              {pack.description && <p className="text-xs text-zinc-500 mb-3">{pack.description}</p>}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-2xl font-bold text-yellow-400">{pack.coins.toLocaleString()}</span>
                <span className="text-zinc-500 text-sm">coins</span>
                <span className="ml-auto text-xl font-bold text-white">{paise(pack.pricePaise)}</span>
              </div>
              <p className="text-xs text-zinc-600 mb-4">Sort order: {pack.sortOrder} · ID: <span className="font-mono">{pack.id.slice(0, 8)}…</span></p>
              <div className="flex gap-2 pt-3 border-t border-zinc-800 mt-auto">
                <button onClick={() => setModal(pack)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"><Pencil size={12} /> Edit</button>
                <button onClick={() => { setDeleteTarget(pack); setDeleteError(''); }} disabled={deleting === pack.id} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/40 hover:text-red-400 text-zinc-500 text-xs transition disabled:opacity-50"><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
