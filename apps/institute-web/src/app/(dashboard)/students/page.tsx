'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Users, Search, BookOpen, BarChart3, ChevronRight,
  GraduationCap, Filter, ArrowUpDown,
} from 'lucide-react';

interface OptedSubject {
  subjectId: string;
  subjectName: string;
}

interface Student {
  firebaseUid: string;
  userId: string;
  studentUid: string | null;
  displayName: string;
  email: string;
  optedSubjects: OptedSubject[];
  subjectCount: number;
  totalLevelsTracked: number;
}

// ── Mini colour palette for subject chips (cyclic) ──────────────
const SUBJECT_COLORS = [
  { bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.35)',  text: '#a5b4fc' },
  { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',    text: '#4ade80' },
  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',   text: '#fbbf24' },
  { bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.3)',   text: '#f472b6' },
  { bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)',   text: '#38bdf8' },
  { bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',   text: '#fb923c' },
];

type SortKey = 'name' | 'subjects' | 'levels';

export default function StudentsPage() {
  const { instituteId } = useAuth();
  const router = useRouter();

  const [students, setStudents]   = useState<Student[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [sort, setSort]           = useState<SortKey>('subjects');
  const [subjectFilter, setSubjectFilter] = useState('');

  // Collect unique subjects across all loaded students for the filter
  const [allSubjects, setAllSubjects] = useState<OptedSubject[]>([]);

  const fetchStudents = useCallback(async (q = '') => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/api/inst/v1/institutes/${instituteId}/students?limit=100&search=${encodeURIComponent(q)}`,
      );
      const data: Student[] = res.data.data;
      setStudents(data);
      setTotal(res.data.pagination?.total ?? data.length);

      // Build unique subject list
      const subjMap = new Map<string, string>();
      for (const s of data) {
        for (const sub of s.optedSubjects) {
          subjMap.set(sub.subjectId, sub.subjectName);
        }
      }
      setAllSubjects([...subjMap.entries()].map(([subjectId, subjectName]) => ({ subjectId, subjectName })));
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { void fetchStudents(); }, [fetchStudents]);

  // Client-side filter + sort (data already fetched)
  const filtered = students
    .filter(s => {
      if (subjectFilter && !s.optedSubjects.some(sub => sub.subjectId === subjectFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'subjects') return b.subjectCount - a.subjectCount;
      if (sort === 'levels')   return b.totalLevelsTracked - a.totalLevelsTracked;
      return a.displayName.localeCompare(b.displayName);
    });

  // Group by primary subject (first opted) for the "sorted by subject" view
  const grouped = new Map<string, { subjectName: string; students: Student[] }>();
  if (sort === 'subjects' && !subjectFilter) {
    for (const s of filtered) {
      const primary = s.optedSubjects[0];
      const key = primary ? primary.subjectId : '__none__';
      const label = primary ? primary.subjectName : 'No subjects yet';
      if (!grouped.has(key)) grouped.set(key, { subjectName: label, students: [] });
      grouped.get(key)!.students.push(s);
    }
  }

  const isGrouped = sort === 'subjects' && !subjectFilter && grouped.size > 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-surface-300)' }}>
            {total} student{total !== 1 ? 's' : ''} enrolled in your institute
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-surface-400)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); void fetchStudents(e.target.value); }}
            placeholder="Search by name, email, or ID…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
            style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }} />
        </div>

        {/* Subject filter */}
        {allSubjects.length > 0 && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-surface-400)' }} />
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-xl text-sm text-white outline-none appearance-none"
              style={{ background: 'var(--color-surface-800)', border: '1px solid var(--color-surface-600)' }}>
              <option value="">All subjects</option>
              {allSubjects.map(s => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
            </select>
          </div>
        )}

        {/* Sort */}
        <div className="flex gap-1 p-1 rounded-xl shrink-0" style={{ background: 'var(--color-surface-800)' }}>
          {([['subjects', 'By Subject'], ['levels', 'By Activity'], ['name', 'By Name']] as [SortKey, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
              style={sort === k
                ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }
                : { color: 'var(--color-surface-300)' }}>
              <ArrowUpDown className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Student list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass p-4 flex items-center gap-4">
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-4 w-40 rounded mb-2" />
                <div className="skeleton h-3 w-64 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-12 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--color-surface-300)' }} />
          <p className="text-white font-medium">No students found</p>
        </div>
      ) : isGrouped ? (
        // ── Grouped by subject ─────────────────────────────────
        <div className="space-y-8">
          {[...grouped.entries()].map(([key, group]) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--color-surface-400)' }}>
                  {group.subjectName}
                  <span className="ml-2 normal-case tracking-normal">({group.students.length})</span>
                </h2>
              </div>
              <div className="space-y-2">
                {group.students.map(s => <StudentRow key={s.firebaseUid} student={s} onView={() => router.push(`/students/${s.firebaseUid}`)} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // ── Flat sorted list ───────────────────────────────────
        <div className="space-y-2">
          {filtered.map(s => (
            <StudentRow key={s.firebaseUid} student={s} onView={() => router.push(`/students/${s.firebaseUid}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Student row card ─────────────────────────────────────────────

function StudentRow({ student: s, onView }: { student: Student; onView: () => void }) {
  const initials = s.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onView}
      className="glass p-4 flex items-center gap-4 cursor-pointer hover:border-indigo-500/30 transition-all duration-150 group"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
        {initials}
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-white font-medium text-sm truncate">{s.displayName}</p>
          {s.studentUid && (
            <span className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}>
              #{s.studentUid}
            </span>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--color-surface-400)' }}>{s.email}</p>
      </div>

      {/* Opted subjects */}
      <div className="hidden md:flex items-center gap-1.5 flex-wrap max-w-xs">
        {s.optedSubjects.length === 0 ? (
          <span className="text-xs italic" style={{ color: 'var(--color-surface-500)' }}>No subjects yet</span>
        ) : (
          s.optedSubjects.slice(0, 3).map((sub, idx) => {
            const c = SUBJECT_COLORS[idx % SUBJECT_COLORS.length]!;
            return (
              <span key={sub.subjectId} className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                {sub.subjectName}
              </span>
            );
          })
        )}
        {s.optedSubjects.length > 3 && (
          <span className="text-xs" style={{ color: 'var(--color-surface-400)' }}>
            +{s.optedSubjects.length - 3} more
          </span>
        )}
      </div>

      {/* Activity */}
      <div className="hidden lg:flex flex-col items-end shrink-0 text-right">
        <div className="flex items-center gap-1">
          <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-white text-sm font-semibold">{s.totalLevelsTracked}</span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-400)' }}>levels tracked</p>
      </div>

      {/* View arrow */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium hidden sm:block"
          style={{ color: 'var(--color-surface-400)' }}>View Report</span>
        <div className="p-1.5 rounded-lg transition-all duration-150 group-hover:text-indigo-400"
          style={{ color: 'var(--color-surface-500)', background: 'var(--color-surface-800)' }}>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
