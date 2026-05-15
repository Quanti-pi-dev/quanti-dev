'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner } from '@/components/page-shell';

interface ConfigEntry {
  key: string;
  value: string;
  description?: string;
  updatedAt: string;
}

export default function ConfigPage() {
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState<string | null>(null);
  const [edits, setEdits]     = useState<Record<string, string>>({});

  const fetchConfig = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: ConfigEntry[] }>('/api/admin/config');
      setEntries(res.data.data);
    } catch { setError('Failed to load config.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  async function save(key: string) {
    const val = edits[key];
    if (val === undefined) return;
    setSaving(key);
    try {
      await adminApi.put(`/api/admin/config/${key}`, { value: val });
      await fetchConfig();
      setEdits((prev) => { const n = { ...prev }; delete n[key]; return n; });
    } catch { setError(`Failed to save ${key}.`); }
    finally  { setSaving(null); }
  }

  return (
    <PageShell title="Platform Config" subtitle="Edit runtime configuration values">
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : (
        <div className="space-y-3 max-w-2xl">
          {entries.map((entry) => (
            <div key={entry.key}
                 className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-mono font-medium text-violet-400">{entry.key}</p>
                  {entry.description && (
                    <p className="text-xs text-zinc-500 mt-0.5">{entry.description}</p>
                  )}
                </div>
                <span className="text-xs text-zinc-600 shrink-0">
                  Updated {new Date(entry.updatedAt).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={edits[entry.key] ?? entry.value}
                  onChange={(e) => setEdits((p) => ({ ...p, [entry.key]: e.target.value }))}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
                             focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                />
                <button
                  disabled={edits[entry.key] === undefined || saving === entry.key}
                  onClick={() => save(entry.key)}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40
                             disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving === entry.key ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
