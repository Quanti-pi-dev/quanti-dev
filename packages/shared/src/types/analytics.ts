// ─── Advanced Analytics Types ────────────────────────────────
// Shared types for student growth analytics.

/** Per-hour accuracy aggregation for chronotype detection. */
export interface HourlyAccuracy {
  hour: number;           // 0–23
  accuracy: number;       // 0–100
  sessionCount: number;
}

export type Chronotype = 'early_bird' | 'day_scholar' | 'night_owl';

/** Study chronotype — when does the student perform best? */
export interface ChronotypeData {
  hourlyAccuracy: HourlyAccuracy[];
  peakHour: number;        // 0–23
  peakAccuracy: number;    // 0–100
  chronotype: Chronotype;
}

/** One session plotted on the Speed vs Accuracy matrix. */
export interface SpeedAccuracyPoint {
  sessionId: string;
  avgResponseMs: number;
  accuracy: number;        // 0–100
  cardsStudied: number;
  date: string;            // ISO date string
}

/** Strength score for a single subject (radar chart axis). */
export interface SubjectStrength {
  subjectId: string;
  subjectName: string;
  strengthScore: number;   // 0–100, normalized
  totalCorrect: number;
  totalAnswers: number;
}

/** Full advanced insights payload returned by GET /progress/advanced-insights. */
export interface AdvancedInsights {
  chronotype: ChronotypeData;
  speedAccuracy: SpeedAccuracyPoint[];
  subjectStrengths: SubjectStrength[];
}
