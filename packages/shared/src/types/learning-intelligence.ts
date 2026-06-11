// ─── Learning Intelligence Types ─────────────────────────────
// Shared types for the HLR-based spaced repetition engine, memory tracking,
// knowledge gap forecasting, and study plan generation.

// ─── HLR Card Memory ──────────────────────────────────────────

/** Per-card memory state tracked by the HLR (Half-Life Regression) engine. */
export interface CardMemoryState {
  cardId: string;
  /** Current review interval in days (HLR-computed). */
  intervalDays: number;
  /** Forgetting half-life in days — how long until 50% recall probability. */
  halfLifeDays: number;
  /** Total correct answers for this card (used to compute HLR features). */
  nCorrect: number;
  /** Total incorrect answers for this card. */
  nWrong: number;
  /** ISO timestamp of the last review. */
  lastReviewedAt: string;
  /** ISO timestamp of the next optimal review (scheduled at 90% predicted recall). */
  nextReviewAt: string;
  /** Total number of times this card has been reviewed. */
  totalReviews: number;
}

/** Response speed quality bucket — used by HLR as the x_speed feature. */
export type ResponseQuality = 'fast' | 'moderate' | 'slow' | 'incorrect';

// ─── Topic Memory & Velocity ──────────────────────────────────

/** Memory health for a single topic. */
export interface TopicMemoryState {
  topicSlug: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  /** Estimated current retention 0–100 (SM-2 Ebbinghaus). */
  retentionEstimate: number;
  /** BKT concept mastery 0–100: P(student truly understands concepts in this topic). */
  conceptMastery: number;
  /** Depth score 0–100: how deep the student has gone (Level 1 = surface, Level 3 = deep). */
  depthScore: number;
  /** Specific concept tags the student is weak on (BKT p_mastery < 0.4 with 5+ attempts). */
  weakConcepts: string[];
  /** Days since the student last studied this topic. */
  daysSinceLastReview: number;
  /** Cards past their optimal review date. */
  cardsOverdue: number;
  /** Cards due within 48 hours. */
  cardsDueSoon: number;
  /** Total cards tracked (studied) for this topic. */
  totalCards: number;
  /** Total cards available in this topic across all levels. */
  totalCardsAvailable: number;
  /** Average accuracy ratio (nCorrect / totalReviews) across cards in this topic. 0–1. */
  avgAccuracy: number;
  /** Urgency classification. 'not-started' = topic exists in syllabus but user hasn't touched it. */
  urgency: 'critical' | 'review-soon' | 'stable' | 'mastered' | 'not-started';
  /** 7-day trend direction. */
  trend: 'improving' | 'stable' | 'declining';
}

/** Aggregated memory health for a subject (contains topics). */
export interface SubjectMemoryState {
  subjectId: string;
  subjectName: string;
  /** Primary examId this subject belongs to. */
  examId?: string;
  /** Weighted average retention across all topics 0–100. */
  retentionEstimate: number;
  /** Average BKT concept mastery across topics 0–100. */
  conceptMastery: number;
  /** Average depth score across topics 0–100. */
  depthScore: number;
  /** Topic-level breakdowns (includes not-started topics). */
  topics: TopicMemoryState[];
  /** Total overdue cards across all topics. */
  totalOverdue: number;
  /** Total due-soon cards across all topics. */
  totalDueSoon: number;
  /** How many topics in this subject the student has studied. */
  studiedTopics: number;
  /** Total topics in this subject across the exam syllabus. */
  totalTopicsInSubject: number;
}

// ─── Knowledge Gap Forecasting ────────────────────────────────

export interface TopicForecast {
  topicSlug: string;
  topicName: string;
  subjectId?: string;
  subjectName: string;
  examId?: string;
  /** Current accuracy for this topic. */
  currentAccuracy: number;
  /** Predicted accuracy in 7 days if no review happens. */
  predictedAccuracyIn7Days: number;
  /** Risk classification. */
  riskLevel: 'high' | 'medium' | 'low';
  /** How many cards should be reviewed to stabilize. */
  recommendedReviewCards: number;
}

