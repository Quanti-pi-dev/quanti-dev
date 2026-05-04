// ─── User & Auth ────────────────────────────────────────────

export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  role: UserRole;
  enrollmentId?: string; // Unique ID (e.g. QP-8F2A9C) — may be absent for legacy users pre-migration
  joinedAt: string;
}

export interface UserPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  studyRemindersEnabled: boolean;
  reminderTime: string | null; // HH:mm format
  onboardingCompleted: boolean;
  selectedExams: string[];
  selectedSubjects: string[];
  /** ISO date string (YYYY-MM-DD) for the student's target exam date. */
  examDate: string | null;
  /** Preferred study time of day — used for notification scheduling. */
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | null;
  /** Daily card target computed from exam date and content volume. */
  dailyCardTarget: number | null;
}

export interface JwtPayload {
  sub: string; // Firebase UID
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}
