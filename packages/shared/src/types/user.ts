// ─── User & Auth ────────────────────────────────────────────

export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  auth0Id: string;
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
}

export interface JwtPayload {
  sub: string; // Auth0 user ID
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
