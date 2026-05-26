'use client';

// ─── Gamification Page (Badges + Shop Items) ─────────────────
// Tabbed interface for Badges and Shop Items CRUD.
// Routes wired:
//   GET/POST        /api/admin/badges
//   PATCH/DELETE    /api/admin/badges/:id
//   GET/POST        /api/admin/shop-items
//   PUT/DELETE      /api/admin/shop-items/:id
//   POST            /api/admin/upload/presign  ← now wired (R2 image upload)

import { useEffect, useState, useCallback, useRef } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { Plus, Pencil, Trash2, X, ShieldCheck, ShoppingBag, Upload, Loader2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  criteria: string;
  createdAt?: string;
}

type ShopCategory = 'flashcard_pack' | 'theme' | 'power_up';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  category: ShopCategory;
  isAvailable: boolean;
  deckId: string | null;
  cardCount: number | null;
  themeKey: string | null;
  createdAt: string;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

function apiError(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Unknown error';
}

// ─── R2 Image Upload helper ───────────────────────────────────
// Calls POST /api/admin/upload/presign to get a one-time S3-compatible URL,
// uploads the file directly to R2 via PUT, then returns the public CDN URL.
async function uploadToR2(file: File): Promise<string> {
  const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new Error('Only JPEG, PNG, or WebP images are supported.');
  }
  const presign = await adminApi.post<{ data: { uploadUrl: string; cdnUrl: string } }>(
    '/api/admin/upload/presign',
    { mimeType },
  );
  const { uploadUrl, cdnUrl } = presign.data.data;
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': mimeType },
  });
  return cdnUrl;
}

