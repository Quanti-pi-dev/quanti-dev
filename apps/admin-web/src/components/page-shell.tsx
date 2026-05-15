'use client';

// ─── Shared Page Shell ────────────────────────────────────────
// Wraps every authenticated page with Sidebar + top header.

import { Sidebar } from './sidebar';
import { ReactNode } from 'react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────

type BadgeVariant = 'green' | 'yellow' | 'red' | 'violet' | 'zinc';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  green:  'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
  yellow: 'bg-yellow-950/60  text-yellow-400  border-yellow-800/60',
  red:    'bg-red-950/60     text-red-400     border-red-800/60',
  violet: 'bg-violet-950/60  text-violet-400  border-violet-800/60',
  zinc:   'bg-zinc-800       text-zinc-400    border-zinc-700',
};

export function Badge({ label, variant = 'zinc' }: { label: string; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${BADGE_STYLES[variant]}`}>
      {label}
    </span>
  );
}

// ─── Spinner ─────────────────────────────────────────────────

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">
      {message}
    </div>
  );
}
