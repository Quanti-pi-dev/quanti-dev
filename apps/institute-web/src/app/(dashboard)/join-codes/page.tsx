'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Key, Plus, Copy, Trash2, RefreshCw, Check, AlertCircle, Clock } from 'lucide-react';

interface JoinCode {
  id: string;
  code: string;
  role: 'student' | 'educator' | 'examiner' | 'institute_admin';
  department: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'student',        label: 'Student' },
  { value: 'educator',       label: 'Educator' },
  { value: 'examiner',       label: 'Examiner' },
  { value: 'institute_admin', label: 'Admin' },
] as const;

const EXPIRY_OPTIONS = [
  { value: '',   label: 'Never expires' },
  { value: '7',  label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const;

export default function JoinCodesPage() {
  const { instituteId } = useAuth();
  const [codes, setCodes]               = useState<JoinCode[]>([]);
  const [loading, setLoading]           = useState(true);
  const [generating, setGenerating]     = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied]             = useState<string | null>(null);
  const [newRole, setNewRole]           = useState<'student' | 'educator' | 'examiner' | 'institute_admin'>('student');
  const [maxUses, setMaxUses]           = useState<string>('');
  const [expiresInDays, setExpiresInDays] = useState<string>('');

  const fetchCodes = async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/inst/v1/institutes/${instituteId}/join-codes`);
      setCodes(res.data.data ?? []);
    } catch {
      setCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchCodes(); }, [instituteId]);

  const handleGenerate = async () => {
    if (!instituteId) {
      setGenerateError('Institute context not loaded yet — please wait a moment and try again.');
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      await api.post(`/api/inst/v1/institutes/${instituteId}/join-codes`, {
        role: newRole,
        maxUses:       maxUses ? parseInt(maxUses, 10) : null,
        expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
      });
      // Reset form
      setMaxUses('');
      setExpiresInDays('');
      await fetchCodes();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? 'Failed to generate code. Please try again.';
      setGenerateError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (codeId: string) => {
    if (!confirm('Revoke this code? It will no longer work for new joins.')) return;
    try {
      await api.delete(`/api/inst/v1/institutes/${instituteId}/join-codes/${codeId}`);
      await fetchCodes();
    } catch {
      /* silently ignore – UI re-fetches */
    }
  };

  const copyCode = (code: string) => {
    void navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Join Codes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            Shared codes that let multiple users join your institute with a chosen role.
            Each code can be used up to its max-uses limit — they are not per-student unique.
          </p>
        </div>
      </div>

      {/* Generator */}
      <div className="glass p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Generate New Code</h2>
        <div className="flex flex-wrap items-end gap-4">
          {/* Role */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value as typeof newRole)}
              className="px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }}>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Max uses */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
              Max Uses <span className="opacity-60">(blank = unlimited)</span>
            </label>
            <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)}
              placeholder="e.g. 30"
              className="w-36 px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-surface-300)' }}>
              <Clock className="inline w-3 h-3 mr-1 opacity-60" />Expiry
            </label>
            <select value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)}
              className="px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }}>
              {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={generating || !instituteId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate
          </button>
        </div>

        {/* Inline error */}
        {generateError && (
          <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{generateError}</span>
          </div>
        )}
      </div>

      {/* Codes list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass p-4">
              <div className="skeleton h-8 w-32 rounded mb-2" />
              <div className="skeleton h-4 w-48 rounded" />
            </div>
          ))}
        </div>
      ) : codes.length === 0 ? (
        <div className="glass p-10 text-center">
          <Key className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--color-surface-300)' }} />
          <p className="text-white font-medium">No join codes yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>Generate your first code above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map(jc => (
            <div key={jc.id}
              className={`glass p-4 flex items-center gap-4 ${!jc.isActive ? 'opacity-50' : ''}`}>
              {/* Code */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <code className="text-xl font-bold tracking-widest" style={{ color: '#a5b4fc' }}>
                    {jc.code}
                  </code>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{
                      background: jc.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                      color: jc.isActive ? '#4ade80' : '#9ca3af',
                      border: `1px solid ${jc.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
                    }}>
                    {jc.isActive ? 'Active' : 'Revoked'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
                    {jc.role}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-surface-400)' }}>
                  <span>
                    {jc.usedCount}{jc.maxUses ? `/${jc.maxUses}` : ''} use{jc.usedCount !== 1 ? 's' : ''}
                    {jc.maxUses && jc.usedCount >= jc.maxUses && (
                      <span className="ml-1.5 text-amber-400 font-medium">· Full</span>
                    )}
                  </span>
                  {jc.department && <span>Dept: {jc.department}</span>}
                  {jc.expiresAt && (
                    <span className={new Date(jc.expiresAt) < new Date() ? 'text-red-400' : ''}>
                      Expires: {new Date(jc.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                  <span>Created: {new Date(jc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              {jc.isActive && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => copyCode(jc.code)} title="Copy code"
                    className="p-2 rounded-lg transition-colors hover:text-indigo-400"
                    style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
                    {copied === jc.code ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleRevoke(jc.id)} title="Revoke"
                    className="p-2 rounded-lg transition-colors hover:text-red-400"
                    style={{ color: 'var(--color-surface-400)', background: 'var(--color-surface-800)' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
