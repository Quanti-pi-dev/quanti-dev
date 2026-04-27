// ─── ToastContext (Compatibility Shim) ───────────────────────
// Thin adapter so existing useToast() callers continue to work
// after migrating to GlobalUIContext + GlassToast.
// All toasts are now routed through GlobalUIProvider's showToast().
//
// MIGRATION NOTE: Prefer useGlobalUI() for new code.
// This shim can be removed once all useToast() call sites are updated.

import React from 'react';
import { useGlobalUI } from './GlobalUIContext';
import type { ToastType } from './GlobalUIContext';

export { ToastType };

/** @deprecated Use useGlobalUI().showToast instead */
export function useToast() {
  const { showToast } = useGlobalUI();
  return { showToast };
}

/** @deprecated No-op — ToastProvider is replaced by GlobalUIProvider in _layout.tsx */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
