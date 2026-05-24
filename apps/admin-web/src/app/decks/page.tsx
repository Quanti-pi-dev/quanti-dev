'use client';

// ─── Flashcard Decks Page ─────────────────────────────────────
// Lists all decks with create, edit, delete, and drill-down to flashcards.
// Routes wired:
//   GET    /api/admin/decks
//   POST   /api/admin/decks
//   PUT    /api/admin/decks/:id
//   DELETE /api/admin/decks/:id

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Plus, Pencil, Trash2, BookOpen, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface DeckRow {
  id: string;
  title: string;
  category: string;
  description: string;
  cardCount: number;
  isPublished: boolean;
  tags?: string[];
  createdAt: string;
}

// ─── Shared styles ────────────────────────────────────────────

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5';

// ─── Deck Modal (create / edit) ───────────────────────────────

function DeckModal({
  deck,
  onClose,
  onSaved,
}: {
  deck: DeckRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!deck;
  const [form, setForm] = useState({
    title:       deck?.title       ?? '',
    description: deck?.description ?? '',
    category:    deck?.category    ?? '',
    tags:        deck?.tags?.join(', ') ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.category.trim()) {
      setError('Title, description and category are required.'); return;
    }
    setSaving(true); setError('');
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    try {
      if (isEdit) {
        await adminApi.put(`/api/admin/decks/${deck!.id}`, payload);
      } else {
        await adminApi.post('/api/admin/decks', payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? `Failed to ${isEdit ? 'update' : 'create'} deck.`);
    }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Deck' : 'New Deck'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className={LABEL}>Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="e.g. Polity Basics" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Description *</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Brief description…" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Category *</label>
            <input value={form.category} onChange={set('category')} placeholder="e.g. General Studies" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Tags <span className="text-zinc-600">(comma-separated)</span></label>
            <input value={form.tags} onChange={set('tags')} placeholder="e.g. polity, constitution, upsc" className={INPUT} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Deck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function DecksPage() {
  const router = useRouter();
  const [decks, setDecks]     = useState<DeckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState<false | 'new' | DeckRow>(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: DeckRow[]; pagination: unknown }>('/api/admin/decks');
      setDecks(res.data.data);
    } catch { setError('Failed to load decks.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  const handleDelete = async (deck: DeckRow) => {
    if (!confirm(`Delete "${deck.title}"? This will also remove all flashcards inside.`)) return;
    setDeleting(deck.id); setError('');
    try {
      await adminApi.delete(`/api/admin/decks/${deck.id}`);
      await fetchDecks();
    } catch { setError('Failed to delete deck.'); }
    finally { setDeleting(null); }
  };

  const COLUMNS: ColumnDef<DeckRow, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/decks/${row.original.id}`)}
          className="font-medium text-white hover:text-violet-400 transition text-left"
        >
          {row.original.title}
        </button>
      ),
    },
    { accessorKey: 'category', header: 'Category' },
    {
      accessorKey: 'cardCount',
      header: 'Cards',
      cell: ({ getValue }) => <span className="tabular-nums">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'isPublished',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge label={(getValue() as boolean) ? 'Published' : 'Draft'} variant={(getValue() as boolean) ? 'green' : 'zinc'} />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => router.push(`/decks/${row.original.id}`)}
            className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"
            title="View flashcards"
          >
            <BookOpen size={13} />
          </button>
          <button
            onClick={() => setModal(row.original)}
            className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition"
            title="Edit deck"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            disabled={deleting === row.original.id}
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"
            title="Delete deck"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  const totalCards = decks.reduce((s, d) => s + d.cardCount, 0);

  return (
    <PageShell
      title="Flashcard Decks"
      subtitle={`${decks.length} decks · ${totalCards.toLocaleString()} cards`}
      actions={
        <button
          onClick={() => setModal('new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} /> New Deck
        </button>
      }
    >
      {modal !== false && (
        <DeckModal
          deck={typeof modal === 'object' ? modal : null}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); fetchDecks(); }}
        />
      )}

      {error && <ErrorBanner message={error} />}
      {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={decks} pageSize={20} />}
    </PageShell>
  );
}
