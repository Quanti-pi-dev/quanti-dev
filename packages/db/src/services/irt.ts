// ─── 1-Parameter IRT (Rasch Model) ───────────────────────────
// Estimates card difficulty from empirical response data, and
// student ability from their response history.
//
// The Rasch model defines:
//   P(correct) = 1 / (1 + e^(β - θ))
//
// Where:
//   θ = student ability (higher = stronger student)
//   β = item difficulty (higher = harder card)
//
// When θ = β, the student has a 50% chance of getting it right.
// This is the "zone of proximal development" — the ideal difficulty.
//
// Reference: Rasch (1960) — "Probabilistic Models for Some
// Intelligence and Attainment Tests"
//
// No GPU, no training — logit transforms on running averages.

import type { CardDifficulty, StudentAbility } from '@kd/shared';

// ─── Core IRT Functions ──────────────────────────────────────

/**
 * Probability of correct response given student ability and card difficulty.
 *
 * P(correct) = 1 / (1 + e^(β - θ))
 *
 * @param theta  Student ability parameter
 * @param beta   Card difficulty parameter
 * @returns      Probability of correct response (0–1)
 */
export function pCorrect(theta: number, beta: number): number {
  return 1 / (1 + Math.exp(beta - theta));
}

/**
 * Estimate card difficulty from empirical correct rate.
 *
 * β = -ln(p / (1 - p))  [inverse logit]
 *
 * Where p = observed correct rate across all students.
 * Clamped to [-3, +3] for stability.
 *
 * @param correctRate  Proportion of correct responses (0–1)
 * @returns            Difficulty parameter β
 */
export function estimateDifficulty(correctRate: number): number {
  // Clamp to avoid log(0) or log(infinity)
  const p = Math.max(0.01, Math.min(0.99, correctRate));

  // Inverse logit: if everyone gets it right (p→1), β → -∞ (easy)
  // If everyone gets it wrong (p→0), β → +∞ (hard)
  const beta = -Math.log(p / (1 - p));

  return Math.max(-3, Math.min(3, Math.round(beta * 100) / 100));
}

/**
 * Estimate student ability from their overall correct rate.
 *
 * θ = ln(p / (1 - p))  [logit transform]
 *
 * @param correctRate  Student's overall proportion correct (0–1)
 * @returns            Ability parameter θ
 */
export function estimateAbility(correctRate: number): number {
  const p = Math.max(0.01, Math.min(0.99, correctRate));
  const theta = Math.log(p / (1 - p));
  return Math.max(-3, Math.min(3, Math.round(theta * 100) / 100));
}

// ─── Difficulty Match Score ──────────────────────────────────

/**
 * Score how well a card's difficulty matches a student's ability.
 *
 * The "zone of proximal development" (ZPD) is where θ ≈ β, giving
 * a ~50% chance of correct response. Cards too easy (P > 0.9) or
 * too hard (P < 0.1) waste the student's time.
 *
 * The scoring function peaks when |θ - β| is small, and decays
 * as the gap grows:
 *
 *   score = exp(-0.5 × (θ - β)²)
 *
 * This is a Gaussian kernel centered at θ = β.
 *
 * @returns Score 0–1 (1 = perfect difficulty match)
 */
export function difficultyMatchScore(theta: number, beta: number): number {
  const gap = theta - beta;
  // Gaussian kernel: peaks at 0, decays with gap²
  return Math.exp(-0.5 * gap * gap);
}

/**
 * For students who are struggling, slightly favor easier cards.
 * For students who are excelling, slightly favor harder cards.
 *
 * This introduces a gentle "push" towards growth while avoiding
 * frustration for weaker students.
 *
 * @param theta Student ability
 * @param beta  Card difficulty
 * @param pushFactor  How much to push towards challenge (0–1, default 0.3)
 * @returns Adjusted difficulty match score 0–1
 */
export function adaptiveDifficultyScore(
  theta: number,
  beta: number,
  pushFactor: number = 0.3,
): number {
  // Base match score
  const baseScore = difficultyMatchScore(theta, beta);

  // Slight preference for cards just above student level
  // (β slightly > θ = learning zone)
  const idealBeta = theta + pushFactor;
  const pushScore = difficultyMatchScore(idealBeta, beta);

  // Blend: 60% match, 40% push-towards-challenge
  return 0.6 * baseScore + 0.4 * pushScore;
}

// ─── Card Difficulty Builder ─────────────────────────────────

/**
 * Build a CardDifficulty object from running statistics.
 */
export function buildCardDifficulty(
  cardId: string,
  totalResponses: number,
  correctCount: number,
): CardDifficulty {
  const correctRate = totalResponses > 0 ? correctCount / totalResponses : 0.5;
  const difficulty = estimateDifficulty(correctRate);

  let confidence: CardDifficulty['confidence'] = 'low';
  if (totalResponses >= 30) confidence = 'high';
  else if (totalResponses >= 10) confidence = 'medium';

  return {
    cardId,
    difficulty,
    totalResponses,
    correctRate: Math.round(correctRate * 1000) / 1000,
    confidence,
  };
}

/**
 * Build a StudentAbility estimate from running statistics.
 */
export function buildStudentAbility(
  totalResponses: number,
  correctCount: number,
): StudentAbility {
  const correctRate = totalResponses > 0 ? correctCount / totalResponses : 0.5;
  return {
    theta: estimateAbility(correctRate),
    totalResponses,
  };
}

// ─── Incremental IRT Update ──────────────────────────────────

/**
 * Update card difficulty incrementally from a single new response.
 * Uses an exponentially weighted running average to adapt to new data
 * without needing to recompute from the full history.
 *
 * @param currentRate  Current running correct rate
 * @param correct      New response
 * @param n            Total responses so far (before this one)
 * @returns            Updated correct rate
 */
export function updateCorrectRate(
  currentRate: number,
  correct: boolean,
  n: number,
): number {
  // For small N, use exact running mean
  // For large N, use EWA with a minimum weight of 1/100
  const weight = Math.max(1 / (n + 1), 0.01);
  const obs = correct ? 1 : 0;
  return currentRate + weight * (obs - currentRate);
}
