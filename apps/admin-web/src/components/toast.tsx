'use client';

// ─── Toast / Notification System ──────────────────────────────
// Lightweight global toast notifications without a dependency.
// Usage:
//   const { toast } = useToast();
//   toast.success('Plan created');
//   toast.error('Failed to delete');
//   toast.info('Syncing…');

import {
  createContext, useContext, useCallback, useState, useEffect, useRef,
  type ReactNode,
} from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

interface ToastContext {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
  };
}

// ─── Context ──────────────────────────────────────────────────

const Ctx = createContext<ToastContext | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Individual Toast ─────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: string; bg: string }> = {
  success: { border: 'border-emerald-700/60', icon: 'text-emerald-400', bg: 'bg-emerald-950/80' },
  error:   { border: 'border-red-700/60',     icon: 'text-red-400',     bg: 'bg-red-950/80'     },
  warning: { border: 'border-yellow-700/60',  icon: 'text-yellow-400',  bg: 'bg-yellow-950/80'  },
  info:    { border: 'border-zinc-600/60',    icon: 'text-zinc-400',    bg: 'bg-zinc-800/90'    },
};

const ICONS: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const s = VARIANT_STYLES[item.variant];
  const Icon = ICONS[item.variant];

  return (
    <div
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-sm',
        'w-[340px] max-w-[calc(100vw-2rem)]',
        'transition-all duration-300 ease-out',
        s.bg, s.border,
        item.exiting
          ? 'opacity-0 translate-x-8 scale-95'
          : 'opacity-100 translate-x-0 scale-100',
      )}
    >
      <Icon size={15} className={clsx('shrink-0 mt-0.5', s.icon)} />
      <p className="flex-1 text-sm text-white leading-snug">{item.message}</p>
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 text-zinc-600 hover:text-zinc-300 transition -mt-0.5"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────

const DURATION = 3500;
const EXIT_DURATION = 300;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Mark as exiting first (CSS transition)
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, exiting: true } : t)),
    );
    // Remove after exit animation
    const t = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, EXIT_DURATION);
    timers.current.set(id + '_exit', t);
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = Math.random().toString(36).slice(2);
      setToasts(prev => [...prev, { id, message, variant }]);
      const t = setTimeout(() => dismiss(id), DURATION);
      timers.current.set(id, t);
    },
    [dismiss],
  );

  // Cleanup on unmount
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach(clearTimeout); };
  }, []);

  const toast = {
    success: (msg: string) => push(msg, 'success'),
    error:   (msg: string) => push(msg, 'error'),
    info:    (msg: string) => push(msg, 'info'),
    warning: (msg: string) => push(msg, 'warning'),
  };

  return (
    <Ctx.Provider value={{ toast }}>
      {children}

      {/* Toast portal — fixed bottom-right */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(item => (
          <div key={item.id} className="pointer-events-auto">
            <Toast item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
