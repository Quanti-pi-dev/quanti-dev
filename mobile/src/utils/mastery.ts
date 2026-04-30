// ─── Subject Mastery Utilities ──────────────────────────────
// Single source of truth for computing mastery percentage and
// deriving level labels. Used by SubjectProgressCard,
// TargetSubjectCard, Home screen, and Study screen.

import { SUBJECT_LEVELS, LEVEL_UNLOCK_THRESHOLD } from '@kd/shared';

/**
 * Maximum total correct answers for full mastery (100%).
 * 6 levels × 20 correct answers per level = 120.
 */
export const MAX_MASTERY_ANSWERS = SUBJECT_LEVELS.length * LEVEL_UNLOCK_THRESHOLD;

/**
 * Compute mastery percentage (0–1) from total correct answers
 * across all levels for a subject.
 *
 * This is the single canonical formula used everywhere:
 *   mastery = correctAnswers / (6 levels × 20 threshold)
 *
 * Examples:
 *   - 0 correct  → 0%
 *   - 10 correct → 8%   (halfway through Beginner)
 *   - 20 correct → 17%  (completed Beginner, unlocked Rookie)
 *   - 60 correct → 50%  (completed Competent)
 *   - 120 correct → 100% (completed Master)
 */
export function computeSubjectMastery(correctAnswers: number): number {
  if (correctAnswers <= 0) return 0;
  return Math.min(correctAnswers / MAX_MASTERY_ANSWERS, 1);
}

/**
 * Get the display label for a subject level index (0–5).
 * Uses the canonical SUBJECT_LEVELS from @kd/shared:
 *   0=Beginner, 1=Rookie, 2=Skilled, 3=Competent, 4=Expert, 5=Master
 */
export function getLevelLabel(levelIndex: number): string {
  return SUBJECT_LEVELS[levelIndex] ?? 'Beginner';
}

/**
 * Get mastery display info from total correct answers.
 * Returns label, badge string, and the 0–1 progress value.
 *
 * Used for display on subject cards where we need a human-readable
 * label + badge chip alongside the progress ring.
 */
export function getMasteryDisplayInfo(correctAnswers: number, levelIndex: number) {
  const progress = computeSubjectMastery(correctAnswers);
  const pct = Math.round(progress * 100);

  if (correctAnswers === 0) {
    return { label: 'Not started', badge: '—', progress, pct };
  }

  const levelLabel = getLevelLabel(levelIndex);
  const badge = `L${levelIndex + 1}`;

  return { label: levelLabel, badge, progress, pct };
}
