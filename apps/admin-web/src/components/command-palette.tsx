'use client';

// ─── Command Palette (Cmd+K / Ctrl+K) ────────────────────────
// Global search / navigation overlay. Triggered by keyboard shortcut
// or a search button in the header. Renders a fuzzy-searchable list
// of all admin pages + recent user search.
//
// Usage:
//   1. Wrap app in <CommandPaletteProvider>
//   2. Optionally render <CommandPaletteTrigger /> anywhere to open it
//   3. Keyboard shortcut Cmd+K / Ctrl+K opens it automatically

import {
  createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import {
  LayoutDashboard, Users, BookOpen, Trophy, CreditCard, Settings,
  Layers, Bell, BarChart3, Building2, Tag, ReceiptText,
  Banknote, Coins, Medal, FileQuestion, ClipboardList, Swords, Search,
  ArrowRight, User,
} from 'lucide-react';

// ─── Nav items catalogue ─────────────────────────────────────

interface NavItem {
  type: 'nav';
  label: string;
  href: string;
  icon: React.ElementType;
  keywords: string[];
}

interface UserItem {
  type: 'user';
  label: string;
  sub: string;
  href: string;
}

type PaletteItem = NavItem | UserItem;

const NAV_ITEMS: NavItem[] = [
  { type: 'nav', label: 'Dashboard',     href: '/',              icon: LayoutDashboard, keywords: ['home', 'overview', 'kpi'] },
  { type: 'nav', label: 'Exams',         href: '/exams',         icon: BookOpen,        keywords: ['exam', 'test', 'content'] },
  { type: 'nav', label: 'Decks',         href: '/decks',         icon: Layers,          keywords: ['deck', 'flashcard', 'cards', 'shop'] },
  { type: 'nav', label: 'PYQ',           href: '/pyq',           icon: FileQuestion,    keywords: ['previous year', 'question'] },
  { type: 'nav', label: 'Mock Tests',    href: '/mock-tests',    icon: ClipboardList,   keywords: ['mock', 'practice', 'test'] },
  { type: 'nav', label: 'Users',         href: '/users',         icon: Users,           keywords: ['user', 'student', 'member'] },
  { type: 'nav', label: 'Institutes',    href: '/institutes',    icon: Building2,       keywords: ['institute', 'school', 'coaching'] },
  { type: 'nav', label: 'Subscriptions', href: '/subscriptions', icon: CreditCard,      keywords: ['sub', 'plan', 'payment', 'billing'] },
  { type: 'nav', label: 'Plans',         href: '/plans',         icon: Banknote,        keywords: ['plan', 'tier', 'pricing'] },
  { type: 'nav', label: 'Coupons',       href: '/coupons',       icon: Tag,             keywords: ['coupon', 'discount', 'promo', 'code'] },
  { type: 'nav', label: 'Payments',      href: '/payments',      icon: ReceiptText,     keywords: ['payment', 'refund', 'transaction'] },
  { type: 'nav', label: 'Coin Packs',    href: '/coin-packs',    icon: Coins,           keywords: ['coin', 'currency', 'pack'] },
  { type: 'nav', label: 'Gamification',  href: '/gamification',  icon: Medal,           keywords: ['badge', 'streak', 'reward', 'achievement'] },
  { type: 'nav', label: 'Tournaments',   href: '/tournaments',   icon: Trophy,          keywords: ['tournament', 'competition', 'leaderboard'] },
  { type: 'nav', label: 'Challenges',    href: '/challenges',    icon: Swords,          keywords: ['challenge', 'daily', 'duel'] },
  { type: 'nav', label: 'Notifications', href: '/notifications', icon: Bell,            keywords: ['push', 'notification', 'broadcast', 'fcm'] },
  { type: 'nav', label: 'Analytics',     href: '/analytics',     icon: BarChart3,       keywords: ['analytics', 'revenue', 'metrics', 'report'] },
  { type: 'nav', label: 'Config',        href: '/config',        icon: Settings,        keywords: ['config', 'settings', 'system'] },
];

// ─── Context ──────────────────────────────────────────────────

interface CPCtx { open: () => void; close: () => void; isOpen: boolean }

const CPContext = createContext<CPCtx>({ open: () => {}, close: () => {}, isOpen: false });
export const useCommandPalette = () => useContext(CPContext);

// ─── Provider ─────────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <CPContext.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && <CommandPaletteModal onClose={close} />}
    </CPContext.Provider>
  );
}

