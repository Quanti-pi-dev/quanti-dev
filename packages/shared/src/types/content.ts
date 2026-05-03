// ─── Content: Exams, Subjects, Topics, Decks, Flashcards ───

// ─── Subject Levels (fixed, ordered) ────────────────────────
// Aligned 1:1 with the Educator Brain's BKT mastery classification.
// 4 progressive tiers that match the knowledge model.

export type SubjectLevel = 'Emerging' | 'Developing' | 'Proficient' | 'Master';

export const SUBJECT_LEVELS: SubjectLevel[] = [
  'Emerging',
  'Developing',
  'Proficient',
  'Master',
];

/** Minimum correct answers required to unlock the next level.
 *  30 × 4 levels = 120 total (same progression length as old 20 × 6). */
export const LEVEL_UNLOCK_THRESHOLD = 30;

export interface Exam {
  id: string;
  title: string;
  description: string;
  category: string;
  questionCount: number;
  subjectCount: number;   // number of subjects mapped to this exam
  durationMinutes: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Subject ─────────────────────────────────────────────────
// A reusable topic area (e.g. "Number System") that can belong to many exams.

export interface Subject {
  id: string;
  name: string;
  description?: string;
  iconName?: string;   // Ionicons icon name
  accent?: string;     // hex colour for card accent
  createdAt: string;
  updatedAt: string;
}

// ─── ExamSubject ─────────────────────────────────────────────
// M:N mapping: one subject can belong to many exams, one exam has many subjects.

export interface ExamSubject {
  id: string;
  examId: string;
  subjectId: string;
  order: number;       // display order within the exam
}

// ─── Deck Type Discriminator ─────────────────────────────────

export type DeckType = 'mastery' | 'shop' | 'standalone';

export interface Deck {
  id: string;
  title: string;
  description: string;
  /** Canonical content type discriminator. */
  type: DeckType;
  /** @deprecated Use `type` instead. Kept for backward compat during migration. */
  category?: string;
  cardCount: number;
  imageUrl: string | null;
  createdBy: string;
  // ─── Hierarchy-scoped fields (populated for type='mastery') ────────────
  examId?: string;     // links deck to a specific exam
  subjectId?: string;
  topicId?: string;    // FK to topics collection
  level?: SubjectLevel;
  topicSlug?: string;  // e.g. 'kinematics' — identifies the deck's topic within a subject
  tags?: string[];     // kept for search/display, no longer structural
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardOption {
  id: string;
  text: string;
  /** What the student likely misunderstands if they pick this wrong option. */
  misconception?: string;
}

// ─── Flashcard Source ────────────────────────────────────────

export type FlashcardSource = 'original' | 'pyq' | 'ai_generated';

export interface Flashcard {
  id: string;
  deckId: string;
  question: string;
  options: FlashcardOption[];
  correctAnswerId: string;
  explanation: string | null;
  imageUrl: string | null;
  /** Content origin: platform-created, previous-year-question, or AI-generated. */
  source: FlashcardSource;
  /** Year the question appeared (PYQ only). */
  sourceYear?: number;
  /** Paper identifier, e.g. 'JEE Mains Shift 1' (PYQ only). */
  sourcePaper?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  examId: string;
  text: string;
  options: FlashcardOption[];
  correctAnswerId: string;
  explanation: string | null;
  imageUrl: string | null;
  points: number;
}

export interface ExamResult {
  examId: string;
  userId: string;
  score: number;
  totalPoints: number;
  correctCount: number;
  totalQuestions: number;
  timeTakenSeconds: number;
  completedAt: string;
}

// ─── Topic (exam-scoped) ─────────────────────────────────────
// Each topic is scoped to a specific exam. "Kinematics" under JEE and
// "Kinematics" under NEET are separate documents.

export interface Topic {
  id: string;
  examId: string;      // exam-scoped: unique index on { examId, subjectId, slug }
  subjectId: string;
  slug: string;        // kebab-case, e.g. 'kinematics'
  displayName: string; // human-readable, e.g. 'Kinematics'
  order: number;
  createdAt: string;
  updatedAt: string;
}
