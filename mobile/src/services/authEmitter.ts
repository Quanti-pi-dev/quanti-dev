// ─── Auth Event Emitter ──────────────────────────────────────
// A minimal event bus that lets the Axios response interceptor
// signal the AuthContext to force-logout without creating a
// circular dependency (api → AuthContext → api).
//
// Pattern: api.ts emits 'FORCE_LOGOUT'; AuthContext listens and
// clears its state. No React context involved here — plain JS.

type AuthEvent = 'FORCE_LOGOUT' | 'AUTH_ERROR';
type Listener = (payload?: string) => void;

const listeners = new Map<AuthEvent, Set<Listener>>();

export const authEmitter = {
  on(event: AuthEvent, fn: Listener): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    // Returns an unsubscribe function
    return () => listeners.get(event)?.delete(fn);
  },

  emit(event: AuthEvent, payload?: string): void {
    listeners.get(event)?.forEach((fn) => fn(payload));
  },
};
