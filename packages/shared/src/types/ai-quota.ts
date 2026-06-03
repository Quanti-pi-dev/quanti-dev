// ─── AI Quota Types ──────────────────────────────────────────
// Shared types for per-user daily AI request quota tracking.

export interface AIQuotaStatus {
  /** Requests used so far today. */
  used: number;
  /** Daily cap from the user's plan. -1 = unlimited. */
  limit: number;
  /** ISO timestamp of next midnight UTC — when the counter resets. */
  resetAt: string;
  /** True when used >= limit and limit is not -1. */
  isExhausted: boolean;
}
