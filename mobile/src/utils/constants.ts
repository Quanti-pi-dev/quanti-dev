// ─── Shared Constants ────────────────────────────────────────
// Common constants used across multiple screens.
// FIX TD1: Extracted from duplicated definitions in subjects.tsx, levels.tsx, tournaments.tsx

import type { SubjectLevel } from '@kd/shared';

// ─── Level System ────────────────────────────────────────────

/** Colour palette for subject levels, indexed 0–5 (Beginner → Master). */
export const LEVEL_COLOURS = [
  '#22C55E', // 0 — Beginner (green)
  '#3B82F6', // 1 — Rookie (blue)
  '#A855F7', // 2 — Intermediate (purple)
  '#F59E0B', // 3 — Advanced (amber)
  '#EF4444', // 4 — Expert (red)
  '#E11D48', // 5 — Master (rose)
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
