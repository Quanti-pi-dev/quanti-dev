'use client';

// ─── Tournaments Page ─────────────────────────────────────────
// Full CRUD for tournament management.
// Routes wired:
//   GET    /api/admin/tournaments
//   POST   /api/admin/tournaments
//   PUT    /api/admin/tournaments/:id
//   DELETE /api/admin/tournaments/:id
//   GET    /api/admin/tournaments/:id/leaderboard  ← wired
//
// NOTE: POST /api/admin/tournaments/:id/score is a PLAYER-SIDE endpoint
// called from the mobile app after gameplay. It is not an admin action.
// Scores appear in the leaderboard; CSV export is provided here for auditing.

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { ConfirmModal } from '@/components/confirm-modal';
import { useToast } from '@/components/toast';
import { Plus, Pencil, Trash2, X, Trophy, Crown, Medal, Download } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

type TournamentStatus = 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled';

interface TournamentRow {
  id: string;
  name: string;
  description?: string;
  status: TournamentStatus;
  entryFeeCoins: number;
  requiredTier: number;
  maxParticipants: number;
  entryCount: number;
  startsAt: string;
  endsAt: string;
  prizeCoins?: number;
  prizeDescription?: string;
  rules?: string;
  deckId?: string | null;
  examId?: string | null;
}

const STATUS_VARIANT: Record<TournamentStatus, 'yellow' | 'green' | 'zinc' | 'red' | 'violet'> = {
  draft:     'violet',
  upcoming:  'yellow',
  active:    'green',
  completed: 'zinc',
  cancelled: 'red',
};

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Leaderboard Panel ───────────────────────────────────────

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  email: string;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  rank: number;
}

