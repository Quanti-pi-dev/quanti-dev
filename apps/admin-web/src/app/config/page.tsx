'use client';

// ─── Platform Config Page ─────────────────────────────────────
// Full CRUD for platform runtime configuration.
// Routes wired:
//   GET    /api/admin/config                     — full list (used to build category tabs)
//   GET    /api/admin/config/category/:category  — server-side category filter ← now wired
//   PUT    /api/admin/config/:key                (upsert — create or update)
//   DELETE /api/admin/config/:key

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner } from '@/components/page-shell';
import { Plus, Trash2, X, Save } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface ConfigEntry {
  key: string;
  value: unknown;
  category: string;
  description?: string;
  updatedAt: string;
  updatedBy?: string;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── New Key Modal ────────────────────────────────────────────

function NewKeyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ key: '', value: '', category: 'general', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key || !form.category) { setError('Key and category are required.'); return; }
    setSaving(true); setError('');
    try {
      let value: unknown = form.value;
      try { value = JSON.parse(form.value); } catch { /* keep as string */ }
      await adminApi.put(`/api/admin/config/${form.key}`, { value, category: form.category, description: form.description });
      onSaved(); onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to save.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">New Config Key</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Key * (snake_case)</label><input value={form.key} onChange={set('key')} placeholder="feature_flag_x" className={INPUT} /></div>
            <div><label className={LABEL}>Category *</label><input value={form.category} onChange={set('category')} placeholder="general" className={INPUT} /></div>
          </div>
          <div>
            <label className={LABEL}>Value (JSON or plain string)</label>
            <textarea value={form.value} onChange={set('value')} rows={3} placeholder='true  or  "hello"  or  {"limit": 10}' className={INPUT} />
          </div>
          <div><label className={LABEL}>Description (optional)</label><input value={form.description} onChange={set('description')} className={INPUT} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">{saving ? 'Saving…' : 'Create Key'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ConfigPage() {
  const [entries, setEntries]   = useState<ConfigEntry[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [edits, setEdits]       = useState<Record<string, string>>({});
  const [showNew, setShowNew]   = useState(false);

  // ── Fetch logic ────────────────────────────────────────────
  // Always fetch all to keep the category tab list fresh.
  // For filtered views, use the server-side category endpoint.
  const fetchAll = useCallback(async () => {
    try {
      const res = await adminApi.get<{ data: ConfigEntry[] }>('/api/admin/config');
      const data = res.data.data;
      const cats = ['all', ...Array.from(new Set(data.map(e => e.category)))];
      setCategories(cats);
      return data;
    } catch { throw new Error('Failed to load config.'); }
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (activeCategory === 'all') {
        const data = await fetchAll();
        setEntries(data);
      } else {
        // Parallel: refresh category tabs + fetch filtered entries via server-side endpoint
        const [allRes, catRes] = await Promise.allSettled([
          fetchAll(),
          adminApi.get<{ data: ConfigEntry[] }>(`/api/admin/config/category/${encodeURIComponent(activeCategory)}`),
        ]);
        if (catRes.status === 'fulfilled') {
          setEntries(catRes.value.data.data);
        } else if (allRes.status === 'fulfilled') {
          // Fallback: client-side filter from full list
          setEntries(allRes.value.filter(e => e.category === activeCategory));
        }
      }
    } catch { setError('Failed to load config.'); }
    finally { setLoading(false); }
  }, [activeCategory, fetchAll]);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  // For display: entries is always the correctly scoped set for the active tab
  const filteredEntries = entries;

  const handleSave = async (entry: ConfigEntry) => {
    const rawVal = edits[entry.key];
    if (rawVal === undefined) return;
    setSaving(entry.key); setError('');
    try {
      let value: unknown = rawVal;
      try { value = JSON.parse(rawVal); } catch { /* keep as string */ }
      await adminApi.put(`/api/admin/config/${entry.key}`, {
        value,
        category: entry.category,
        description: entry.description ?? '',
      });
      await fetchConfig();
      setEdits(prev => { const n = { ...prev }; delete n[entry.key]; return n; });
    } catch { setError(`Failed to save ${entry.key}.`); }
    finally { setSaving(null); }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete config key "${key}"? This cannot be undone.`)) return;
    setDeleting(key); setError('');
    try { await adminApi.delete(`/api/admin/config/${key}`); await fetchConfig(); }
    catch { setError(`Failed to delete ${key}.`); }
    finally { setDeleting(null); }
  };

  const displayValue = (entry: ConfigEntry, editVal?: string): string => {
    if (editVal !== undefined) return editVal;
    try { return JSON.stringify(entry.value); } catch { return String(entry.value); }
  };

  return (
    <PageShell
      title="Platform Config"
      subtitle="Runtime configuration key-value store"
      actions={
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
          <Plus size={14} /> New Key
        </button>
      }
    >
      {showNew && <NewKeyModal onClose={() => setShowNew(false)} onSaved={fetchConfig} />}
      {error && <ErrorBanner message={error} />}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              activeCategory === cat
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-3 max-w-3xl">
          {filteredEntries.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-600 text-sm">No config keys in this category.</div>
          ) : filteredEntries.map(entry => (
            <div key={entry.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-mono font-semibold text-violet-400">{entry.key}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">{entry.category}</span>
                  </div>
                  {entry.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{entry.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-zinc-700">
                    {new Date(entry.updatedAt).toLocaleDateString('en-IN')}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.key)}
                    disabled={deleting === entry.key}
                    className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"
                    title="Delete key"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={displayValue(entry, edits[entry.key])}
                  onChange={e => setEdits(p => ({ ...p, [entry.key]: e.target.value }))}
                  rows={1}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono
                             focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none leading-relaxed"
                />
                <button
                  disabled={edits[entry.key] === undefined || saving === entry.key}
                  onClick={() => handleSave(entry)}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40
                             disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Save size={13} />
                  {saving === entry.key ? '…' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
