// ─── Shared Constants ────────────────────────────────────────
// Common constants used across multiple screens.
// FIX TD1: Extracted from duplicated definitions in subjects.tsx, levels.tsx, tournaments.tsx


// ─── Level System ────────────────────────────────────────────

/** Colour palette for subject levels, indexed 0–3 (Emerging → Master). */
export const LEVEL_COLOURS = [
  '#F97316', // 0 — Emerging (orange)
  '#F59E0B', // 1 — Developing (amber)
  '#10B981', // 2 — Proficient (green)
  '#6366F1', // 3 — Master (indigo)
];

/** Human-readable labels for subscription tier gates. */
export const TIER_LABELS: Record<number, string> = {
  0: 'Free',
  1: 'Basic',
  2: 'Pro',
  3: 'Master',
};

// ─── Date Formatting ─────────────────────────────────────────

/** Format an ISO date string to a short human-readable date. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format an ISO date string to include time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
