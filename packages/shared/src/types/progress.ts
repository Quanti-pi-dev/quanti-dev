// ─── Progress & Study ───────────────────────────────────────

import type { SubjectLevel } from './content.js';

export interface ProgressRecord {
  userId: string;
  deckId: string;
  completedCards: number;
  totalCards: number;
  completionPercentage: number;
  lastStudiedAt: string;
}

export interface StudySession {
  id: string;
  userId: string;
  deckId: string;
  cardsStudied: number;
  correctAnswers: number;
  incorrectAnswers: number;
  averageResponseTimeMs: number;
  startedAt: string;
  endedAt: string;
}

export interface StudyStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string;
  /** Number of streak freezes the user currently holds (max 3). */
  streakFreezes: number;
  /** True if a freeze was auto-consumed on this call to preserve the streak. */
  freezeConsumed: boolean;
}

export interface ProgressSummary {
  totalDecksStudied: number;
  totalCardsCompleted: number;
  overallAccuracy: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyTimeMinutes: number;
  weeklyActivity: DailyActivity[];
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  cardsStudied: number;
  minutesSpent: number;
}

// ─── Level-scoped progress (Exam → Subject → Level model) ───

/** Progress for one (userId, subjectId, examId, level) combination. */
export interface LevelProgress {
  userId: string;
  subjectId: string;
  examId: string;
  /** Topic within the subject (e.g. 'kinematics'). */
  topicSlug?: string;
  level: SubjectLevel;
  correctAnswers: number;
  totalAnswers: number;
  /** True if this level can be studied (Beginner is always unlocked). */
  isUnlocked: boolean;
  /** True if correctAnswers >= LEVEL_UNLOCK_THRESHOLD (next level granted). */
  isCompleted: boolean;
}

/** All 6 level-progress records for a subject within an exam. */
export interface SubjectLevelSummary {
  subjectId: string;
  examId: string;
  /** Topic within the subject (e.g. 'kinematics'). */
  topicSlug?: string;
  /** Always exactly 6 entries in SUBJECT_LEVELS order. */
  levels: LevelProgress[];
}

/** High-level exam progress — one entry per subject. */
export interface ExamProgress {
  examId: string;
  subjectId: string;
  /** Deepest level the user has unlocked (Beginner minimum). */
  highestUnlockedLevel: SubjectLevel;
}

/** Payload returned by POST /progress/level-answer */
export interface LevelAnswerResult {
  levelProgress: LevelProgress;
  /** True if this answer triggered the next level to unlock. */
  justUnlocked: boolean;
  /** Name of the newly unlocked level, if justUnlocked is true. */
  newlyUnlockedLevel?: SubjectLevel;
  /** Total coins earned by this single answer event (0 if no new coins). */
  coinsEarned: number;
}
