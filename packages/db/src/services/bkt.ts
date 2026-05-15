// ─── Bayesian Knowledge Tracing (BKT) ────────────────────────
// Estimates P(student has mastered concept) using a Hidden Markov
// Model with 4 parameters per concept.
//
// The BKT model treats student knowledge as a hidden binary state
// (known/unknown) and uses observed correct/incorrect responses as
// emissions to update the belief about mastery.
//
// Reference: Corbett & Anderson (1995) — "Knowledge Tracing:
// Modeling the Acquisition of Procedural Knowledge"
//
// No GPU, no training pipeline — pure Bayesian inference.

import type { BKTParams, ConceptMastery, MasteryLevel } from '@kd/shared';

// ─── Default BKT Parameters ─────────────────────────────────
// Calibrated for competitive exam prep (NEET/JEE context):
// - Students arrive with some prior exposure (textbook reading)
// - Multiple-choice with 4 options → P(G) = 0.25 baseline
// - Slips are relatively rare for well-prepared students

export const DEFAULT_BKT_PARAMS: BKTParams = {
  pInit: 0.1,     // 10% chance they already know it (conservative)
  pTransit: 0.15, // 15% chance of learning per attempt
  pGuess: 0.25,   // 4-option MCQ → 25% guess rate
  pSlip: 0.1,     // 10% chance of careless error despite knowing
};

// ─── Core BKT Update ────────────────────────────────────────

/**
 * Update P(mastery) given a single observed response.
 *
 * Step 1: Compute P(Lₙ | obs) using Bayes' theorem
 *   If correct: P(Lₙ|1) = P(Lₙ) × (1 - P(S)) / [P(Lₙ)(1-P(S)) + (1-P(Lₙ))P(G)]
 *   If wrong:   P(Lₙ|0) = P(Lₙ) × P(S) / [P(Lₙ)P(S) + (1-P(Lₙ))(1-P(G))]
 *
 * Step 2: Account for learning transition
 *   P(Lₙ₊₁) = P(Lₙ|obs) + (1 - P(Lₙ|obs)) × P(T)
 *
 * @param pMastery  Current P(mastery) — P(Lₙ)
 * @param correct   Whether the student answered correctly
 * @param params    BKT parameters for this concept
 * @returns         Updated P(mastery) — P(Lₙ₊₁)
 */
export function bktUpdate(
  pMastery: number,
  correct: boolean,
  params: BKTParams = DEFAULT_BKT_PARAMS,
): number {
  const { pTransit, pGuess, pSlip } = params;

  // ── Step 1: Posterior given observation ─────────────────────
  let pLnGivenObs: number;

  if (correct) {
    // P(correct | known) = 1 - P(S)
    // P(correct | unknown) = P(G)
    const pCorrectKnown = 1 - pSlip;
    const pCorrectUnknown = pGuess;
    const pCorrect = pMastery * pCorrectKnown + (1 - pMastery) * pCorrectUnknown;

    // Guard against division by zero
    pLnGivenObs = pCorrect > 0 ? (pMastery * pCorrectKnown) / pCorrect : pMastery;
  } else {
    // P(wrong | known) = P(S)
    // P(wrong | unknown) = 1 - P(G)
    const pWrongKnown = pSlip;
    const pWrongUnknown = 1 - pGuess;
    const pWrong = pMastery * pWrongKnown + (1 - pMastery) * pWrongUnknown;

    pLnGivenObs = pWrong > 0 ? (pMastery * pWrongKnown) / pWrong : pMastery;
  }

  // ── Step 2: Learning transition ────────────────────────────
  // Even if the student didn't know it before, they might have learned
  // from the attempt (seeing the explanation, etc.)
  const pMasteryNext = pLnGivenObs + (1 - pLnGivenObs) * pTransit;

  // Clamp to [0.001, 0.999] to prevent degenerate states
  return Math.max(0.001, Math.min(0.999, pMasteryNext));
}

// ─── Batch Update (Multiple Concepts per Card) ───────────────

/**
 * A single flashcard may test multiple concepts (via its `tags`).
 * This function updates mastery for all concepts a card touches.
 *
 * @param masteryMap  Map of conceptTag → current P(mastery)
 * @param cardTags    Tags on the answered card (= concepts tested)
 * @param correct     Whether the student answered correctly
 * @param params      BKT parameters (can be per-concept in the future)
 * @returns           Map of conceptTag → updated P(mastery)
 */
export function bktBatchUpdate(
  masteryMap: Map<string, number>,
  cardTags: string[],
  correct: boolean,
  params: BKTParams = DEFAULT_BKT_PARAMS,
): Map<string, number> {
  const updated = new Map(masteryMap);

  for (const tag of cardTags) {
    const current = updated.get(tag) ?? params.pInit;
    const next = bktUpdate(current, correct, params);
    updated.set(tag, next);
  }

  return updated;
}

// ─── Information Gain ────────────────────────────────────────

/**
 * Calculate the expected information gain from testing a concept.
 *
 * Concepts with P(mastery) near 0.5 provide maximum information —
 * we're most uncertain about whether the student knows them.
 * Concepts near 0 or 1 provide little new information.
 *
 * Uses Shannon entropy: H = -p log₂(p) - (1-p) log₂(1-p)
 *
 * @returns Information gain score 0–1 (1 = maximum uncertainty)
 */
export function informationGain(pMastery: number): number {
  if (pMastery <= 0.001 || pMastery >= 0.999) return 0;

  const h = -(pMastery * Math.log2(pMastery)) -
            ((1 - pMastery) * Math.log2(1 - pMastery));

  // Max entropy is 1.0 (at p=0.5), so h is already normalized 0–1
  return h;
}

/**
 * Classify mastery level from probability for display.
 *
 * Every label celebrates where the student IS, not where they aren't:
 *   - Emerging      (< 0.2)  — "Your journey with this concept is just beginning"
 *   - Developing    (0.2–0.6) — "You're building real understanding here"
 *   - Proficient    (0.6–0.85) — "You've got a solid grasp of this"
 *   - Distinguished (≥ 0.85) — "Outstanding — you truly own this concept"
 */
export function classifyMastery(pMastery: number): MasteryLevel {
  if (pMastery >= 0.85) return 'master';
  if (pMastery >= 0.6)  return 'proficient';
  if (pMastery >= 0.2)  return 'developing';
  return 'emerging';
}

// ─── Concept Mastery State Builder ───────────────────────────

/**
 * Build a ConceptMastery object from raw data.
 */
export function buildConceptMastery(
  conceptTag: string,
  pMastery: number,
  totalAttempts: number,
  correctAttempts: number,
): ConceptMastery {
  return {
    conceptTag,
    pMastery: Math.round(pMastery * 1000) / 1000,
    totalAttempts,
    correctAttempts,
    lastUpdatedAt: new Date().toISOString(),
  };
}
