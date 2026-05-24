'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  LayoutDashboard, Users, BookOpen, Trophy, CreditCard,
  Settings, LogOut, Layers, Swords, Bell, BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Nav items ────────────────────────────────────────────────

const NAV = [
  { label: 'Dashboard',     href: '/',                icon: LayoutDashboard },
  { label: 'Users',         href: '/users',           icon: Users },
  { label: 'Exams',         href: '/exams',           icon: BookOpen },
  { label: 'Decks',         href: '/decks',           icon: Layers },
  { label: 'Subscriptions', href: '/subscriptions',   icon: CreditCard },
  { label: 'Tournaments',   href: '/tournaments',     icon: Trophy },
  { label: 'Challenges',    href: '/challenges',      icon: Swords },
  { label: 'Notifications', href: '/notifications',   icon: Bell },
  { label: 'Analytics',     href: '/analytics',       icon: BarChart3 },
  { label: 'Config',        href: '/config',          icon: Settings },
];

// ─── Component ────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 min-h-screen">
      {/* Wordmark */}
      <div className="h-16 flex items-center px-5 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-tight text-white">
          QuantiPi <span className="text-violet-400">Admin</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.email?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.email ?? 'Admin'}</p>
            <p className="text-xs text-zinc-500">Administrator</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