export interface ExamReadiness {
  /** Overall readiness score 0–100, multi-signal tutor assessment. */
  overallScore: number;
  /** BKT concept mastery component 0–100 (weight: 35%). */
  conceptMasteryScore: number;
  /** Depth component 0–100: have they practiced hard questions? (weight: 25%). */
  depthScore: number;
  /** Syllabus coverage 0–1 (studied topics / total topics) (weight: 20%). */
  coverageFactor: number;
  /** Study consistency 0–100: active days pattern (weight: 10%). */
  consistencyScore: number;
  /** IRT ability match 0–100: can they handle exam-level difficulty? (weight: 10%). */
  abilityScore: number;
  /** IRT student ability parameter θ (-3 to +3). */
  studentAbility: number;
  /** Topics the student has studied. */
  studiedTopics: number;
  /** Total topics in the exam syllabus. */
  totalTopicsInExam: number;
  /** Subjects exam-ready: BKT mastery ≥ 0.7, depth ≥ 50%, coverage ≥ 60%. */
  strongAreas: string[];
  /** Subjects at risk: low mastery or low coverage or repeated errors. */
  vulnerableAreas: string[];
  /** Specific concept tags the student repeatedly fails, enriched with routing metadata. */
  weakConcepts: {
    /** Human-readable display name (resolved from topic or humanized tag). */
    concept: string;
    /** Raw BKT concept tag from flashcards.tags[] (e.g. "kinematics"). */
    tag: string;
    /** Resolved topic slug for routing to topic-review. Empty if unresolvable. */
    topicSlug: string;
    /** Subject MongoDB ID for routing. */
    subjectId: string;
    /** Human-readable subject name. */
    subjectName: string;
    /** Exam ID from syllabus (for level-cards routing). */
    examId?: string;
    /** BKT mastery probability 0–1. */
    pMastery: number;
  }[];
  /** Estimated study days to reach target readiness (85%). */
  daysToTargetReadiness: number;
  /** Change from last week's readiness score. */
  weeklyDelta: number;
}

// ─── Study Plan ───────────────────────────────────────────────

export type StudySessionReason = 'overdue' | 'declining' | 'new_topic' | 'reinforcement';
export type StudyDifficulty = 'easy_review' | 'moderate' | 'challenging';

export interface PlannedStudySession {
  topicSlug: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  /** Exam this topic belongs to — used for navigation to level-scoped study. */
  examId?: string;
  /** Why this topic was selected. */
  reason: StudySessionReason;
  /** Number of cards to study. */
  cardCount: number;
  /** Estimated minutes. */
  estimatedMinutes: number;
  /** 1 = most important. */
  priority: number;
  /** Expected difficulty — calibrated by DKT/SAKT if available, else BKT heuristic. */
  difficulty: StudyDifficulty;
  /**
   * ML metadata enriched by the learning intelligence pipeline.
   * All fields are optional — absent when running on BKT-only baseline.
   */
  mlMeta?: {
    /** Which model calibrated the difficulty score. */
    model: 'dkt' | 'sakt' | 'bkt';
    /** Raw P(difficult) score ∈ [0, 1] from DKT/SAKT. */
    pDifficult?: number;
    /** Predicted session dropout risk ∈ [0, 1] from LightGBM. */
    dropoutRisk?: number;
    /**
     * Whether the card count was adjusted downward due to high dropout risk.
     * True when the dropout predictor shortened this session.
     */
    cardCountAdjusted?: boolean;
    /** ALS collaborative-filter affinity score ∈ [0, 1] (new topics only). */
    alsAffinity?: number;
  };
}

export interface DailyStudyPlan {
  /** ISO date string. */
  date: string;
  /** Total recommended study time in minutes. */
  totalMinutes: number;
  /** Ordered list of study sessions. */
  sessions: PlannedStudySession[];
  /** Human-readable insight/motivation. */
  insight: string;
  /** Optimal study window based on chronotype. */
  optimalWindow: string | null;
}

// ─── Learning Velocity ────────────────────────────────────────

export interface LearningVelocity {
  /** Cards studied per day (based on actual active study days). */
  cardsPerDay: number;
  /** Cards per day change vs previous 7-day period. */
  cardsPerDayDelta: number;
  /** Number of days the user actually studied in the last 7 days. */
  activeDays: number;
  /** Rolling 7-day accuracy. */
  accuracy7d: number;
  /** Accuracy change vs previous 7-day period. */
  accuracyDelta: number;
  /** Average response time in ms (rolling 7-day). */
  avgSpeedMs: number;
  /** Speed change vs previous 7-day period. */
  speedDelta: number;
  /** Estimated overall retention (weighted by SM-2 data). */
  retentionEstimate: number;
  /** Retention change vs previous 7-day period. */
  retentionDelta: number;
  /** 4-week trend data for the velocity chart. */
  weeklyTrend: { week: string; cardsPerDay: number; accuracy: number; activeDays: number }[];
}

// ─── Full Learning Profile (API Response) ─────────────────────

/** Complete learning intelligence payload returned by GET /progress/learning-profile. */
export interface LearningProfile {
  /** Today's personalized study plan. */
  studyPlan: DailyStudyPlan;
  /** Memory health per subject → topic. */
  knowledgeHealth: SubjectMemoryState[];
  /** Exam readiness score and forecast. */
  examReadiness: ExamReadiness;
  /** Learning velocity metrics. */
  velocity: LearningVelocity;
  /** Topic-level forecasts for the next 7 days. */
  topicForecasts: TopicForecast[];
  /** Total cards tracked by the memory system. */
  totalTrackedCards: number;
  /** Total overdue cards across all topics. */
  totalOverdueCards: number;
}
