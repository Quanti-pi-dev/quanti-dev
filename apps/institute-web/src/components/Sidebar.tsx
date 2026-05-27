'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { clsx } from 'clsx';
import {
  BookOpen, Users, ClipboardList, FileText,
  Trophy, Key, LogOut, ChevronRight, GraduationCap, Settings,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

// ─── Brand mark (inline SVG — no file dependency) ────────────
// Use a module-scoped gradient ID so it survives SSR + client hydration
// without colliding with other SVGs on the page.
const GRAD_ID = 'qp-sidebar-grad';

function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={GRAD_ID} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${GRAD_ID})`} />
      {/* π — top bar */}
      <line x1="7" y1="11" x2="25" y2="11" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      {/* π — left leg */}
      <line x1="11.5" y1="11" x2="11.5" y2="23" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      {/* π — right leg (curved) */}
      <path d="M20.5 11 L20.5 20 Q20.5 23 17.5 23" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── Nav items ────────────────────────────────────────────────

const NAV = [
  { href: '/',            label: 'Dashboard',   icon: BookOpen,      roles: ['educator', 'examiner', 'institute_admin'] },
  { href: '/students',    label: 'Students',    icon: GraduationCap, roles: ['educator', 'examiner', 'institute_admin'] },
  { href: '/members',     label: 'Members',     icon: Users,         roles: ['institute_admin'] },
  { href: '/join-codes',  label: 'Join Codes',  icon: Key,           roles: ['institute_admin'] },
  { href: '/tests',       label: 'Tests',       icon: ClipboardList, roles: ['educator', 'institute_admin'] },
  { href: '/mock-tests',  label: 'Mock Tests',  icon: FileText,      roles: ['examiner', 'institute_admin'] },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy,        roles: ['educator', 'examiner', 'institute_admin'] },
  { href: '/settings',    label: 'Settings',    icon: Settings,      roles: ['institute_admin'] },
] as const;

// ─── Component ────────────────────────────────────────────────

export function Sidebar() {
  const pathname                        = usePathname();
  const { instituteRole, user, logout } = useAuth();
  const [collapsed, setCollapsed]       = useState(false);

  // Restore persisted preference after mount
  useEffect(() => {
    try {
      if (localStorage.getItem('institute-sidebar-collapsed') === 'true') setCollapsed(true);
    } catch { /* SSR / private browsing */ }
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('institute-sidebar-collapsed', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const ROLE_LABELS: Record<string, string> = {
    educator:        'Educator',
    examiner:        'Examiner',
    institute_admin: 'Admin',
  };

  // Show all items during loading (role = null) so layout doesn't jump
  const visible = NAV.filter(n =>
    !instituteRole || (n.roles as readonly string[]).includes(instituteRole),
  );

  return (
    <aside
      className={clsx(
        'flex flex-col shrink-0 h-screen transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={{ background: 'var(--color-surface-900)', borderRight: '1px solid rgba(99,102,241,0.15)' }}
    >
      {/* ── Header: brand + wordmark + toggle ─────────────────── */}
      <div
        className="flex h-16 shrink-0 items-center gap-2 px-3 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}
      >
        {/* Brand mark — clickable when collapsed to expand */}
        <button
          onClick={collapsed ? toggle : undefined}
          title={collapsed ? 'Expand sidebar' : undefined}
          className={clsx(
            'shrink-0 rounded-lg transition-transform duration-150',
            collapsed ? 'cursor-pointer hover:scale-110 hover:brightness-125 active:scale-95' : 'cursor-default',
          )}
        >
          <BrandMark size={30} />
        </button>

        {/* Wordmark + role label — hidden when collapsed */}
        <div
          className={clsx(
            'flex-1 min-w-0 transition-all duration-300',
            collapsed ? 'opacity-0 w-0 pointer-events-none' : 'opacity-100',
          )}
        >
          <p className="text-white font-bold text-sm leading-none whitespace-nowrap">QuantiPi</p>
          {instituteRole && (
            <p className="text-xs mt-0.5 whitespace-nowrap" style={{ color: 'var(--color-brand-400)' }}>
              {ROLE_LABELS[instituteRole] ?? instituteRole}
            </p>
          )}
        </div>

        {/* Toggle — always visible, flips icon direction */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx(
            'shrink-0 flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-white/10',
            collapsed && 'mx-auto',
          )}
          style={{ color: 'var(--color-surface-400)' }}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="scrollbar-hidden flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-0.5 px-2">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest select-none"
            style={{ color: 'var(--color-surface-400)' }}>
            Navigation
          </p>
        )}
        {visible.map(({ href, label, icon: Icon }) => {
          // '/' must match exactly; all other routes use prefix match
          const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={clsx(
                'flex items-center rounded-xl text-sm font-medium transition-all duration-150',
                collapsed ? 'justify-center py-2.5 px-0' : 'gap-3 px-3 py-2.5',
              )}
              style={active ? {
                background: 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.15) 100%)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc',
              } : { color: 'var(--color-surface-300)' }}
            >
              <Icon className={clsx('w-4 h-4 shrink-0', active ? 'text-indigo-400' : 'text-current')} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User footer ───────────────────────────────────────── */}
      <div
        className={clsx('shrink-0 transition-all duration-300', collapsed ? 'p-2' : 'p-3')}
        style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              title={user?.email ?? '?'}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white cursor-default"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-lg p-1.5 transition-colors hover:text-red-400"
              style={{ color: 'var(--color-surface-400)' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user?.displayName ?? user?.email}</p>
              <p className="text-xs" style={{ color: 'var(--color-surface-400)' }}>
                {instituteRole ? (ROLE_LABELS[instituteRole] ?? instituteRole) : ''}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-lg p-1.5 transition-colors hover:text-red-400"
              style={{ color: 'var(--color-surface-400)' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