// ─── Trigger button (for header) ─────────────────────────────

export function CommandPaletteTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      onClick={open}
      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
      title="Open command palette (Cmd+K)"
    >
      <Search size={13} />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] bg-zinc-700 text-zinc-400 rounded px-1.5 py-0.5 font-mono">
        ⌘K
      </kbd>
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────

function CommandPaletteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [userResults, setUsers] = useState<UserItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLUListElement>(null);

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fuzzy-filter nav items
  const navResults: PaletteItem[] = query.trim()
    ? NAV_ITEMS.filter(n => {
        const q = query.toLowerCase();
        return n.label.toLowerCase().includes(q) || n.keywords.some(k => k.includes(q));
      }).map(n => n)
    : NAV_ITEMS.map(n => n);

  const allItems: PaletteItem[] = [...navResults, ...userResults];

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // User search debounce
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setUsers([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await adminApi.get<{ data: { id: string; email: string; displayName: string }[] }>(
          '/api/admin/users/search',
          { params: { q: query, limit: 5 } },
        );
        setUsers(res.data.data.map(u => ({
          type: 'user' as const,
          label: u.displayName ?? u.email,
          sub: u.email,
          href: `/users/${u.id}`,
        })));
      } catch { /* silent */ }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const navigate = useCallback((item: PaletteItem) => {
    router.push(item.href);
    onClose();
  }, [router, onClose]);

  // Keyboard navigation
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && allItems[activeIdx]) { navigate(allItems[activeIdx]); }
    if (e.key === 'Escape') onClose();
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const hasNavSection  = navResults.length > 0;
  const hasUserSection = userResults.length > 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search pages or find user…"
            className="flex-1 bg-transparent text-white placeholder:text-zinc-500 text-sm focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">Clear</button>
          )}
          <kbd className="shrink-0 text-[10px] bg-zinc-800 text-zinc-500 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <ul
          ref={listRef}
          className="max-h-[360px] overflow-y-auto py-2"
        >
          {allItems.length === 0 && (
            <li className="px-4 py-8 text-center text-zinc-600 text-sm">No results</li>
          )}

          {hasNavSection && (
            <>
              {query.trim() === '' && (
                <li className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 select-none">
                  Pages
                </li>
              )}
              {navResults.map((item, i) => {
                const Icon = (item as NavItem).icon;
                return (
                  <li key={item.href}>
                    <button
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === activeIdx ? 'bg-violet-600/20 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        i === activeIdx ? 'bg-violet-600/30' : 'bg-zinc-800'
                      }`}>
                        <Icon size={14} className={i === activeIdx ? 'text-violet-400' : 'text-zinc-500'} />
                      </div>
                      <span className="text-sm">{item.label}</span>
                      {i === activeIdx && <ArrowRight size={12} className="ml-auto text-violet-400 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </>
          )}

          {hasUserSection && (
            <>
              <li className="px-4 py-1.5 mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 select-none border-t border-zinc-800/60">
                Users
              </li>
              {userResults.map((item, ri) => {
                const i = navResults.length + ri;
                return (
                  <li key={item.href}>
                    <button
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === activeIdx ? 'bg-violet-600/20 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        i === activeIdx ? 'bg-violet-600/30' : 'bg-zinc-800'
                      }`}>
                        <User size={13} className={i === activeIdx ? 'text-violet-400' : 'text-zinc-500'} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{item.label}</p>
                        {item.sub !== item.label && (
                          <p className="text-xs text-zinc-500 truncate">{item.sub}</p>
                        )}
                      </div>
                      {i === activeIdx && <ArrowRight size={12} className="ml-auto text-violet-400 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </>
          )}
        </ul>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-800 text-[11px] text-zinc-600">
          <span className="flex items-center gap-1"><kbd className="bg-zinc-800 rounded px-1 font-mono">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-zinc-800 rounded px-1 font-mono">↵</kbd> Open</span>
          <span className="flex items-center gap-1"><kbd className="bg-zinc-800 rounded px-1 font-mono">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
