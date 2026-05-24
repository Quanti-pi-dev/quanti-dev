'use client';

// ─── Institute Settings ───────────────────────────────────────
// Wires:
//   GET   /api/inst/v1/institutes/:id              — load profile
//   PATCH /api/inst/v1/institutes/:id              — save profile
//   GET   /api/inst/v1/institutes/:id/subscriptions — seat plan info

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Save, Building2, Users, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

interface InstituteProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  createdAt: string;
}

interface SeatPlan {
  plan?: string;
  seatsTotal?: number;
  seatsUsed?: number;
  expiresAt?: string | null;
  isActive?: boolean;
}

function apiErr(e: unknown) {
  return (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Request failed';
}

const INPUT = 'w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none';
const FIELD_STYLE = { background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' };
const LABEL = 'block text-xs font-medium mb-2';
const LABEL_STYLE = { color: 'var(--color-surface-300)' };

export default function SettingsPage() {
  const { instituteId, instituteRole } = useAuth();

  const [profile, setProfile]   = useState<InstituteProfile | null>(null);
  const [seats, setSeats]       = useState<SeatPlan | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  // Form state (mirrors editable fields)
  const [form, setForm] = useState({ name: '', description: '', website: '', contactEmail: '' });

  const canEdit = instituteRole === 'institute_admin';

  const load = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const [profileRes, seatsRes] = await Promise.allSettled([
        api.get(`/api/inst/v1/institutes/${instituteId}`),
        api.get(`/api/inst/v1/institutes/${instituteId}/subscriptions`),
      ]);

      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value.data.data as InstituteProfile;
        setProfile(p);
        setForm({
          name: p.name ?? '',
          description: p.description ?? '',
          website: p.website ?? '',
          contactEmail: p.contactEmail ?? '',
        });
      }

      if (seatsRes.status === 'fulfilled') {
        setSeats(seatsRes.value.data.data as SeatPlan);
      }
    } catch { setError('Failed to load settings.'); }
    finally { setLoading(false); }
  }, [instituteId]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true); setError(null); setSuccess(false);
    try {
      await api.patch(`/api/inst/v1/institutes/${instituteId}`, {
        name: form.name.trim() || undefined,
        description: form.description.trim() || undefined,
        website: form.website.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
      });
      setSuccess(true);
      await load();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) { setError(apiErr(err)); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="animate-fade-in max-w-2xl space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  const seatsUsedPct = seats?.seatsTotal ? Math.min(100, ((seats.seatsUsed ?? 0) / seats.seatsTotal) * 100) : 0;

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-surface-400)' }}>
          Institute profile and subscription details
        </p>
      </div>

      {/* ── Seat Plan Card ─────────────────────────────────── */}
      {seats && (
        <div className="glass p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.15)' }}>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Subscription Plan</h2>
              {seats.plan && <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>{seats.plan}</p>}
            </div>
            {seats.isActive !== undefined && (
              <div className="ml-auto">
                {seats.isActive
                  ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                  : <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="w-3.5 h-3.5" /> Inactive</span>}
              </div>
            )}
          </div>

          {seats.seatsTotal !== undefined && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span style={{ color: 'var(--color-surface-400)' }}>Seats Used</span>
                <span className="font-semibold text-white">{seats.seatsUsed ?? 0} / {seats.seatsTotal}</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-700)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${seatsUsedPct}%`,
                    background: seatsUsedPct > 90
                      ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                      : seatsUsedPct > 70
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  }}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--color-surface-500)' }}>
                {seats.seatsTotal - (seats.seatsUsed ?? 0)} seats remaining
              </p>
            </div>
          )}

          {seats.expiresAt && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-surface-400)' }}>
              <Calendar className="w-3.5 h-3.5" />
              Expires {new Date(seats.expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {/* ── Profile Form ────────────────────────────────────── */}
      <div className="glass p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Institute Profile</h2>
            {profile && <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>/{profile.slug}</p>}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Settings saved successfully.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={LABEL} style={LABEL_STYLE}>Institute Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Apex Academy" readOnly={!canEdit}
              className={INPUT} style={{ ...FIELD_STYLE, opacity: canEdit ? 1 : 0.6 }} />
          </div>
          <div>
            <label className={LABEL} style={LABEL_STYLE}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of your institute" readOnly={!canEdit} rows={3}
              className={INPUT} style={{ ...FIELD_STYLE, resize: 'none', opacity: canEdit ? 1 : 0.6 }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Website</label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://yoursite.com" readOnly={!canEdit} type="url"
                className={INPUT} style={{ ...FIELD_STYLE, opacity: canEdit ? 1 : 0.6 }} />
            </div>
            <div>
              <label className={LABEL} style={LABEL_STYLE}>Contact Email</label>
              <input value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                placeholder="admin@institute.com" readOnly={!canEdit} type="email"
                className={INPUT} style={{ ...FIELD_STYLE, opacity: canEdit ? 1 : 0.6 }} />
            </div>
          </div>

          {!canEdit && (
            <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
              Only Institute Admins can edit profile settings.
            </p>
          )}

          {canEdit && (
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: saving ? 'rgba(245,158,11,0.5)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
