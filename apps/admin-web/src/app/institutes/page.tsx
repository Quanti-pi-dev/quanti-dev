'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { PageShell, Badge, Spinner, ErrorBanner } from '@/components/page-shell';
import { DataTable } from '@/components/data-table';
import { Plus, ChevronRight } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────

interface Institute {
  id: string;
  name: string;
  code: string;
  type: 'coaching' | 'school' | 'university';
  contactEmail: string;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Create Modal ─────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', code: '', type: 'coaching' as Institute['type'],
    contactEmail: '', contactPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await adminApi.post('/api/admin/institutes', {
        ...form,
        contactPhone: form.contactPhone || undefined,
      });
      onCreated();
      onClose();
    } catch {
      setError('Failed to create institute. Check required fields.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-5">Create Institute</h2>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <Field label="Name" required>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={INPUT} placeholder="e.g. Brilliant Coaching Centre" />
          </Field>
          <Field label="Code (unique, short)" required>
            <input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              maxLength={12} className={INPUT} placeholder="e.g. BCC" />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Institute['type'] }))}
              className={INPUT}>
              <option value="coaching">Coaching</option>
              <option value="school">School</option>
              <option value="university">University</option>
            </select>
          </Field>
          <Field label="Contact Email" required>
            <input required type="email" value={form.contactEmail}
              onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
              className={INPUT} placeholder="admin@institute.com" />
          </Field>
          <Field label="Contact Phone">
            <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
              className={INPUT} placeholder="+91 9876543210" />
          </Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white hover:border-zinc-500 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50">
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500';

// ─── Page ─────────────────────────────────────────────────────

export default function InstitutesPage() {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchInstitutes = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminApi.get<{ data: Institute[] }>('/api/admin/institutes', {
        params: { limit: 100, offset: 0 },
      });
      setInstitutes(res.data.data);
    } catch {
      setError('Failed to load institutes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInstitutes(); }, [fetchInstitutes]);

  const toggleActive = async (inst: Institute) => {
    try {
      await adminApi.patch(`/api/admin/institutes/${inst.id}/activate`, {
        isActive: !inst.isActive,
      });
      setInstitutes(prev => prev.map(i => i.id === inst.id ? { ...i, isActive: !i.isActive } : i));
    } catch {
      alert('Failed to update status.');
    }
  };

  const COLUMNS: ColumnDef<Institute, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link href={`/institutes/${row.original.id}`}
          className="font-medium text-white hover:text-violet-400 transition-colors flex items-center gap-1">
          {row.original.name}
          <ChevronRight size={12} className="text-zinc-600" />
        </Link>
      ),
    },
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as string;
        return <Badge label={t} variant={t === 'coaching' ? 'violet' : t === 'school' ? 'green' : 'yellow'} />;
      },
    },
    { accessorKey: 'contactEmail', header: 'Contact' },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <button
          onClick={() => toggleActive(row.original)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            row.original.isActive
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60 hover:bg-red-950/60 hover:text-red-400 hover:border-red-800'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-emerald-950/60 hover:text-emerald-400 hover:border-emerald-800'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${row.original.isActive ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
          {row.original.isActive ? 'Active' : 'Inactive'}
        </button>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString('en-IN'),
    },
  ];

  return (
    <>
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchInstitutes}
        />
      )}
      <PageShell
        title="Institutes"
        subtitle={`${institutes.length} registered`}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={14} /> New Institute
          </button>
        }
      >
        {error && <ErrorBanner message={error} />}
        {loading ? <Spinner /> : <DataTable columns={COLUMNS} data={institutes} pageSize={20} />}
      </PageShell>
    </>
  );
}
