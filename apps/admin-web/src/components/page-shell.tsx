'use client';

// ─── Shared Page Shell ────────────────────────────────────────
// Wraps every authenticated page with Sidebar + top header.

import { Sidebar } from './sidebar';
import { ReactNode } from 'react';
import type { BreadcrumbItem } from './breadcrumb-types';
import { Breadcrumb } from './breadcrumb';
import { CommandPaletteTrigger } from './command-palette';

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
}

export function PageShell({ title, subtitle, actions, breadcrumbs, children }: PageShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        {/* Top bar */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 shrink-0 bg-zinc-900/50 backdrop-blur-sm">
          <div className="min-w-0">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="mb-0.5">
                <Breadcrumb items={breadcrumbs} />
              </div>
            )}
            <h1 className="text-lg font-semibold text-white truncate">{title}</h1>
            {subtitle && !breadcrumbs && (
              <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <CommandPaletteTrigger />
            {actions}
          </div>
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

// ─── Inline spinner (for use inside buttons) ──────────────────

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <div className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className ?? ''}`} />
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
