// ─── Subject Mastery Utilities ──────────────────────────────
// Single source of truth for computing mastery percentage and
// deriving level labels. Uses the Educator Brain's mastery
// nomenclature: Emerging → Developing → Proficient → Master.

import { SUBJECT_LEVELS, LEVEL_UNLOCK_THRESHOLD } from '@kd/shared';

/**
 * Maximum total correct answers for full mastery (100%).
 * 4 levels × 30 correct answers per level = 120.
 */
export const MAX_MASTERY_ANSWERS = SUBJECT_LEVELS.length * LEVEL_UNLOCK_THRESHOLD;

/**
 * Compute mastery percentage (0–1) from total correct answers
 * across all levels for a subject.
 *
 * This is the single canonical formula used everywhere:
 *   mastery = correctAnswers / (4 levels × 30 threshold)
 *
 * Examples:
 *   - 0 correct  → 0%
 *   - 15 correct → 12%  (halfway through Emerging)
 *   - 30 correct → 25%  (completed Emerging, unlocked Developing)
 *   - 60 correct → 50%  (completed Developing)
 *   - 120 correct → 100% (completed Master)
 */
export function computeSubjectMastery(correctAnswers: number): number {
  if (correctAnswers <= 0) return 0;
  return Math.min(correctAnswers / MAX_MASTERY_ANSWERS, 1);
}

/**
 * Get the display label for a subject level index (0–3).
 * Uses the canonical SUBJECT_LEVELS from @kd/shared:
 *   0=Emerging, 1=Developing, 2=Proficient, 3=Master
 */
export function getLevelLabel(levelIndex: number): string {
  return SUBJECT_LEVELS[levelIndex] ?? 'Emerging';
}

/**
 * Educator Brain mastery classification based on progress percentage.
 * Matches the BKT mastery levels from the backend.
 */
export function getEducatorMasteryLevel(pct: number): {
  level: 'emerging' | 'developing' | 'proficient' | 'master';
  label: string;
  color: string;
  emoji: string;
  sublabel: string;
} {
  if (pct >= 85) return {
    level: 'master',
    label: 'Master',
    color: '#6366F1',
    emoji: '👑',
    sublabel: 'You truly own this subject',
  };
  if (pct >= 50) return {
    level: 'proficient',
    label: 'Proficient',
    color: '#10B981',
    emoji: '💪',
    sublabel: 'Strong foundation — keep pushing',
  };
  if (pct >= 15) return {
    level: 'developing',
    label: 'Developing',
    color: '#F59E0B',
    emoji: '📈',
    sublabel: 'Building real understanding',
  };
  return {
    level: 'emerging',
    label: 'Emerging',
    color: '#F97316',
    emoji: '🌱',
    sublabel: 'Your journey is beginning',
  };
}

/**
 * Get mastery display info from total correct answers.
 * Returns label, badge string, educator mastery level, and the 0–1 progress value.
 *
 * Used for display on subject cards where we need a human-readable
 * label + badge chip alongside the progress ring.
 */
export function getMasteryDisplayInfo(correctAnswers: number, levelIndex: number) {
  const progress = computeSubjectMastery(correctAnswers);
  const pct = Math.round(progress * 100);
  const educator = getEducatorMasteryLevel(pct);

  if (correctAnswers === 0) {
    return {
      label: 'Not started',
      badge: '—',
      progress,
      pct,
      educator: getEducatorMasteryLevel(0),
    };
  }

  const levelLabel = getLevelLabel(levelIndex);
  // Badge shows the educator mastery level instead of a generic "L1"
  const badge = educator.label;

  return { label: levelLabel, badge, progress, pct, educator };
}
