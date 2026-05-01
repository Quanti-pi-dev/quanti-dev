// ─── Type-Safe API Contracts ────────────────────────────────
// Centralized, strongly-typed wrappers for every API endpoint.
// All hooks should call these instead of raw api.get/post.

import { api, adminApi } from './api';
import type {
  Exam,
  Deck,
  Flashcard,
  UserPreferences,
  UserProfile,
  ProgressSummary,
  ProgressRecord,
  CoinBalance,
  CoinTransaction,
  UserBadge,
  Leaderboard,
  ShopItem,
  PurchaseEffect,
  PaginatedResponse,
  ApiResponse,
  Subject,
  StudyStreak,
  SubjectLevelSummary,
  ExamProgress,
  AdvancedInsights,
} from '@kd/shared';

// ─── Generic Helpers (FIX A3) ───────────────────────────────
// Use these in new code to avoid the repetitive unwrap boilerplate.

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(path, { params });
  return data?.data as T;
}

export async function apiPost<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const { data } = await api.post<ApiResponse<T>>(path, body);
  return data?.data as T;
}

export async function apiPut<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const { data } = await api.put<ApiResponse<T>>(path, body);
  return data?.data as T;
}

export async function adminGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await adminApi.get<ApiResponse<T>>(path, { params });
  return data?.data as T;
}

export async function adminPost<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const { data } = await adminApi.post<ApiResponse<T>>(path, body);
  return data?.data as T;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const { data } = await api.get<ApiResponse<UserProfile>>('/auth/me');
  return data?.data as UserProfile;
}

// ─── User Preferences ──────────────────────────────────────

export async function fetchPreferences(): Promise<UserPreferences> {
  const { data } = await api.get<ApiResponse<UserPreferences>>('/users/preferences');
  return data?.data as UserPreferences;
}

export async function updatePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  await api.put('/users/preferences', prefs);
}

// ─── Content (Exams, Decks, Flashcards) ────────────────────

export async function fetchExams(pageSize = 100): Promise<Exam[]> {
  const { data } = await api.get<PaginatedResponse<Exam>>('/exams', { params: { pageSize } });
  return (data?.data ?? []) as Exam[];
}

export async function fetchDecks(params?: { categories?: string[]; pageSize?: number }): Promise<Deck[]> {
  const { data } = await api.get<PaginatedResponse<Deck>>('/decks', { params: { ...params, pageSize: params?.pageSize ?? 100 } });
  return (data?.data ?? []) as Deck[];
}

export async function fetchDeckCards(deckId: string, pageSize = 100): Promise<Flashcard[]> {
  const { data } = await api.get<PaginatedResponse<Flashcard>>(`/decks/${deckId}/cards`, { params: { pageSize } });
  return (data?.data ?? []) as Flashcard[];
}

export async function fetchAdaptiveCards(deckIds: string[], pageSize = 100): Promise<Flashcard[]> {
  const { data } = await api.get<PaginatedResponse<Flashcard>>('/study/adaptive', {
    params: { decks: deckIds, pageSize },
  });
  return (data?.data ?? []) as Flashcard[];
}

// ─── Progress ──────────────────────────────────────────────

export async function fetchProgressSummary(): Promise<ProgressSummary> {
  const { data } = await api.get<ApiResponse<ProgressSummary>>('/progress/summary');
  return data?.data as ProgressSummary;
}

export async function fetchDeckProgress(deckId: string): Promise<ProgressRecord> {
  const { data } = await api.get<ApiResponse<ProgressRecord>>(`/progress/decks/${deckId}`);
  return data?.data as ProgressRecord;
}

export async function recordCompletion(payload: {
  deckId: string;
  cardId: string;
  correct: boolean;
  responseTimeMs: number;
}): Promise<void> {
  await api.post('/progress/record', payload);
}

// ─── Gamification ──────────────────────────────────────────

