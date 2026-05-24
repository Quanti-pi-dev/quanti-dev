'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Users, Search, Shield, GraduationCap, BookOpen, ChevronRight } from 'lucide-react';

interface Member {
  id: string;
  role: 'student' | 'educator' | 'examiner' | 'institute_admin';
  studentUid: string | null;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  isActive: boolean;
  joinedAt: string;
}

const ROLE_CONFIG = {
  student:         { label: 'Student',        icon: GraduationCap, color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)' },
  educator:        { label: 'Educator',       icon: BookOpen,      color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
  examiner:        { label: 'Examiner',       icon: Shield,        color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
  institute_admin: { label: 'Admin',          icon: Shield,        color: '#f472b6', bg: 'rgba(236,72,153,0.12)' },
};

export default function MembersPage() {
  const { instituteId } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    if (!instituteId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/inst/v1/institutes/${instituteId}/members?limit=100`);
        setMembers(res.data.data);
        setTotal(res.data.pagination?.total ?? 0);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [instituteId]);

  const filtered = members.filter(m =>
    m.displayName.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    (m.studentUid ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const byRole = (role: string) => filtered.filter(m => m.role === role);
  const students = byRole('student');
  const staff    = filtered.filter(m => m.role !== 'student');

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Members</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            {total} member{total !== 1 ? 's' : ''} across all roles
          </p>
        </div>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const count = members.filter(m => m.role === role).length;
          const Icon = cfg.icon;
          return (
            <div key={role} className="glass p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: cfg.bg }}>
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{count}</p>
                  <p className="text-xs" style={{ color: 'var(--color-surface-300)' }}>{cfg.label}s</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-surface-400)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or student ID…"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
          style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass p-4 flex items-center gap-4">
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-4 w-40 rounded mb-2" />
                <div className="skeleton h-3 w-56 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {staff.length > 0 && (
            <MemberSection title="Staff" members={staff} />
          )}
          {students.length > 0 && (
            <MemberSection title="Students" members={students} />
          )}
          {filtered.length === 0 && (
            <div className="glass p-10 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'var(--color-surface-300)' }} />
              <p className="text-white font-medium">No members found</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MemberSection({ title, members }: { title: string; members: Member[] }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-widest mb-3 px-1"
        style={{ color: 'var(--color-surface-400)' }}>
        {title} ({members.length})
      </h2>
      <div className="space-y-2">
        {members.map(m => {
          const cfg = ROLE_CONFIG[m.role] ?? ROLE_CONFIG['student'];
          const Icon = cfg.icon;
          const initials = m.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div key={m.id}
              className="glass p-4 flex items-center gap-4 hover:border-indigo-500/30 transition-all duration-150 cursor-default">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: cfg.bg, color: cfg.color }}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  : initials}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm truncate">{m.displayName}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    <Icon className="inline w-3 h-3 mr-0.5" />{cfg.label}
                  </span>
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-surface-400)' }}>
                  {m.email}
                  {m.studentUid && <span className="ml-2 text-indigo-400">#{m.studentUid}</span>}
                </p>
              </div>
              <div className="text-xs shrink-0" style={{ color: 'var(--color-surface-400)' }}>
                {new Date(m.joinedAt).toLocaleDateString()}
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-30" style={{ color: 'var(--color-surface-300)' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
