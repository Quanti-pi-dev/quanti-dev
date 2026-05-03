// ─── SM-2 Spaced Repetition Algorithm ────────────────────────
// Pure implementation of the SuperMemo SM-2 algorithm.
// No side effects — accepts state + quality, returns next state.
//
// Quality ratings:
//   5 — perfect response (instant recall)
//   4 — correct after hesitation
//   3 — correct with serious difficulty
//   2 — incorrect but close / recognized answer
//   1 — incorrect, remembered upon seeing answer
//   0 — complete blackout
//
// Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

import type { SM2Quality, SM2Result } from '@kd/shared';

// ─── Constants ────────────────────────────────────────────────

/** Minimum ease factor — prevents interval from shrinking too fast. */
const MIN_EASE_FACTOR = 1.3;

/** Initial ease factor for new cards. */
export const INITIAL_EASE_FACTOR = 2.5;

/** Initial interval for first successful review (1 day). */
const FIRST_INTERVAL = 1;

/** Interval after second successful review (6 days). */
const SECOND_INTERVAL = 6;

// ─── Core Algorithm ──────────────────────────────────────────

export interface SM2Input {
  /** Number of consecutive correct responses (before this review). */
  repetitions: number;
  /** Current review interval in days. */
  intervalDays: number;
  /** Current ease factor. */
  easeFactor: number;
}

/**
 * Run one iteration of the SM-2 algorithm.
 *
 * @param input   Current card memory state
 * @param quality Quality of response (0–5)
 * @returns       Next memory state with computed interval and next review date
 */
export function sm2(input: SM2Input, quality: SM2Quality): SM2Result {
  let { repetitions, intervalDays, easeFactor } = input;

  // ── Update ease factor using the SM-2 formula ──────────────
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEaseFactor = Math.max(
    MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  if (quality >= 3) {
    // ── Correct response ─────────────────────────────────────
    if (repetitions === 0) {
      intervalDays = FIRST_INTERVAL;
    } else if (repetitions === 1) {
      intervalDays = SECOND_INTERVAL;
    } else {
      intervalDays = Math.round(intervalDays * newEaseFactor);
    }
    repetitions += 1;
  } else {
    // ── Incorrect response — reset ───────────────────────────
    repetitions = 0;
    intervalDays = FIRST_INTERVAL;
  }

  // Calculate next review date
  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + intervalDays);

  return {
    repetitions,
    intervalDays,
    easeFactor: Math.round(newEaseFactor * 100) / 100, // 2 decimal places
    nextReviewAt: nextReview.toISOString(),
  };
}

// ─── Helper: Map boolean correct → SM-2 quality ──────────────

/**
 * Maps a simple correct/incorrect + response time to an SM-2 quality rating.
 * This is the bridge between the app's binary feedback and SM-2's 6-point scale.
 *
 * Quality mapping:
 *   - Correct + fast (< 3s)   → 5 (perfect recall)
 *   - Correct + moderate      → 4 (correct with hesitation)
 *   - Correct + slow (> 8s)   → 3 (correct with difficulty)
 *   - Incorrect               → 1 (failed recall)
 */
export function responseToQuality(correct: boolean, responseTimeMs: number): SM2Quality {
  if (!correct) return 1;

  if (responseTimeMs < 3000) return 5;       // Fast + correct → perfect recall
  if (responseTimeMs < 8000) return 4;       // Moderate speed → hesitant recall
  return 3;                                   // Slow → difficult recall
}

// ─── Retention Estimation (Ebbinghaus) ───────────────────────

/**
 * Estimate current retention probability for a card based on
 * time elapsed since last review and the card's stability.
 *
 * Uses simplified Ebbinghaus forgetting curve:
 *   R(t) = e^(-t / S)
 *
 * Where:
 *   t = time since last review (in days)
 *   S = stability ≈ intervalDays * easeFactor (higher = slower forgetting)
 *
 * @returns Retention estimate 0–100
 */
export function estimateRetention(
  daysSinceLastReview: number,
  intervalDays: number,
  easeFactor: number,
): number {
  if (daysSinceLastReview <= 0) return 100;
  if (intervalDays <= 0) return 0;

  // Stability: cards with longer intervals and higher ease forget slower
  const stability = intervalDays * easeFactor;

  // Ebbinghaus formula
  const retention = Math.exp(-daysSinceLastReview / stability) * 100;

  return Math.round(Math.max(0, Math.min(100, retention)));
}