function LeaderboardPanel({ tournament, onClose }: { tournament: TournamentRow; onClose: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    adminApi.get<{ data: LeaderboardEntry[] }>(`/api/admin/tournaments/${tournament.id}/leaderboard`)
      .then(r => setEntries(r.data.data))
      .catch(() => setError('Failed to load leaderboard.'))
      .finally(() => setLoading(false));
  }, [tournament.id]);

  const RANK_ICON: Record<number, React.ReactNode> = {
    1: <Crown size={14} className="text-yellow-400" />,
    2: <Medal size={14} className="text-zinc-400" />,
    3: <Medal size={14} className="text-amber-600" />,
  };

  const exportCSV = () => {
    if (entries.length === 0) return;
    const header = 'Rank,Display Name,Email,Score,Correct,Total';
    const rows = entries.map(e =>
      `${e.rank},"${e.displayName.replace(/"/g, '""')}","${e.email}",${e.score},${e.correctAnswers},${e.totalAnswers}`,
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaderboard_${tournament.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
    >
      <div className="bg-zinc-900 border-l border-zinc-700 w-full max-w-lg h-full overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Leaderboard</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{tournament.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button onClick={exportCSV} title="Export CSV"
                className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition">
                <Download size={14} />
              </button>
            )}
            <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
          </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {error && <ErrorBanner message={error} />}
          {loading ? <Spinner /> : entries.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">No participants yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.userId} className={`flex items-center gap-4 p-4 rounded-xl border ${
                  e.rank === 1 ? 'bg-yellow-950/20 border-yellow-800/30' :
                  e.rank === 2 ? 'bg-zinc-800/60 border-zinc-700' :
                  e.rank === 3 ? 'bg-amber-950/10 border-amber-800/20' :
                  'bg-zinc-900 border-zinc-800'
                }`}>
                  <div className="w-8 flex items-center justify-center">
                    {RANK_ICON[e.rank] ?? <span className="text-xs text-zinc-600 font-bold">#{e.rank}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{e.displayName || e.email}</p>
                    <p className="text-xs text-zinc-500 truncate">{e.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white">{e.score.toLocaleString()}</p>
                    <p className="text-xs text-zinc-600">{e.correctAnswers}/{e.totalAnswers} correct</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function apiError(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Unknown error';
}

function toLocal(iso: string) {
  // Convert ISO to local datetime-local input value
  return iso ? new Date(iso).toISOString().slice(0, 16) : '';
}

// ─── Tournament Modal ─────────────────────────────────────────

function TournamentModal({ tournament, onClose, onSaved }: { tournament: TournamentRow | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!tournament;
  const [form, setForm] = useState({
    name:             tournament?.name             ?? '',
    description:      tournament?.description      ?? '',
    entryFeeCoins:    tournament?.entryFeeCoins    ?? 0,
    requiredTier:     tournament?.requiredTier     ?? 0,
    maxParticipants:  tournament?.maxParticipants  ?? 0,
    startsAt:         tournament?.startsAt         ? toLocal(tournament.startsAt) : '',
    endsAt:           tournament?.endsAt           ? toLocal(tournament.endsAt)   : '',
    prizeCoins:       tournament?.prizeCoins       ?? 0,
    prizeDescription: tournament?.prizeDescription ?? '',
    rules:            tournament?.rules            ?? '',
    deckId:           tournament?.deckId           ?? '',
    examId:           tournament?.examId           ?? '',
    status:           tournament?.status           ?? 'draft' as TournamentStatus,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({
      ...p,
      [k]: ['entryFeeCoins', 'requiredTier', 'maxParticipants', 'prizeCoins'].includes(k)
        ? Number(e.target.value) : e.target.value,
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.startsAt || !form.endsAt) { setError('Name, start date and end date are required.'); return; }
    if (new Date(form.startsAt) >= new Date(form.endsAt)) { setError('End date must be after start date.'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      name: form.name,
      entryFeeCoins: form.entryFeeCoins,
      requiredTier: form.requiredTier,
      maxParticipants: form.maxParticipants,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
    };
    if (form.description) payload.description = form.description;
    if (form.prizeCoins) payload.prizeCoins = form.prizeCoins;
    if (form.prizeDescription) payload.prizeDescription = form.prizeDescription;
    if (form.rules) payload.rules = form.rules;
    if (form.deckId) payload.deckId = form.deckId;
    if (form.examId) payload.examId = form.examId;
    if (isEdit) payload.status = form.status;
    try {
      if (isEdit) await adminApi.put(`/api/admin/tournaments/${tournament!.id}`, payload);
      else await adminApi.post('/api/admin/tournaments', payload);
      onSaved();
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm py-6"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Tournament' : 'New Tournament'}</h2>
          <button onClick={onClose}><X size={16} className="text-zinc-500 hover:text-white" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div><label className={LABEL}>Name *</label><input value={form.name} onChange={set('name')} placeholder="e.g. UPSC Weekly Challenge" className={INPUT} /></div>
          <div><label className={LABEL}>Description</label><textarea value={form.description} onChange={set('description')} rows={2} className={INPUT} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Starts At *</label><input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} className={INPUT} /></div>
            <div><label className={LABEL}>Ends At *</label><input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={LABEL}>Entry Fee (coins)</label><input type="number" min={0} value={form.entryFeeCoins} onChange={set('entryFeeCoins')} className={INPUT} /></div>
            <div>
              <label className={LABEL}>Required Tier (0=all)</label>
              <select value={form.requiredTier} onChange={set('requiredTier')} className={INPUT}>
                <option value={0}>0 — All users</option>
                <option value={1}>1 — Basic+</option>
                <option value={2}>2 — Pro+</option>
                <option value={3}>3 — Elite only</option>
              </select>
            </div>
            <div><label className={LABEL}>Max Participants (0=∞)</label><input type="number" min={0} value={form.maxParticipants} onChange={set('maxParticipants')} className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Prize Coins</label><input type="number" min={0} value={form.prizeCoins} onChange={set('prizeCoins')} className={INPUT} /></div>
            <div><label className={LABEL}>Prize Description</label><input value={form.prizeDescription} onChange={set('prizeDescription')} placeholder="e.g. Top 3 win 500 coins" className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Rules (optional)</label><textarea value={form.rules} onChange={set('rules')} rows={2} placeholder="Markdown or plain text rules" className={INPUT} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Deck ID (optional)</label><input value={form.deckId} onChange={set('deckId')} placeholder="MongoDB ObjectId" className={INPUT} /></div>
            <div><label className={LABEL}>Exam ID (optional)</label><input value={form.examId} onChange={set('examId')} placeholder="MongoDB ObjectId" className={INPUT} /></div>
          </div>
          {isEdit && (
            <div>
              <label className={LABEL}>Status</label>
              <select value={form.status} onChange={set('status')} className={INPUT}>
                {(['draft', 'upcoming', 'active', 'completed', 'cancelled'] as TournamentStatus[]).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Tournament'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function TournamentsPage() {
  const [rows, setRows]       = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | TournamentRow>(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<TournamentRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: TournamentRow[] }>('/api/admin/tournaments');
      setRows(res.data.data);
    } catch { setError('Failed to load tournaments.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [deleteTarget, setDeleteTarget] = useState<TournamentRow | null>(null);
  const [deleteError, setDeleteError]   = useState('');
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id); setDeleteError('');
    try {
      await adminApi.delete(`/api/admin/tournaments/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success('Tournament deleted');
      await fetchData();
    }
    catch (err) { setDeleteError(apiError(err)); } finally { setDeleting(null); }
  };

  const COLUMNS: ColumnDef<TournamentRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Tournament',
      cell: ({ getValue }) => <span className="font-medium text-white">{getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => { const s = getValue() as TournamentStatus; return <Badge label={s} variant={STATUS_VARIANT[s]} />; },
    },
    {
      accessorKey: 'entryFeeCoins',
      header: 'Entry',
      cell: ({ getValue }) => `${(getValue() as number).toLocaleString()} 🪙`,
    },
    {
      id: 'participants',
      header: 'Participants',
      cell: ({ row }) => {
        const max = row.original.maxParticipants;
        return `${row.original.entryCount}${max > 0 ? ` / ${max}` : ''}`;
      },
    },
    {
      accessorKey: 'startsAt',
      header: 'Starts',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
    },
    {
      accessorKey: 'endsAt',
      header: 'Ends',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setLeaderboard(row.original)} className="p-2 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-zinc-800 transition" title="Leaderboard"><Trophy size={13} /></button>
          <button onClick={() => setModal(row.original)} className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"><Pencil size={13} /></button>
          <button onClick={() => { setDeleteTarget(row.original); setDeleteError(''); }} disabled={deleting === row.original.id} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  const active = rows.filter(r => r.status === 'active').length;

  return (
    <PageShell
      title="Tournaments"
      subtitle={`${rows.length} total · ${active} active`}
      actions={
        <button onClick={() => setModal('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition">
          <Plus size={14} /> New Tournament
        </button>
      }
    >
      {modal !== false && <TournamentModal tournament={typeof modal === 'object' ? modal : null} onClose={() => setModal(false)} onSaved={() => { setModal(false); fetchData(); }} />}
      {leaderboard && <LeaderboardPanel tournament={leaderboard} onClose={() => setLeaderboard(null)} />}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Tournament"
          description={`Are you sure you want to delete tournament "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete Tournament"
          destructive
          loading={deleting === deleteTarget.id}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={rows} pageSize={20} />}
    </PageShell>
  );
}
