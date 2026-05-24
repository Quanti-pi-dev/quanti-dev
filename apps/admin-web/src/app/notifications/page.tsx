'use client';

// ─── Notifications Page ────────────────────────────────────────
// Push notification management via FCM HTTP v1.
// Routes wired:
//   POST /api/admin/notifications/broadcast  — segment or single-user push
//   GET  /api/admin/notifications/stats      — registered device count

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Spinner, ErrorBanner, Badge } from '@/components/page-shell';
import { Bell, Send, Users, Smartphone, AlertTriangle, CheckCircle2, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

type Segment = 'all' | 'free' | 'paid' | 'trial';

interface BroadcastResult {
  sent: number;
  failed: number;
  segment: string;
  errors?: string[];
}

interface Stats {
  registeredDevices: number;
}

// ─── Presets ──────────────────────────────────────────────────

const PRESETS: Array<{ label: string; emoji: string; title: string; body: string; segment: Segment }> = [
  {
    label: 'Study Reminder',
    emoji: '📚',
    title: "Don't forget to study today!",
    body: "Keep your streak alive — just 10 minutes of practice makes a difference.",
    segment: 'all',
  },
  {
    label: 'Upgrade Push',
    emoji: '⬆️',
    title: 'Unlock your full potential 🚀',
    body: 'Upgrade to Pro and get unlimited questions, analytics & more!',
    segment: 'free',
  },
  {
    label: 'Renewal Reminder',
    emoji: '🔔',
    title: 'Your subscription needs attention',
    body: 'Renew now to keep your streak and access all premium features.',
    segment: 'paid',
  },
  {
    label: 'Trial Expiry',
    emoji: '⏰',
    title: 'Your free trial is ending soon',
    body: "Don't lose your progress — upgrade before your trial runs out!",
    segment: 'trial',
  },
  {
    label: 'New Feature',
    emoji: '✨',
    title: 'New features just dropped! ✨',
    body: 'Check out what\'s new in the app — mock tests, AI coaching & more.',
    segment: 'all',
  },
  {
    label: 'Tournament Alert',
    emoji: '🏆',
    title: 'A new tournament is live!',
    body: 'Compete with students nationwide. Enter now and win coins!',
    segment: 'all',
  },
];

const SEGMENT_META: Record<Segment, { label: string; description: string; variant: 'zinc' | 'violet' | 'green' | 'yellow' }> = {
  all:   { label: 'All Users',   description: 'Every user with a registered device', variant: 'violet' },
  free:  { label: 'Free Users',  description: 'Users on the free tier (planTier = 0)', variant: 'zinc' },
  paid:  { label: 'Paid Users',  description: 'Users with an active paid subscription', variant: 'green' },
  trial: { label: 'Trial Users', description: 'Users currently in a free trial', variant: 'yellow' },
};

// ─── Event Reference Panel ────────────────────────────────────

const AUTO_EVENTS = [
  { category: 'Gamification', events: ['badge_earned', 'streak_milestone'] },
  { category: 'Subscriptions', events: ['trial_started', 'trial_ending', 'trial_expired', 'payment_failed', 'subscription_activated', 'subscription_expired'] },
  { category: 'P2P Challenges', events: ['challenge_received', 'challenge_accepted', 'challenge_declined', 'challenge_won', 'challenge_lost', 'challenge_tie'] },
  { category: 'Social', events: ['friend_request_received', 'friend_request_accepted', 'welcome'] },
];

function EventReference() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Bell size={14} className="text-violet-400" />
        Automated Event Triggers
      </h3>
      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
        These push notifications are sent <span className="text-zinc-300">automatically</span> by the system when events occur. You don't need to trigger them manually.
      </p>
      <div className="space-y-4">
        {AUTO_EVENTS.map(group => (
          <div key={group.category}>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">{group.category}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.events.map(ev => (
                <span key={ev} className="inline-block px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-xs font-mono">
                  {ev}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Result Toast ─────────────────────────────────────────────

function ResultBanner({ result, onClose }: { result: BroadcastResult; onClose: () => void }) {
  const isSuccess = result.failed === 0;
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${isSuccess ? 'bg-green-950/30 border-green-800/40' : 'bg-yellow-950/30 border-yellow-800/40'}`}>
      {isSuccess
        ? <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />
        : <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">
          Broadcast complete —&nbsp;
          <span className="text-green-400">{result.sent} sent</span>
          {result.failed > 0 && <span className="text-yellow-400">, {result.failed} failed</span>}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">Segment: {result.segment}</p>
        {result.errors && result.errors.length > 0 && (
          <p className="text-xs text-red-400 mt-1 font-mono truncate">{result.errors[0]}</p>
        )}
      </div>
      <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

export default function NotificationsPage() {
  const [stats, setStats]           = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [title, setTitle]           = useState('');
  const [body, setBody]             = useState('');
  const [segment, setSegment]       = useState<Segment>('all');
  const [targetEmail, setTargetEmail] = useState('');
  const [mode, setMode]             = useState<'segment' | 'single'>('segment');

  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState('');
  const [result, setResult]         = useState<BroadcastResult | null>(null);

  const titleLen = title.length;
  const bodyLen  = body.length;

  // ── Fetch stats ──────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await adminApi.get<{ data: Stats }>('/api/admin/notifications/stats');
      setStats(res.data.data);
    } catch { /* stats are non-critical */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  // ── Apply preset ─────────────────────────────────────────
  const applyPreset = (p: typeof PRESETS[0]) => {
    setTitle(p.title);
    setBody(p.body);
    setSegment(p.segment);
    setMode('segment');
    setResult(null);
    setError('');
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true); setError(''); setResult(null);
    try {
      const payload: Record<string, unknown> = { title: title.trim(), body: body.trim() };
      if (mode === 'single') {
        payload['targetEmail'] = targetEmail.trim();
      } else {
        payload['segment'] = segment;
      }
      const res = await adminApi.post<{ data: BroadcastResult }>('/api/admin/notifications/broadcast', payload);
      setResult(res.data.data);
      void fetchStats(); // refresh device count
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Broadcast failed';
      setError(msg);
    }
    finally { setSending(false); }
  };

  const canSend = title.trim().length > 0 && body.trim().length > 0 &&
    (mode === 'segment' || targetEmail.trim().length > 0);

  return (
    <PageShell
      title="Notifications"
      subtitle="Push notification broadcast via Firebase Cloud Messaging"
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left column: composer ──────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center shrink-0">
                <Smartphone size={18} className="text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {statsLoading ? '—' : (stats?.registeredDevices ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500">Registered devices</p>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-600/10 flex items-center justify-center shrink-0">
                <Bell size={18} className="text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">FCM</p>
                <p className="text-xs text-zinc-500">HTTP v1 · Service Account</p>
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Quick Presets</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:border-violet-600/50 hover:bg-violet-950/20 text-left transition text-sm text-zinc-300 hover:text-white"
                >
                  <span>{p.emoji}</span>
                  <span className="font-medium truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Composer */}
          <form onSubmit={handleSend} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
            <p className="text-sm font-semibold text-white">Compose Notification</p>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-zinc-700 w-fit">
              {(['segment', 'single'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 text-sm font-medium transition ${mode === m ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  {m === 'segment' ? <><Users size={13} className="inline mr-1.5" />Segment</> : <><Smartphone size={13} className="inline mr-1.5" />Single User</>}
                </button>
              ))}
            </div>

            {/* Targeting */}
            {mode === 'segment' ? (
              <div>
                <label className={LABEL}>Target Segment</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.entries(SEGMENT_META) as [Segment, typeof SEGMENT_META[Segment]][]).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSegment(key)}
                      className={`p-3 rounded-xl border text-left transition ${segment === key ? 'border-violet-500 bg-violet-950/30' : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600'}`}
                    >
                      <p className="text-sm font-medium text-white">{meta.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{meta.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className={LABEL}>Target Email</label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={e => setTargetEmail(e.target.value)}
                  placeholder="user@example.com"
                  className={INPUT}
                />
              </div>
            )}

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={LABEL.replace('mb-1.5', '')}>Title</label>
                <span className={`text-xs ${titleLen > 90 ? 'text-red-400' : 'text-zinc-600'}`}>{titleLen}/100</span>
              </div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
                placeholder="Notification title…"
                className={INPUT}
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={LABEL.replace('mb-1.5', '')}>Message</label>
                <span className={`text-xs ${bodyLen > 270 ? 'text-red-400' : 'text-zinc-600'}`}>{bodyLen}/300</span>
              </div>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Notification body…"
                className={INPUT}
              />
            </div>

            {/* Preview */}
            {(title || body) && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Preview</p>
                <div className="flex gap-3 items-start">
                  <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                    <Bell size={16} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{title || 'Notification title'}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{body || 'Notification body'}</p>
                    <p className="text-[11px] text-zinc-600 mt-1">now · QuantiPi</p>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback */}
            {error && <ErrorBanner message={error} />}
            {result && <ResultBanner result={result} onClose={() => setResult(null)} />}

            {/* Send */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-zinc-600">
                {mode === 'segment'
                  ? `Sending to: ${SEGMENT_META[segment].label}`
                  : targetEmail ? `Sending to: ${targetEmail}` : 'Enter a target email'}
              </p>
              <button
                type="submit"
                disabled={sending || !canSend}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
              >
                {sending ? <Spinner /> : <Send size={14} />}
                {sending ? 'Sending…' : 'Send Notification'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right column: reference ────────────────────── */}
        <div className="space-y-5">
          <EventReference />

          {/* Architecture note */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Infrastructure</p>
            <div className="space-y-3 text-xs text-zinc-500 leading-relaxed">
              <div className="flex gap-2">
                <span className="text-violet-400 shrink-0">→</span>
                <span><span className="text-zinc-300">FCM HTTP v1</span> — service account auth via Google Auth Library, tokens cached in memory</span>
              </div>
              <div className="flex gap-2">
                <span className="text-violet-400 shrink-0">→</span>
                <span><span className="text-zinc-300">Device tokens</span> — stored in Redis as <code className="font-mono text-zinc-400">fcm_token:{'<userId>'}</code> with 90-day TTL</span>
              </div>
              <div className="flex gap-2">
                <span className="text-violet-400 shrink-0">→</span>
                <span><span className="text-zinc-300">Email</span> — automated emails via Resend API with template system</span>
              </div>
              <div className="flex gap-2">
                <span className="text-violet-400 shrink-0">→</span>
                <span>Broadcasts use parallel batches of 50 to avoid rate limits</span>
              </div>
              <div className="flex gap-2">
                <span className="text-violet-400 shrink-0">→</span>
                <span>Invalid/expired tokens are auto-cleaned on 400/404 FCM responses</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </PageShell>
  );
}
