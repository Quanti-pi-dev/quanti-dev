'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';
import {
  LayoutDashboard, Users, BookOpen, Trophy, CreditCard,
  Settings, LogOut, Layers, Bell, BarChart3, Building2,
  Tag, ReceiptText, Banknote, Coins, Medal, FileQuestion, ClipboardList,
  Swords, PanelLeftClose, PanelLeftOpen, Brain,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Nav structure with sections ─────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/',         icon: LayoutDashboard },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Exams',      href: '/exams',      icon: BookOpen },
      { label: 'Decks',      href: '/decks',      icon: Layers },
      { label: 'PYQ',        href: '/pyq',        icon: FileQuestion },
      { label: 'Mock Tests', href: '/mock-tests', icon: ClipboardList },
    ],
  },
  {
    label: 'Users',
    items: [
      { label: 'Users',      href: '/users',      icon: Users },
      { label: 'Institutes', href: '/institutes', icon: Building2 },
    ],
  },
  {
    label: 'Monetization',
    items: [
      { label: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
      { label: 'Plans',         href: '/plans',         icon: Banknote },
      { label: 'Coupons',       href: '/coupons',       icon: Tag },
      { label: 'Payments',      href: '/payments',      icon: ReceiptText },
      { label: 'Coin Packs',    href: '/coin-packs',    icon: Coins },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { label: 'Gamification',  href: '/gamification',  icon: Medal },
      { label: 'Tournaments',   href: '/tournaments',   icon: Trophy },
      { label: 'Challenges',    href: '/challenges',    icon: Swords },
      { label: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Analytics',    href: '/analytics',    icon: BarChart3 },
      { label: 'AI Settings',  href: '/ai-settings',  icon: Brain },
      { label: 'Config',       href: '/config',       icon: Settings },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Restore persisted preference after mount
  useEffect(() => {
    try {
      if (localStorage.getItem('admin-sidebar-collapsed') === 'true') {
        setCollapsed(true);
      }
    } catch { /* SSR / private browsing */ }
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('admin-sidebar-collapsed', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <aside
      className={clsx(
        'flex flex-col shrink-0 bg-zinc-900 border-r border-zinc-800 h-screen transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* ── Header: logo + wordmark + collapse toggle ─────────── */}
      <div className="flex h-16 shrink-0 items-center border-b border-zinc-800 px-3 gap-2 overflow-hidden">
        {/* Logo mark — clickable when collapsed to expand */}
        <button
          onClick={collapsed ? toggle : undefined}
          title={collapsed ? 'Expand sidebar' : undefined}
          className={clsx(
            'shrink-0 rounded-lg transition-transform duration-150',
            collapsed ? 'cursor-pointer hover:scale-110 hover:brightness-125 active:scale-95' : 'cursor-default',
          )}
        >
          <Image
            src="/logo.jpg"
            alt="QuantiPi"
            width={30}
            height={30}
            className="rounded-lg shadow-sm shadow-violet-900/60 block"
            priority
          />
        </button>

        {/* Wordmark — hidden when collapsed */}
        <span
          className={clsx(
            'flex-1 text-sm font-bold tracking-tight text-white whitespace-nowrap transition-all duration-300',
            collapsed ? 'opacity-0 w-0 pointer-events-none' : 'opacity-100',
          )}
        >
          QuantiPi <span className="text-violet-400">Admin</span>
        </span>

        {/* Collapse toggle — always visible, flips icon */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx(
            'shrink-0 flex items-center justify-center rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white',
            collapsed && 'mx-auto',
          )}
        >
          {collapsed
            ? <PanelLeftOpen  size={15} />
            : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label} className={si > 0 ? 'mt-3' : ''}>
            {/* Section label — hidden when collapsed */}
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 select-none">
                {section.label}
              </p>
            )}
            {collapsed && si > 0 && (
              <div className="mx-auto w-6 border-t border-zinc-800/70 mb-2 mt-1" />
            )}
            <div className="space-y-0.5">
              {section.items.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    className={clsx(
                      'flex items-center rounded-lg text-sm font-medium transition-colors',
                      collapsed ? 'justify-center py-2.5 px-0' : 'gap-3 px-3 py-2',
                      active
                        ? 'bg-violet-600/20 text-violet-300'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User footer ───────────────────────────────────────── */}
      <div className={clsx(
        'shrink-0 border-t border-zinc-800 transition-all duration-300',
        collapsed ? 'p-2' : 'p-3',
      )}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              title={user?.email ?? 'Admin'}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white cursor-default"
            >
              {user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              {user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user?.email ?? 'Admin'}</p>
              <p className="text-xs text-zinc-500">Administrator</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
