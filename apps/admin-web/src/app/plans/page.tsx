'use client';

// ─── Subscription Plans Page ──────────────────────────────────
// CRUD for subscription plans. Plans control feature access tiers.
// Routes wired:
//   GET   /api/admin/plans
//   POST  /api/admin/plans
//   PATCH /api/admin/plans/:id
//   DELETE /api/admin/plans/:id

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface PlanFeatures {
  max_decks: number;
  max_exams_per_day: number;
  max_subjects_per_exam: number;
  max_level: number;
  ai_explanations: boolean;
  offline_access: boolean;
  priority_support: boolean;
  advanced_analytics: boolean;
  deep_insights: boolean;
  mastery_radar: boolean;
}

interface Plan {
  id: string;
  slug: string;
  displayName: string;
  tier: 1 | 2 | 3;
  billingCycle: 'weekly' | 'monthly';
  pricePaise: number;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  features: PlanFeatures;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function paise(v: number) {
  return `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

const DEFAULT_FEATURES: PlanFeatures = {
  max_decks: -1,
  max_exams_per_day: -1,
  max_subjects_per_exam: -1,
  max_level: -1,
  ai_explanations: false,
  offline_access: false,
  priority_support: false,
  advanced_analytics: false,
  deep_insights: false,
  mastery_radar: false,
};

// ─── Plan Modal ────────────────────────────────────────────────

function PlanModal({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!plan;
  const [form, setForm] = useState({
    slug:         plan?.slug         ?? '',
    displayName:  plan?.displayName  ?? '',
    tier:         plan?.tier         ?? 1 as 1 | 2 | 3,
    billingCycle: plan?.billingCycle ?? 'monthly' as 'weekly' | 'monthly',
    pricePaise:   plan?.pricePaise   ?? 0,
    trialDays:    plan?.trialDays    ?? 0,
    isActive:     plan?.isActive     ?? true,
    sortOrder:    plan?.sortOrder    ?? 0,
  });
  const [features, setFeatures] = useState<PlanFeatures>(plan?.features ?? DEFAULT_FEATURES);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = ['pricePaise', 'trialDays', 'sortOrder', 'tier'].includes(k)
      ? Number(e.target.value)
      : e.target.value;
    setForm(prev => ({ ...prev, [k]: val }));
  };

  const setFeat = (k: keyof PlanFeatures, v: boolean | number) =>
    setFeatures(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug || !form.displayName) { setError('Slug and display name required.'); return; }
    setSaving(true); setError('');
    const payload = { ...form, features };
    try {
      if (isEdit) {
        await adminApi.patch(`/api/admin/plans/${plan!.id}`, {
          displayName: form.displayName,
          pricePaise: form.pricePaise,
          trialDays: form.trialDays,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
          features,
        });
      } else {
        await adminApi.post('/api/admin/plans', payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? `Failed to ${isEdit ? 'update' : 'create'} plan.`);
    } finally { setSaving(false); }
  };

  const BOOL_FEATS: Array<{ key: keyof PlanFeatures; label: string }> = [
    { key: 'ai_explanations',   label: 'AI Explanations' },
    { key: 'offline_access',    label: 'Offline Access' },
    { key: 'priority_support',  label: 'Priority Support' },
    { key: 'advanced_analytics',label: 'Advanced Analytics' },
    { key: 'deep_insights',     label: 'Deep Insights' },
    { key: 'mastery_radar',     label: 'Mastery Radar' },
  ];

  const NUM_FEATS: Array<{ key: keyof PlanFeatures; label: string }> = [
    { key: 'max_decks',              label: 'Max Decks (-1 = unlimited)' },
    { key: 'max_exams_per_day',      label: 'Max Exams / Day (-1 = unlimited)' },
    { key: 'max_subjects_per_exam',  label: 'Max Subjects / Exam (-1 = unlimited)' },
    { key: 'max_level',              label: 'Max Level (-1 = all levels)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-8">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Plan' : 'New Plan'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Display Name *</label>
              <input value={form.displayName} onChange={setF('displayName')} placeholder="e.g. Pro Monthly" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Slug *{isEdit && <span className="text-zinc-600 ml-1">(read-only)</span>}</label>
              <input value={form.slug} onChange={setF('slug')} disabled={isEdit} placeholder="e.g. pro-monthly" className={INPUT + (isEdit ? ' opacity-50 cursor-not-allowed' : '')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Tier</label>
              <select value={form.tier} onChange={setF('tier')} className={INPUT} disabled={isEdit}>
                <option value={1}>1 — Basic</option>
                <option value={2}>2 — Pro</option>
                <option value={3}>3 — Elite</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Billing Cycle</label>
              <select value={form.billingCycle} onChange={setF('billingCycle')} className={INPUT} disabled={isEdit}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Price (paise) — ₹100 = 10000</label>
              <input type="number" min={1} value={form.pricePaise} onChange={setF('pricePaise')} className={INPUT} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Trial Days</label>
              <input type="number" min={0} value={form.trialDays} onChange={setF('trialDays')} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Sort Order</label>
              <input type="number" min={0} value={form.sortOrder} onChange={setF('sortOrder')} className={INPUT} />
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className={LABEL}>Active</label>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                className="flex items-center gap-2 text-sm text-zinc-300"
              >
                {form.isActive
                  ? <ToggleRight size={22} className="text-violet-400" />
                  : <ToggleLeft size={22} className="text-zinc-600" />}
                {form.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>

          {/* Numeric features */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Numeric Limits</p>
            <div className="grid grid-cols-2 gap-3">
              {NUM_FEATS.map(f => (
                <div key={f.key}>
                  <label className={LABEL}>{f.label}</label>
                  <input
                    type="number"
                    min={-1}
                    value={features[f.key] as number}
                    onChange={e => setFeat(f.key, Number(e.target.value))}
                    className={INPUT}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Boolean features */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Feature Flags</p>
            <div className="grid grid-cols-2 gap-2">
              {BOOL_FEATS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFeat(f.key, !features[f.key])}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
                    features[f.key]
                      ? 'border-violet-700 bg-violet-950/40 text-violet-300'
                      : 'border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {features[f.key] ? <Check size={13} className="text-violet-400" /> : <X size={13} className="text-zinc-600" />}
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function PlansPage() {
  const [plans, setPlans]     = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | Plan>(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: Plan[] }>('/api/admin/plans');
      setPlans(res.data.data.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch { setError('Failed to load plans.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Delete plan "${plan.displayName}"? This cannot be undone.`)) return;
    setDeleting(plan.id); setError('');
    try {
      await adminApi.delete(`/api/admin/plans/${plan.id}`);
      await fetchPlans();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Failed to delete plan.');
    } finally { setDeleting(null); }
  };

  return (
    <PageShell
      title="Subscription Plans"
      subtitle="Manage tiered feature access plans"
      actions={
        <button
          onClick={() => setModal('new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus size={14} /> New Plan
        </button>
      }
    >
      {modal !== false && (
        <PlanModal
          plan={typeof modal === 'object' ? modal : null}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); fetchPlans(); }}
        />
      )}

      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : plans.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-600 text-sm">
          No plans yet. Create your first subscription plan.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map(plan => (
            <div key={plan.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-base font-semibold text-white">{plan.displayName}</p>
                  <p className="text-xs font-mono text-zinc-500 mt-0.5">{plan.slug}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge label={`Tier ${plan.tier}`} variant="violet" />
                  <Badge label={plan.isActive ? 'Active' : 'Inactive'} variant={plan.isActive ? 'green' : 'red'} />
                </div>
              </div>

              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-2xl font-bold text-white">{paise(plan.pricePaise)}</span>
                <span className="text-zinc-500 text-sm">/{plan.billingCycle}</span>
              </div>

              {plan.trialDays > 0 && (
                <p className="text-xs text-emerald-400 mb-3">✓ {plan.trialDays}-day free trial</p>
              )}

              {/* Feature flags */}
              <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
                {plan.features.ai_explanations    && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/50 text-violet-400 border border-violet-800/50">AI Explanations</span>}
                {plan.features.offline_access      && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/50 text-violet-400 border border-violet-800/50">Offline</span>}
                {plan.features.advanced_analytics  && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/50 text-violet-400 border border-violet-800/50">Analytics</span>}
                {plan.features.deep_insights       && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/50 text-violet-400 border border-violet-800/50">Deep Insights</span>}
                {plan.features.mastery_radar       && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/50 text-violet-400 border border-violet-800/50">Mastery Radar</span>}
                {plan.features.priority_support    && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/50 text-violet-400 border border-violet-800/50">Priority Support</span>}
              </div>

              <div className="flex gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setModal(plan)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(plan)}
                  disabled={deleting === plan.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/40 hover:text-red-400 text-zinc-500 text-xs transition disabled:opacity-50"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
