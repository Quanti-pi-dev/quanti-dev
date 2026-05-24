'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import clsx from 'clsx';
import Image from 'next/image';
import {
  BookOpen, Users, ClipboardList, FileText,
  Trophy, Key, LogOut, ChevronRight, GraduationCap, Settings,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

const NAV = [
  { href: '/',            label: 'Dashboard',   icon: BookOpen,      roles: ['educator','examiner','institute_admin'] },
  { href: '/students',    label: 'Students',    icon: GraduationCap, roles: ['educator','examiner','institute_admin'] },
  { href: '/members',     label: 'Members',     icon: Users,         roles: ['institute_admin'] },
  { href: '/join-codes',  label: 'Join Codes',  icon: Key,           roles: ['institute_admin'] },
  { href: '/tests',       label: 'Tests',       icon: ClipboardList, roles: ['educator','institute_admin'] },
  { href: '/mock-tests',  label: 'Mock Tests',  icon: FileText,      roles: ['examiner','institute_admin'] },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy,        roles: ['educator','examiner','institute_admin'] },
  { href: '/settings',    label: 'Settings',    icon: Settings,      roles: ['institute_admin'] },
] as const;

export function Sidebar() {
  const pathname                        = usePathname();
  const { instituteRole, user, logout } = useAuth();
  const [collapsed, setCollapsed]       = useState(false);

  // Restore persisted preference after mount
  useEffect(() => {
    try {
      if (localStorage.getItem('institute-sidebar-collapsed') === 'true') {
        setCollapsed(true);
      }
    } catch { /* SSR / private browsing */ }
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('institute-sidebar-collapsed', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

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
    <aside
      className={clsx(
        'flex flex-col h-screen shrink-0 transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={{ background: 'var(--color-surface-900)', borderRight: '1px solid rgba(99,102,241,0.12)' }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      {collapsed ? (
        // When collapsed: entire header is one big expand button
        <button
          onClick={toggle}
          title="Expand sidebar"
          className="flex h-16 w-full shrink-0 items-center justify-center transition-colors hover:bg-white/5"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', color: 'var(--color-surface-400)' }}
        >
          <PanelLeftOpen size={18} />
        </button>
      ) : (
        // When expanded: logo + wordmark + role + collapse toggle
        <div
          className="flex h-16 shrink-0 items-center gap-2 px-3"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}
        >
          <Image
            src="/logo.jpg"
            alt="QuantiPi"
            width={30}
            height={30}
            className="rounded-lg shadow-md shadow-indigo-900/50 shrink-0"
            priority
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-none whitespace-nowrap">QuantiPi</p>
            <p className="text-xs mt-0.5 whitespace-nowrap truncate" style={{ color: 'var(--color-brand-400)' }}>
              {roleLabel}
            </p>
          </div>
          <button
            onClick={toggle}
            title="Collapse sidebar"
            className="shrink-0 flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-white/10"
            style={{ color: 'var(--color-surface-400)' }}
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      )}

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
        {!collapsed && (
          <p
            className="text-xs font-semibold tracking-widest uppercase px-3 mb-3"
            style={{ color: 'var(--color-surface-400)' }}
          >
            Navigation
          </p>
        )}
        <ul className="space-y-1">
          {visible.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  className={clsx(
                    'flex items-center rounded-xl text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                    !active && 'hover:text-white',
                  )}
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.15) 100%)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    color: '#a5b4fc',
                  } : { color: 'var(--color-surface-300)' }}
                >
                  <Icon
                    className={clsx('w-4 h-4 shrink-0 transition-colors', active ? 'text-indigo-400' : 'text-current')}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User footer ───────────────────────────────────────── */}
      <div
        className={clsx(
          'shrink-0 transition-all duration-300',
          collapsed ? 'px-2 py-3' : 'px-4 py-4',
        )}
        style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              title={user?.displayName ?? user?.email ?? '?'}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold cursor-default"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
            >
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <button
              id="sidebar-logout"
              onClick={logout}
              title="Sign out"
              className="w-full flex items-center justify-center rounded-xl p-2 text-sm transition-all duration-150 hover:text-red-400"
              style={{ color: 'var(--color-surface-400)' }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
              >
                {user?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{user?.displayName ?? user?.email}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-surface-400)' }}>{user?.email}</p>
              </div>
            </div>
            <button
              id="sidebar-logout"
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 hover:text-red-400"
              style={{ color: 'var(--color-surface-400)' }}
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
