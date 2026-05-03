// ─── Knowledge Model Types ───────────────────────────────────
// Types for Bayesian Knowledge Tracing (BKT), Item Response Theory
// (IRT), and the Knowledge Graph that together form the educator brain.

// ─── BKT: Bayesian Knowledge Tracing ─────────────────────────

/**
 * BKT parameters for a single concept (tag).
 * These are priors — calibrated from domain knowledge, then updated
 * per-student as responses come in.
 */
export interface BKTParams {
  /** P(L₀) — prior probability the student already knows the concept. */
  pInit: number;
  /** P(T) — probability of learning the concept on any given attempt. */
  pTransit: number;
  /** P(G) — probability of guessing correctly without knowing. */
  pGuess: number;
  /** P(S) — probability of slipping (wrong despite knowing). */
  pSlip: number;
}

/** Per-student mastery state for a single concept. */
export interface ConceptMastery {
  conceptTag: string;
  /** P(Lₙ) — current posterior probability the student has mastered this concept. */
  pMastery: number;
  /** Total practice attempts on this concept. */
  totalAttempts: number;
  /** Total correct responses. */
  correctAttempts: number;
  /** ISO timestamp of last practice. */
  lastUpdatedAt: string;
}

/** Mastery classification — encouraging labels that celebrate every stage. */
export type MasteryLevel = 'emerging' | 'developing' | 'proficient' | 'master';

// ─── IRT: Item Response Theory ───────────────────────────────

/** IRT parameters for a single flashcard. */
export interface CardDifficulty {
  cardId: string;
  /** IRT difficulty parameter β — higher = harder. Range roughly -3 to +3. */
  difficulty: number;
  /** Total student responses used to estimate difficulty. */
  totalResponses: number;
  /** Running correct rate across all students. */
  correctRate: number;
  /** Confidence: how stable is this estimate? Based on N. */
  confidence: 'low' | 'medium' | 'high';
}

/** IRT student ability estimate. */
export interface StudentAbility {
  /** Ability parameter θ — higher = stronger student. Range roughly -3 to +3. */
  theta: number;
  /** Number of responses used to estimate ability. */
  totalResponses: number;
}

// ─── Knowledge Graph ─────────────────────────────────────────

/** A single concept node in the knowledge graph. */
export interface ConceptNode {
  /** Concept tag — matches flashcard `tags[]`. */
  tag: string;
  /** Human-readable name. */
  displayName: string;
  /** Tags of prerequisite concepts that should be mastered first. */
  prerequisites: string[];
}

/** Knowledge graph for a single topic (e.g., "atomic-structure"). */
export interface TopicKnowledgeGraph {
  topicSlug: string;
  concepts: ConceptNode[];
}

// ─── Card Selection Score ────────────────────────────────────

/** Breakdown of why a card was selected by the adaptive engine. */
export interface CardSelectionScore {
  cardId: string;
  /** Total weighted score — higher = serve first. */
  totalScore: number;
  /** SM-2 urgency component (overdue cards score higher). */
  urgencyScore: number;
  /** BKT information gain component (concepts near 0.5 mastery are most informative). */
  informationGainScore: number;
  /** IRT difficulty match component (cards in the zone of proximal development). */
  difficultyMatchScore: number;
  /** Knowledge graph prerequisite readiness component. */
  prerequisiteScore: number;
}

// ─── Misconception ───────────────────────────────────────────

/** Misconception mapping for a wrong answer option. */
export interface OptionMisconception {
  optionId: string;
  /** What the student likely misunderstood if they chose this option. */
  misconception: string;
  /** Concept tag this misconception relates to. */
  relatedConcept?: string;
}

// ─── Educator Feedback ───────────────────────────────────────

/** Targeted feedback generated for a specific wrong answer. */
export interface TargetedFeedback {
  /** The wrong option the student chose. */
  selectedOptionText: string;
  /** What misconception this choice reveals. */
  misconception: string;
  /** Targeted explanation addressing the specific error. */
  explanation: string;
  /** Memory trick to avoid this error. */
  memoryTrick?: string;
  /** Prerequisite concept to review. */
  reviewConcept?: string;
}

/** Session-level cognitive load assessment. */
export interface CognitiveLoadState {
  /** Rolling average response time (last 5 cards). */
  avgResponseTimeMs: number;
  /** Trend: is the student getting slower? */
  speedTrend: 'speeding_up' | 'stable' | 'slowing_down';
  /** Consecutive wrong answers. */
  errorStreak: number;
  /** Recommended action based on cognitive load. */
  recommendation: 'continue' | 'switch_to_review' | 'take_a_break';
}
