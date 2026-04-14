// ─── Content: Exams, Subjects, Decks, Flashcards ───────────

// ─── Subject Levels (fixed, ordered) ────────────────────────

export type SubjectLevel = 'Beginner' | 'Rookie' | 'Skilled' | 'Competent' | 'Expert' | 'Master';

export const SUBJECT_LEVELS: SubjectLevel[] = [
  'Beginner',
  'Rookie',
  'Skilled',
  'Competent',
  'Expert',
  'Master',
];

/** Minimum correct answers required to unlock the next level. */
export const LEVEL_UNLOCK_THRESHOLD = 20;

export interface Exam {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  questionCount: number;
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

export interface Deck {
  id: string;
  title: string;
  description: string;
  category: string;
  cardCount: number;
  imageUrl: string | null;
  createdBy: string;
  // ─── Topic-level scoped fields ───────────────────────────────────────
  subjectId?: string;
  level?: SubjectLevel;
  topicSlug?: string;  // e.g. 'kinematics' — identifies the deck's topic within a subject
  tags?: string[];     // [subjectName, topicSlug, ...examTags, level]
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardOption {
  id: string;
  text: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  question: string;
  options: FlashcardOption[];
  correctAnswerId: string;
  explanation: string | null;
  imageUrl: string | null;
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