export async function fetchCoinBalance(): Promise<CoinBalance> {
  const { data } = await api.get<ApiResponse<CoinBalance>>('/gamify/coins');
  return data?.data as CoinBalance;
}

export async function fetchUserBadges(): Promise<UserBadge[]> {
  const { data } = await api.get<ApiResponse<UserBadge[]>>('/gamify/badges');
  return (data?.data ?? []) as UserBadge[];
}

export async function fetchLeaderboard(type: 'global' | 'weekly' = 'global', limit = 50): Promise<Leaderboard> {
  const { data } = await api.get<ApiResponse<Leaderboard>>('/gamify/leaderboard', { params: { type, limit } });
  return data?.data as Leaderboard;
}

export async function fetchShopItems(): Promise<ShopItem[]> {
  const { data } = await api.get<ApiResponse<ShopItem[]>>('/gamify/shop');
  return (data?.data ?? []) as ShopItem[];
}

export async function purchaseShopItem(itemId: string): Promise<{ message: string; effect: PurchaseEffect | null }> {
  const { data } = await api.post<ApiResponse<{ message: string; effect: PurchaseEffect | null }>>('/gamify/shop/purchase', { itemId });
  return data?.data as { message: string; effect: PurchaseEffect | null };
}

export async function fetchCoinHistory(page = 1, pageSize = 20): Promise<{
  data: CoinTransaction[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
}> {
  const { data } = await api.get<{
    success: boolean;
    data: CoinTransaction[];
    pagination: { page: number; pageSize: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
  }>('/gamify/coins/history', { params: { page, pageSize } });
  return { data: data?.data ?? [], pagination: data?.pagination ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
}

export async function fetchUnlockedDecks(): Promise<string[]> {
  const { data } = await api.get<ApiResponse<{ deckIds: string[] }>>('/gamify/shop/unlocked');
  return data?.data?.deckIds ?? [];
}

// ─── AI ────────────────────────────────────────────────────

export interface InsightsResponse {
  optimalStudyTime: string;
  retentionRate: number;
  weakTopics: string[];
  strongTopics: string[];
  /** Gemini-generated narrative summary. Null when user has < 3 sessions. */
  aiSummary: string | null;
  /** Gemini-generated actionable recommendations (up to 4). */
  aiRecommendations: string[];
}

export async function fetchInsights(): Promise<InsightsResponse> {
  const { data } = await api.get<ApiResponse<InsightsResponse>>('/ai/insights');
  return data?.data as InsightsResponse;
}

export interface Recommendation {
  deckId: string;
  title: string;
  reason: string;
  priority: number;
  suggestedCards: number;
}

export async function fetchRecommendations(): Promise<Recommendation[]> {
  const { data } = await api.get<ApiResponse<Recommendation[]>>('/ai/recommendations');
  return (data?.data ?? []) as Recommendation[];
}

/**
 * Request a live Gemini-generated explanation for a specific flashcard.
 * Returns the explanation text. Client should cache per session to avoid redundant calls.
 */
export async function fetchExplainCard(cardId: string): Promise<string> {
  const { data } = await api.post<ApiResponse<{ explanation: string }>>('/ai/explain', { cardId });
  return data?.data?.explanation ?? '';
}

// ─── Admin ─────────────────────────────────────────────────

export async function adminCreateExam(exam: Partial<Exam>): Promise<{ id: string }> {
  const { data } = await adminApi.post<ApiResponse<{ id: string }>>('/exams', exam);
  return data?.data as { id: string };
}

export async function adminCreateDeck(deck: Partial<Deck>): Promise<{ id: string }> {
  const { data } = await adminApi.post<ApiResponse<{ id: string }>>('/decks', deck);
  return data?.data as { id: string };
}

export async function adminCreateFlashcard(
  deckId: string,
  card: { question: string; options: Array<{ id: string; text: string }>; correctAnswerId: string; explanation?: string | null },
): Promise<{ id: string }> {
  const { data } = await adminApi.post<ApiResponse<{ id: string }>>(`/flashcards?deckId=${encodeURIComponent(deckId)}`, card);
  return data?.data as { id: string };
}

export async function adminBulkCreateFlashcards(
  deckId: string,
  cards: Array<{ question: string; options: Array<{ id: string; text: string }>; correctAnswerId: string; explanation?: string | null }>
): Promise<{ created: number }> {
  const { data } = await adminApi.post<ApiResponse<{ created: number }>>(`/flashcards/bulk?deckId=${deckId}`, { cards });
  return data?.data as { created: number };
}

// ─── Progress History ──────────────────────────────────────

export async function fetchRecentSessions(pageSize = 5): Promise<Array<{
  deckId: string;
  deckTitle: string;
  cardsStudied: number;
  correctAnswers: number;
  endedAt: string;
}>> {
  const { data } = await api.get<PaginatedResponse<{
    deckId: string;
    deckTitle: string;
    cardsStudied: number;
    correctAnswers: number;
    endedAt: string;
  }>>('/progress/history', { params: { page: 1, pageSize } });
  return (data?.data ?? []) as Array<{
    deckId: string;
    deckTitle: string;
    cardsStudied: number;
    correctAnswers: number;
    endedAt: string;
  }>;
}

// ─── Coins Today ──────────────────────────────────────────────

export async function fetchCoinsToday(): Promise<{ earnedToday: number; dailyCap: number }> {
  const { data } = await api.get<ApiResponse<{ earnedToday: number; dailyCap: number }>>('/gamify/coins/today');
  return data?.data as { earnedToday: number; dailyCap: number };
}

// ─── Level Progress Summary ───────────────────────────────────

export interface LevelProgressSummaryItem {
  examId: string;
  examName: string;
  subjectId: string;
  subjectName: string;
  highestLevel: string;
  levelIndex: number; // 0=Beginner … 5=Master
  correctAnswers: number; // total correct across ALL levels for this subject
  totalAnswers: number;   // total attempts across ALL levels for this subject
}

export async function fetchLevelProgressSummary(): Promise<LevelProgressSummaryItem[]> {
  const { data } = await api.get<ApiResponse<LevelProgressSummaryItem[]>>('/progress/level-progress-summary');
  return (data?.data ?? []) as LevelProgressSummaryItem[];
}

// ─── Advanced Insights ────────────────────────────────────────

export async function fetchAdvancedInsights(): Promise<AdvancedInsights> {
  return apiGet<AdvancedInsights>('/progress/advanced-insights');
}


// ─── Level Cards (exam-scoped) ───────────────────────────────

export async function fetchLevelCards(
  examId: string,
  subjectId: string,
  topicSlug: string,
  level: string,
  pageSize = 100,
): Promise<{ deckId: string; cards: Flashcard[] }> {
  const { data } = await api.get<ApiResponse<{ deckId: string; cards: Flashcard[] }>>(
    `/exams/${examId}/subjects/${subjectId}/topics/${topicSlug}/levels/${level}/cards`,
    { params: { pageSize } },
  );
  return data?.data as { deckId: string; cards: Flashcard[] };
}

// ─── Exam Subjects ───────────────────────────────────────────

export async function fetchExamSubjects(examId: string): Promise<Subject[]> {
  return apiGet<Subject[]>(`/exams/${examId}/subjects`);
}

// ─── Subject Level Summary ───────────────────────────────────

export async function fetchSubjectLevelSummary(
  examId: string,
  subjectId: string,
  topicSlug: string,
): Promise<SubjectLevelSummary> {
  return apiGet<SubjectLevelSummary>(
    `/progress/exams/${examId}/subjects/${subjectId}/topics/${topicSlug}/levels`,
  );
}

// ─── Exam Progress ───────────────────────────────────────────

export async function fetchExamProgress(
  examId: string,
  subjectIds: string[],
): Promise<ExamProgress[]> {
  return apiGet<ExamProgress[]>(`/progress/exams/${examId}`, { subjectIds: subjectIds.join(',') });
}

// ─── Study Streak ────────────────────────────────────────────

export async function fetchStudyStreak(): Promise<StudyStreak> {
  return apiGet<StudyStreak>('/progress/streak');
}

// ─── Admin Analytics ──────────────────────────────────────────

export interface PlatformAnalytics {
  totalUsers: number;
  activeUsersToday: number;
  totalSessions: number;
  totalCardsAnswered: number;
  avgAccuracyPct: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  totalCoinsInCirculation: number;
  shopItemCount: number;
  purchasedPackCount: number;
  purchasedThemeCount: number;
}

export async function fetchAdminAnalytics(): Promise<PlatformAnalytics> {
  const { data } = await adminApi.get<ApiResponse<PlatformAnalytics>>('/analytics');
  return data?.data as PlatformAnalytics;
}

// ─── Admin Plans ──────────────────────────────────────────────

import type {
  Plan,
  PlanFeatures,
  Subscription,
  SubscriptionEvent,
  SubscriptionStatus,
} from '@kd/shared';

export interface CreatePlanInput {
  slug: string;
  displayName: string;
  tier: 1 | 2 | 3;
  billingCycle: 'weekly' | 'monthly';
  pricePaise: number;
  features: PlanFeatures;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
}

export async function adminFetchPlans(): Promise<Plan[]> {
  const { data } = await adminApi.get<ApiResponse<Plan[]>>('/plans');
  return (data?.data ?? []) as Plan[];
}

export async function adminCreatePlan(input: CreatePlanInput): Promise<Plan> {
  const { data } = await adminApi.post<ApiResponse<Plan>>('/plans', input);
  return data?.data as Plan;
}

export async function adminUpdatePlan(id: string, input: Partial<CreatePlanInput>): Promise<Plan> {
  const { data } = await adminApi.patch<ApiResponse<Plan>>(`/plans/${id}`, input);
  return data?.data as Plan;
}

export async function adminDeletePlan(id: string): Promise<void> {
  await adminApi.delete(`/plans/${id}`);
}

// ─── Admin Subscriptions ──────────────────────────────────────

export interface AdminSubscriptionListResult {
  subscriptions: Subscription[];
  total: number;
}

export interface AdminSubscriptionDetail {
  subscription: Subscription;
  events: SubscriptionEvent[];
}

export interface GrantSubscriptionInput {
  userId: string;
  planId: string;
  customEndDate?: string;
  adminNotes?: string;
  overwriteExisting?: boolean;
}

export async function adminFetchSubscriptions(params?: {
  limit?: number;
  offset?: number;
  status?: SubscriptionStatus;
}): Promise<AdminSubscriptionListResult> {
  const { data } = await adminApi.get<ApiResponse<AdminSubscriptionListResult>>('/subscriptions', { params });
  return data?.data as AdminSubscriptionListResult;
}

export async function adminFetchSubscription(id: string): Promise<AdminSubscriptionDetail> {
  const { data } = await adminApi.get<ApiResponse<AdminSubscriptionDetail>>(`/subscriptions/${id}`);
  return data?.data as AdminSubscriptionDetail;
}

export async function adminGrantSubscription(input: GrantSubscriptionInput): Promise<{ subscription: Subscription; superseded?: Subscription }> {
  const { data } = await adminApi.post<ApiResponse<{ subscription: Subscription; superseded?: Subscription }>>('/subscriptions', input);
  return data?.data as { subscription: Subscription; superseded?: Subscription };
}

export async function adminPatchSubscription(id: string, input: { status?: SubscriptionStatus; cancelAtPeriodEnd?: boolean }): Promise<Subscription> {
  const { data } = await adminApi.patch<ApiResponse<Subscription>>(`/subscriptions/${id}`, input);
  return data?.data as Subscription;
}

// ─── Admin User Search ────────────────────────────────────────

export async function adminSearchUsers(q: string, limit = 10): Promise<UserProfile[]> {
  const { data } = await adminApi.get<ApiResponse<UserProfile[]>>('/users/search', { params: { q, limit } });
  return (data?.data ?? []) as UserProfile[];
}

// ─── Friends ──────────────────────────────────────────────────

import type {
  Friendship,
  UserSummary,
  Challenge,
  ChallengeDetail,
  AnswerResult,
} from '@kd/shared';

export async function sendFriendRequest(addresseeId: string): Promise<Friendship> {
  return apiPost<Friendship>('/friends/request', { addresseeId });
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  await apiPost<{ message: string }>(`/friends/${friendshipId}/accept`);
}

export async function deleteFriendship(friendshipId: string): Promise<void> {
  await api.delete<ApiResponse<{ message: string }>>(`/friends/${friendshipId}`);
}

export async function removeFriendByUser(userId: string): Promise<void> {
  await api.delete<ApiResponse<{ message: string }>>(`/friends/user/${userId}`);
}

export async function blockUser(targetUserId: string): Promise<void> {
  await apiPost<{ message: string }>(`/friends/${targetUserId}/block`);
}

export async function fetchFriends(): Promise<UserSummary[]> {
  return apiGet<UserSummary[]>('/friends');
}

export async function fetchPendingFriendRequests(): Promise<{ received: Friendship[]; sent: Friendship[] }> {
  const [received, sent] = await Promise.all([
    apiGet<Friendship[]>('/friends/requests/received'),
    apiGet<Friendship[]>('/friends/requests/sent'),
  ]);
  return { received, sent };
}

export async function searchUsers(q: string, limit = 20): Promise<UserSummary[]> {
  return apiGet<UserSummary[]>('/users/search', { q, limit });
}

// ─── P2P Challenges ───────────────────────────────────────────

export interface CreateChallengeInput {
  opponentId: string;
  examId: string;
  subjectId: string;
  level: string;
  betAmount: number;
  durationSeconds: number;
}

export async function createChallenge(input: CreateChallengeInput): Promise<Challenge> {
  return apiPost<Challenge>('/p2p/challenges', input as unknown as Record<string, unknown>);
}

export async function fetchPendingChallenges(): Promise<ChallengeDetail[]> {
  return apiGet<ChallengeDetail[]>('/p2p/challenges/pending');
}

export async function fetchActiveChallenge(): Promise<ChallengeDetail | null> {
  return apiGet<ChallengeDetail | null>('/p2p/challenges/active');
}

export async function fetchChallengeHistory(page = 1, pageSize = 20): Promise<{
  data: ChallengeDetail[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
}> {
  const { data } = await api.get<{
    success: boolean;
    data: ChallengeDetail[];
    pagination: { page: number; pageSize: number; totalItems: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
  }>('/p2p/challenges', { params: { page, pageSize } });
  return { data: data?.data ?? [], pagination: data?.pagination ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
}

export async function fetchChallengeDetail(id: string): Promise<ChallengeDetail> {
  return apiGet<ChallengeDetail>(`/p2p/challenges/${id}`);
}

export async function acceptChallenge(id: string): Promise<Challenge> {
  return apiPost<Challenge>(`/p2p/challenges/${id}/accept`);
}

export async function declineChallenge(id: string): Promise<void> {
  await apiPost<{ message: string }>(`/p2p/challenges/${id}/decline`);
}

export async function cancelChallenge(id: string): Promise<void> {
  await apiPost<{ message: string }>(`/p2p/challenges/${id}/cancel`);
}

export async function submitChallengeAnswer(id: string, cardId: string, selectedAnswerId: string): Promise<AnswerResult> {
  return apiPost<AnswerResult>(`/p2p/challenges/${id}/answer`, { cardId, selectedAnswerId });
}
