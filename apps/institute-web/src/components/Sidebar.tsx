'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import clsx from 'clsx';
import {
  BookOpen, Users, ClipboardList, FileText,
  Trophy, Key, LogOut, ChevronRight,
} from 'lucide-react';

const NAV = [
  { href: '/',              label: 'Dashboard',   icon: BookOpen,      roles: ['educator','examiner','institute_admin'] },
  { href: '/members',       label: 'Members',     icon: Users,         roles: ['institute_admin'] },
  { href: '/join-codes',    label: 'Join Codes',  icon: Key,           roles: ['institute_admin'] },
  { href: '/tests',         label: 'Tests',       icon: ClipboardList, roles: ['educator','institute_admin'] },
  { href: '/mock-tests',    label: 'Mock Tests',  icon: FileText,      roles: ['examiner','institute_admin'] },
  { href: '/leaderboard',   label: 'Leaderboard', icon: Trophy,        roles: ['educator','examiner','institute_admin'] },
] as const;

export function Sidebar() {
  const pathname           = usePathname();
  const { instituteRole, user, logout } = useAuth();

  const visible = NAV.filter(n =>
    instituteRole && (n.roles as readonly string[]).includes(instituteRole),
  );

  const ROLE_LABELS: Record<string, string> = {
    educator:        'Educator',
    examiner:        'Examiner',
    institute_admin: 'Institute Admin',
  };
  const roleLabel = instituteRole ? (ROLE_LABELS[instituteRole] ?? '') : '';

  return (
    <aside className="flex flex-col h-screen w-64 shrink-0"
      style={{ background: 'var(--color-surface-900)', borderRight: '1px solid rgba(99,102,241,0.12)' }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #c084fc 100%)' }}>
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-none">QuantiPi</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-brand-400)' }}>
            {roleLabel}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className="text-xs font-semibold tracking-widest uppercase px-3 mb-3"
          style={{ color: 'var(--color-surface-400)' }}>
          Navigation
        </p>
        <ul className="space-y-1">
          {visible.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link href={href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                    active
                      ? 'text-white'
                      : 'hover:text-white',
                  )}
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.15) 100%)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    color: '#a5b4fc',
                  } : { color: 'var(--color-surface-300)' }}>
                  <Icon className={clsx('w-4 h-4 shrink-0 transition-colors', active ? 'text-indigo-400' : 'text-current')} />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 shrink-0" style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">{user?.displayName ?? user?.email}</p>
            <p className="text-xs truncate" style={{ color: 'var(--color-surface-400)' }}>{user?.email}</p>
          </div>
        </div>
        <button id="sidebar-logout" onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 hover:text-red-400"
          style={{ color: 'var(--color-surface-400)' }}>
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