// ─── ImageUploadField ─────────────────────────────────────────
// Drop-in component: shows URL text input + upload button. On file pick,
// calls uploadToR2 and sets the returned CDN URL into the field.
function ImageUploadField({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadErr('');
    try {
      const url = await uploadToR2(file);
      onChange(url);
    } catch (err) {
      setUploadErr((err as Error).message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? 'https://…'}
          className={INPUT + ' flex-1'}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          title="Upload image to R2"
          className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm transition disabled:opacity-50 shrink-0"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      </div>
      {uploadErr && <p className="text-xs text-red-400 mt-1">{uploadErr}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="preview" className="mt-2 h-12 w-12 rounded object-contain bg-zinc-800" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// BADGES
// ═══════════════════════════════════════════════════

function BadgeModal({ badge, onClose, onSaved }: { badge: BadgeItem | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!badge;
  const [form, setForm] = useState({ name: badge?.name ?? '', description: badge?.description ?? '', iconUrl: badge?.iconUrl ?? '', criteria: badge?.criteria ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.description || !form.iconUrl || !form.criteria) { setError('All fields required.'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) await adminApi.patch(`/api/admin/badges/${badge!.id}`, form);
      else await adminApi.post('/api/admin/badges', form);
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
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Badge' : 'New Badge'}</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div><label className={LABEL}>Name *</label><input value={form.name} onChange={set('name')} placeholder="e.g. Streak Master" className={INPUT} /></div>
          <ImageUploadField
            label="Icon Image *"
            value={form.iconUrl}
            onChange={(url) => setForm(p => ({ ...p, iconUrl: url }))}
            placeholder="https://… or upload →"
          />
          <div><label className={LABEL}>Description *</label><textarea value={form.description} onChange={set('description')} rows={2} placeholder="Displayed to users" className={INPUT} /></div>
          <div><label className={LABEL}>Criteria *</label><textarea value={form.criteria} onChange={set('criteria')} rows={2} placeholder="Internal trigger logic, e.g. streak_7_days" className={INPUT} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">{saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BadgesTab() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<false | 'new' | BadgeItem>(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await adminApi.get<{ data: BadgeItem[] }>('/api/admin/badges'); setBadges(r.data.data); }
    catch { setError('Failed to load badges.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const [deleteTarget, setDeleteTarget] = useState<BadgeItem | null>(null);
  const [deleteError, setDeleteError]   = useState('');
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/badges/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success('Badge deleted');
      await fetch();
    }
    catch (err) { setDeleteError(apiError(err)); } finally { setDeleting(null); }
  };

  const COLS: ColumnDef<BadgeItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Badge',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.original.iconUrl} alt="" className="w-8 h-8 rounded object-contain bg-zinc-800" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <p className="text-sm font-medium text-white">{row.original.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{row.original.description}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: 'criteria', header: 'Criteria', cell: ({ getValue }) => <span className="font-mono text-xs text-zinc-400">{getValue() as string}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setModal(row.original)} className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"><Pencil size={13} /></button>
          <button onClick={() => { setDeleteTarget(row.original); setDeleteError(''); }} disabled={deleting === row.original.id} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {modal !== false && <BadgeModal badge={typeof modal === 'object' ? modal : null} onClose={() => setModal(false)} onSaved={() => { setModal(false); fetch(); }} />}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Badge"
          description={`Are you sure you want to delete badge "${deleteTarget.name}"?`}
          confirmLabel="Delete Badge"
          destructive
          loading={deleting === deleteTarget.id}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"><Plus size={14} /> New Badge</button>
      </div>
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLS} data={badges} pageSize={20} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SHOP ITEMS
// ═══════════════════════════════════════════════════

const SHOP_CATEGORIES: ShopCategory[] = ['flashcard_pack', 'theme', 'power_up'];
const CAT_LABEL: Record<ShopCategory, string> = { flashcard_pack: 'Flashcard Pack', theme: 'Theme', power_up: 'Power-Up' };
const CAT_VARIANT: Record<ShopCategory, 'green' | 'violet' | 'yellow'> = { flashcard_pack: 'green', theme: 'violet', power_up: 'yellow' };

function ShopItemModal({ item, onClose, onSaved }: { item: ShopItem | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    imageUrl: item?.imageUrl ?? '',
    price: item?.price ?? 0,
    category: item?.category ?? 'flashcard_pack' as ShopCategory,
    deckId: item?.deckId ?? '',
    cardCount: item?.cardCount ?? '',
    themeKey: item?.themeKey ?? '',
    isAvailable: item?.isAvailable ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: ['price', 'cardCount'].includes(k) ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.description) { setError('Name and description required.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      name: form.name, description: form.description,
      imageUrl: form.imageUrl || null, price: Number(form.price),
      category: form.category, isAvailable: form.isAvailable,
    };
    if (form.deckId) payload.deckId = form.deckId;
    if (form.cardCount) payload.cardCount = Number(form.cardCount);
    if (form.themeKey) payload.themeKey = form.themeKey;
    try {
      if (isEdit) await adminApi.put(`/api/admin/shop-items/${item!.id}`, payload);
      else await adminApi.post('/api/admin/shop-items', payload);
      onSaved();
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Shop Item' : 'New Shop Item'}</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Name *</label><input value={form.name} onChange={set('name')} placeholder="e.g. UPSC Polity Pack" className={INPUT} /></div>
            <div>
              <label className={LABEL}>Category</label>
              <select value={form.category} onChange={set('category')} className={INPUT}>
                {SHOP_CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
          </div>
          <div><label className={LABEL}>Description *</label><textarea value={form.description} onChange={set('description')} rows={2} className={INPUT} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Price (coins)</label><input type="number" min={0} value={form.price} onChange={set('price')} className={INPUT} /></div>
            <ImageUploadField
              label="Image (optional)"
              value={form.imageUrl}
              onChange={(url) => setForm(p => ({ ...p, imageUrl: url }))}
            />
          </div>
          {form.category === 'flashcard_pack' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LABEL}>Deck ID (optional)</label><input value={form.deckId} onChange={set('deckId')} placeholder="MongoDB ObjectId" className={INPUT} /></div>
              <div><label className={LABEL}>Card Count (optional)</label><input type="number" min={1} value={form.cardCount} onChange={set('cardCount')} className={INPUT} /></div>
            </div>
          )}
          {form.category === 'theme' && (
            <div><label className={LABEL}>Theme Key</label><input value={form.themeKey} onChange={set('themeKey')} placeholder="e.g. dark_ocean" className={INPUT} /></div>
          )}
          <div className="flex items-center gap-2">
            <input id="avail" type="checkbox" checked={form.isAvailable} onChange={e => setForm(p => ({ ...p, isAvailable: e.target.checked }))} className="accent-violet-500" />
            <label htmlFor="avail" className="text-sm text-zinc-400 cursor-pointer">Available for purchase</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">{saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShopTab() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<false | 'new' | ShopItem>(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await adminApi.get<{ data: ShopItem[] }>('/api/admin/shop-items'); setItems(r.data.data); }
    catch { setError('Failed to load shop items.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const [deleteTarget, setDeleteTarget] = useState<ShopItem | null>(null);
  const [deleteError, setDeleteError]   = useState('');
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/shop-items/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success('Shop item deleted');
      await fetch();
    }
    catch (err) { setDeleteError(apiError(err)); } finally { setDeleting(null); }
  };

  const COLS: ColumnDef<ShopItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Item',
      cell: ({ row }) => <p className="text-sm font-medium text-white">{row.original.name}</p>,
    },
    { accessorKey: 'category', header: 'Category', cell: ({ getValue }) => { const c = getValue() as ShopCategory; return <Badge label={CAT_LABEL[c]} variant={CAT_VARIANT[c]} />; } },
    { accessorKey: 'price', header: 'Price', cell: ({ getValue }) => <span className="tabular-nums">{(getValue() as number).toLocaleString()} 🪙</span> },
    { accessorKey: 'isAvailable', header: 'Available', cell: ({ getValue }) => <Badge label={(getValue() as boolean) ? 'Yes' : 'No'} variant={(getValue() as boolean) ? 'green' : 'zinc'} /> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setModal(row.original)} className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"><Pencil size={13} /></button>
          <button onClick={() => { setDeleteTarget(row.original); setDeleteError(''); }} disabled={deleting === row.original.id} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {modal !== false && <ShopItemModal item={typeof modal === 'object' ? modal : null} onClose={() => setModal(false)} onSaved={() => { setModal(false); fetch(); }} />}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Shop Item"
          description={`Are you sure you want to delete shop item "${deleteTarget.name}"?`}
          confirmLabel="Delete Item"
          destructive
          loading={deleting === deleteTarget.id}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"><Plus size={14} /> New Item</button>
      </div>
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLS} data={items} pageSize={20} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════

type Tab = 'badges' | 'shop';

export default function GamificationPage() {
  const [tab, setTab] = useState<Tab>('badges');

  const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'badges', label: 'Badges', icon: <ShieldCheck size={14} /> },
    { key: 'shop',   label: 'Shop Items', icon: <ShoppingBag size={14} /> },
  ];

  return (
    <PageShell title="Gamification" subtitle="Badges and coin shop management">
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-violet-500 text-violet-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab === 'badges' && <BadgesTab />}
      {tab === 'shop'   && <ShopTab />}
    </PageShell>
  );
}
