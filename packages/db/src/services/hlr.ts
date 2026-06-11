// ─── Half-Life Regression (HLR) ──────────────────────────────
// Personalised forgetting curve model that replaces the fixed SM-2
// ease-factor formula with a learned review interval derived from
// each student's actual correct/wrong history and response speed.
//
// Model:
//   p_recall(t) = 2^(-Δt / h)         (exponential decay)
//   log₂(h)    = θ0 + θ1·x_correct   (log-linear regression)
//               + θ2·x_wrong
//               + θ3·x_speed
//
// Where:
//   x_correct = log₂(1 + n_correct)   — compressed correct count
//   x_wrong   = log₂(1 + n_wrong)     — compressed error count
//   x_speed   = 0–2 (fast=2, moderate=1, slow/wrong=0)
//
// Default θ weights from Duolingo’s published HLR paper:
// "A Trainable Spaced Repetition Model for Language Learning" (2016).
// These can be replaced by per-user fitted weights.
//
// Reference: https://github.com/duolingo/halflife-regression

import { responseToQuality } from './sm2.js';


// ─── θ weights (Duolingo defaults) ───────────────────────────

export interface HLRWeights {
  /** Bias / intercept (controls minimum half-life in days) */
  theta0: number;
  /** Correct-count coefficient */
  theta1: number;
  /** Wrong-count coefficient */
  theta2: number;
  /** Speed quality coefficient */
  theta3: number;
}

/**
 * Default θ from Duolingo's published HLR evaluation.
 * Produces half-lives in [1, 120] days depending on history.
 */
export const DEFAULT_HLR_WEIGHTS: HLRWeights = {
  theta0: 2.0,   // base half-life ≈ 2^2.0 = 4 days
  theta1: 1.2,   // each doubling of correct answers adds ~1.2 doublings to h
  theta2: -0.8,  // each doubling of wrong answers subtracts ~0.8 from log₂(h)
  theta3: 0.3,   // answering quickly adds ~0.3 doublings to half-life
};

// ─── Core function ────────────────────────────────────────────

export interface HLRInput {
  /** Total correct answers for this card (before this review). */
  nCorrect: number;
  /** Total wrong answers for this card (before this review). */
  nWrong: number;
  /** Current answer correct? */
  correct: boolean;
  /** Response time in ms (used to derive speed quality). */
  responseTimeMs: number;
  /** Inject custom weights (e.g. from a trained model). Defaults to Duolingo weights. */
  weights?: HLRWeights;
}

export interface HLRResult {
  /** Next review interval in days. */
  intervalDays: number;
  /** Predicted recall probability at the next review time. */
  predictedRecall: number;
  /** Computed half-life in days (for diagnostics / logging). */
  halfLifeDays: number;
  /** ISO string for next review date. */
  nextReviewAt: string;
}

/**
 * Computes the next review interval using Half-Life Regression.
 *
 * Replaces the SM-2 intervalDays * easeFactor step. The ease factor
 * is no longer needed — the interval is derived directly from the
 * student's per-card response history.
 */
export function hlr(input: HLRInput): HLRResult {
  const w = input.weights ?? DEFAULT_HLR_WEIGHTS;

  // Update counts with current answer
  const nCorrect = input.nCorrect + (input.correct ? 1 : 0);
  const nWrong   = input.nWrong   + (input.correct ? 0 : 1);

  // Compressed features (log scale prevents outlier dominance)
  const xCorrect = Math.log2(1 + nCorrect);
  const xWrong   = Math.log2(1 + nWrong);

  // Speed quality bucket: fast=2, moderate=1, slow/incorrect=0
  const qualityMap: Record<string, number> = { fast: 2, moderate: 1, slow: 0, incorrect: 0 };
  const xSpeed = qualityMap[responseToQuality(input.correct, input.responseTimeMs)] ?? 0;

  // Log₂(half-life) from the linear model
  const log2h = w.theta0 + w.theta1 * xCorrect + w.theta2 * xWrong + w.theta3 * xSpeed;

  // Half-life in days — clamp to [1, 180] to prevent runaway intervals
  const halfLifeDays = Math.min(180, Math.max(1, Math.pow(2, log2h)));

  // Target: schedule next review when predicted recall = 90%
  // p = 2^(-t/h) → t = -h * log₂(0.9) ≈ h * 0.152
  const TARGET_RECALL = 0.9;
  const intervalDays = Math.max(1, Math.round(halfLifeDays * Math.log2(1 / TARGET_RECALL)));

  // Predicted recall at the scheduled interval (should be ≈ TARGET_RECALL)
  const predictedRecall = Math.pow(2, -intervalDays / halfLifeDays);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  return {
    intervalDays,
    predictedRecall: Math.round(predictedRecall * 100) / 100,
    halfLifeDays:    Math.round(halfLifeDays * 10) / 10,
    nextReviewAt:    nextReview.toISOString(),
  };
}

// ─── Retention estimation (HLR-based) ────────────────────────

/**
 * Estimate current recall probability using the HLR decay model.
 * Drop-in replacement for the Ebbinghaus-based estimateRetention in sm2.ts.
 *
 * @param daysSinceLastReview - Days since the card was last reviewed
 * @param halfLifeDays        - The card's stored half-life (from last HLR computation)
 * @returns Recall probability 0–100
 */
export function estimateHLRRetention(
  daysSinceLastReview: number,
  halfLifeDays: number,
): number {
  if (daysSinceLastReview <= 0) return 100;
  if (halfLifeDays <= 0) return 0;

  const recall = Math.pow(2, -daysSinceLastReview / halfLifeDays) * 100;
  return Math.round(Math.max(0, Math.min(100, recall)));
}
