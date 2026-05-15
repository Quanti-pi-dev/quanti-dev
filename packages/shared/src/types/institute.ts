// ─── Institute Collaboration Types ───────────────────────────────
// Shared types for institutes, members, custom tests, and mock tests.

// ─── Roles ───────────────────────────────────────────────────────

export type InstituteMemberRole =
  | 'institute_admin'
  | 'educator'
  | 'examiner'
  | 'student';

// ─── Institute ───────────────────────────────────────────────────

export type InstituteType = 'coaching' | 'school' | 'university';

export interface Institute {
  id: string;
  name: string;
  /** Short unique code used in student UIDs, join codes etc. e.g. "ALLEN" */
  code: string;
  type: InstituteType;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string | null;
  address: InstituteAddress | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InstituteAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pin: string;
}

// ─── Institute Member ─────────────────────────────────────────────

export interface InstituteMember {
  id: string;
  instituteId: string;
  userId: string;         // PostgreSQL UUID
  firebaseUid: string;   // Firebase UID (for Redis/leaderboard ops)
  role: InstituteMemberRole;
  /** Institute-assigned UID e.g. "ALLEN-2026-0042". Auto-generated for students. */
  studentUid: string | null;
  /** For educators/examiners: their department e.g. "Physics" */
  department: string | null;
  isActive: boolean;
  joinedAt: string;
}

export interface InstituteMemberSummary {
  id: string;
  role: InstituteMemberRole;
  studentUid: string | null;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  enrollmentId: string;   // Platform QP-XXXX ID
  isActive: boolean;
  joinedAt: string;
}

// ─── Institute Join Code ──────────────────────────────────────────

export interface InstituteJoinCode {
  id: string;
  instituteId: string;
  code: string;           // 6-char alphanumeric e.g. "ALLEN7"
  role: InstituteMemberRole;
  department: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdBy: string;      // Firebase UID of creator
  createdAt: string;
  isActive: boolean;
}

// ─── Institute Subscription ───────────────────────────────────────

export type InstituteSubscriptionStatus = 'active' | 'expired' | 'canceled' | 'pending';

export interface InstituteSubscription {
  id: string;
  instituteId: string;
  planId: string;
  maxSeats: number;
  usedSeats: number;
  status: InstituteSubscriptionStatus;
  billingContact: string | null;
  periodStart: string;
  periodEnd: string;
  amountPaise: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Custom Test (Educator-created) ──────────────────────────────

export type CustomTestStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'closed'
  | 'graded';

export type CustomTestQuestionSource = 'custom' | 'pool' | 'ai';

export interface CustomTestSettings {
  shuffleQuestions: boolean;
  /** When to reveal results to students */
  showResults: 'immediate' | 'after_close' | 'manual';
  negativeMarking: boolean;
  negativeMarkValue: number;
  passingScore: number;    // Percentage 0–100
}

export interface CustomTestQuestion {
  id: string;
  text: string;
  imageUrl: string | null;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string | null;
  marks: number;
  topicSlug: string | null;
  /** Origin of this question */
  source: CustomTestQuestionSource;
  /** For 'pool' source: the original flashcard/question ObjectId */
  poolQuestionId: string | null;
}

export interface CustomTest {
  id: string;
  instituteId: string;
  createdBy: string;        // Firebase UID of educator
  title: string;
  description: string;
  subjectId: string;        // MongoDB ObjectId
  topicIds: string[];       // Optional topic filter
  questionCount: number;
  durationMinutes: number;
  scheduledAt: string | null;
  closesAt: string | null;
  status: CustomTestStatus;
  settings: CustomTestSettings;
  questions: CustomTestQuestion[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Custom Test Submission ───────────────────────────────────────

export type SubmissionStatus = 'in_progress' | 'submitted' | 'graded';

export interface CustomTestAnswer {
  questionId: string;
  selectedOptionId: string | null;   // null = unattempted
  timeSpentMs: number;
}

export interface CustomTestSubmission {
  id: string;
  testId: string;
  studentId: string;        // Firebase UID
  instituteId: string;
  answers: CustomTestAnswer[];
  score: number;
  totalMarks: number;
  correctCount: number;
  incorrectCount: number;
  unattempted: number;
  timeTakenSeconds: number;
  startedAt: string;
  submittedAt: string | null;
  status: SubmissionStatus;
}

// ─── Mock Test (Examiner-created) ────────────────────────────────

export type InstituteMockTestStatus = 'draft' | 'scheduled' | 'live' | 'closed';

export interface InstituteMockTestSection {
  subjectId: string;
  subjectName?: string;
  questionCount: number;
  questionIds: string[];    // MongoDB Question ObjectIds
  marksPerCorrect: number;
  marksPerIncorrect: number;
}

export interface InstituteMockTest {
  id: string;
  instituteId: string;
  createdBy: string;          // Firebase UID of examiner
  /** Reference to existing exam template (e.g. NEET, JEE) */
  examTemplateId: string;
  examTemplateName?: string;
  title: string;
  sections: InstituteMockTestSection[];
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  scheduledAt: string | null;
  closesAt: string | null;
  status: InstituteMockTestStatus;
  settings: {
    sectionSwitching: boolean;
    calculatorAllowed: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Institute Leaderboard ────────────────────────────────────────

export interface InstituteLeaderboardEntry {
  rank: number;
  userId: string;
  studentUid: string | null;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface InstituteLeaderboard {
  entries: InstituteLeaderboardEntry[];
  userRank: InstituteLeaderboardEntry | null;
  totalParticipants: number;
  updatedAt: string;
}
