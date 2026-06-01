// ─── Behavioral Engine API Contracts ─────────────────────────
// Type-safe wrappers for: Study Pacts, Flash Events, Progressive
// Profile, Weekly Highlights, Celebration Cascade, User Decks, and
// Card Annotations.
//
// Psychology: Blueprint §3–§4 — Investment + Social Accountability.

import { apiGet, apiPost, apiPut } from './api-contracts';
import { api } from './api';
import type { ApiResponse } from '@kd/shared';

// ─── Study Pacts ──────────────────────────────────────────────

export interface StudyPactMember {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  todayMinutes: number;
  dailyTarget: number;
  streak: number;
  metTargetToday: boolean;
}

export interface StudyPact {
  id: string;
  name: string;
  dailyTarget: number;       // minutes
  durationDays: 3 | 7 | 14;
  startsAt: string;
  endsAt: string;
  members: StudyPactMember[];
  status: 'pending' | 'active' | 'completed' | 'broken';
  myStatus: 'met' | 'at_risk' | 'broken';
}

export interface CreatePactInput {
  name: string;
  dailyTarget: number;
  durationDays: 3 | 7 | 14;
  memberFirebaseUids: string[];
}

export async function fetchActivePact(): Promise<StudyPact | null> {
  return apiGet<StudyPact | null>('/study-pacts/active');
}

export async function fetchPact(id: string): Promise<StudyPact | null> {
  return apiGet<StudyPact | null>(`/study-pacts/${id}`);
}

export async function createStudyPact(input: CreatePactInput): Promise<StudyPact> {
  return apiPost<StudyPact>('/study-pacts', input as unknown as Record<string, unknown>);
}

// ─── Flash Events ─────────────────────────────────────────────

export type FlashEventType = 'speed_run' | 'accuracy_challenge' | 'topic_blitz' | 'coin_boost';

export interface FlashEvent {
  id: string;
  type: FlashEventType;
  title: string;
  description: string;
  rewardCoins: number;
  bonusMultiplier: number;
  targetCards: number;
  expiresAt: string;
  status: 'scheduled' | 'active' | 'completed' | 'expired';
  timeRemainingMs: number;
}

export async function fetchActiveFlashEvent(): Promise<FlashEvent | null> {
  return apiGet<FlashEvent | null>('/gamify/flash-event/active');
}

// ─── Progressive Profile ──────────────────────────────────────

export type ProfileTier = 'Rookie' | 'Scholar' | 'Expert' | 'Legend';

export interface ProfileFeatureUnlock {
  feature: string;
  label: string;
  description: string;
  unlockedAt: ProfileTier;
  isUnlocked: boolean;
}

export interface ProfileUnlockStatus {
  currentTier: ProfileTier;
  nextTier: ProfileTier | null;
  xpCurrent: number;
  xpRequired: number;
  percentToNext: number;
  unlockedFeatures: ProfileFeatureUnlock[];
  lockedFeatures: ProfileFeatureUnlock[];
}

export async function fetchProfileUnlockStatus(): Promise<ProfileUnlockStatus> {
  return apiGet<ProfileUnlockStatus>('/profile/tiers');
}

// ─── Weekly Highlight Reel ────────────────────────────────────

export interface WeeklyHighlight {
  userId: string;
  weekLabel: string;        // e.g. "May 26 – Jun 1"
  cardsStudied: number;
  correctAnswers: number;
  accuracy: number;
  bestStreak: number;
  topSubject: string | null;
  coinsEarned: number;
  minutesStudied: number;
  headline: string;         // e.g. "Your Best Week Yet!"
  generatedAt: string;
}

export async function fetchLatestHighlight(): Promise<WeeklyHighlight | null> {
  return apiGet<WeeklyHighlight | null>('/profile/weekly-highlight');
}

// ─── Celebration Cascade ──────────────────────────────────────

export type CelebrationStepType =
  | 'confetti'
  | 'coin_drop'
  | 'coin_shower'        // alias sent by some backend builders, normalised by API layer
  | 'badge_reveal'
  | 'level_up'
  | 'pact_complete'
  | 'streak_milestone'
  | 'streak_fire'        // alias sent by backend, normalised to streak_milestone by API layer
  | 'stat_card'          // slide-in stat display (e.g. "100% accuracy")
  | 'social_card'        // social share prompt
  | 'sound_effect';      // audio-only step (ignored on native; client skips gracefully)

export interface CelebrationStep {
  type: CelebrationStepType;
  durationMs: number;
  payload: Record<string, unknown>;
}

export interface CelebrationSequence {
  steps: CelebrationStep[];
  totalDurationMs: number;
}

export async function fetchPendingCelebration(): Promise<CelebrationSequence | null> {
  return apiGet<CelebrationSequence | null>('/gamify/celebration/pending');
}

export async function acknowledgeCelebration(): Promise<void> {
  await apiPost<{ ok: boolean }>('/gamify/celebration/ack');
}

// ─── User Decks (Personal) ────────────────────────────────────

export interface UserDeck {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  cardCount: number;
  isShared: boolean;
  sharedWithUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserDeckCard {
  id: string;
  deckId: string;
  question: string;
  options: Array<{ id: string; text: string; imageUrl?: string | null }>;
  correctAnswerId: string;
  explanation: string | null;
  imageUrl?: string | null;
  explanationImageUrl?: string | null;
  order: number;
}

export async function fetchUserDecks(): Promise<{ owned: UserDeck[]; sharedWithMe: UserDeck[] }> {
  return apiGet<{ owned: UserDeck[]; sharedWithMe: UserDeck[] }>('/user-decks');
}

export async function createUserDeck(input: { title: string; description?: string }): Promise<UserDeck> {
  return apiPost<UserDeck>('/user-decks', input as Record<string, unknown>);
}

export async function deleteUserDeck(deckId: string): Promise<void> {
  await api.delete<ApiResponse<void>>(`/user-decks/${deckId}`);
}

export async function fetchUserDeckCards(deckId: string): Promise<UserDeckCard[]> {
  return apiGet<UserDeckCard[]>(`/user-decks/${deckId}/cards`);
}

export async function addUserDeckCard(
  deckId: string,
  card: { question: string; options: Array<{ id: string; text: string }>; correctAnswerId: string; explanation?: string | null },
): Promise<UserDeckCard> {
  return apiPost<UserDeckCard>(`/user-decks/${deckId}/cards`, card as Record<string, unknown>);
}

export async function deleteUserDeckCard(deckId: string, cardId: string): Promise<void> {
  await api.delete<ApiResponse<void>>(`/user-decks/${deckId}/cards/${cardId}`);
}

export async function shareUserDeck(deckId: string, recipientFirebaseUid: string): Promise<void> {
  await apiPost<{ ok: boolean }>(`/user-decks/${deckId}/share`, { recipientFirebaseUid });
}

// ─── Card Annotations ─────────────────────────────────────────

export interface CardAnnotation {
  id: string;
  userId: string;
  cardId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAnnotation(cardId: string): Promise<CardAnnotation | null> {
  return apiGet<CardAnnotation | null>(`/annotations/${cardId}`);
}

export async function upsertAnnotation(cardId: string, note: string): Promise<CardAnnotation> {
  return apiPut<CardAnnotation>(`/annotations/${cardId}`, { note });
}

export async function deleteAnnotation(cardId: string): Promise<void> {
  await api.delete<ApiResponse<void>>(`/annotations/${cardId}`);
}

// ─── Double-or-Nothing Wagers ─────────────────────────────────

export interface WagerState {
  wageredCoins: number;
  cardIds: string[];
  cards?: Array<{
    id: string;
    deckId: string;
    question: string;
    options: Array<{ id: string; text: string; imageUrl?: string | null }>;
    explanation: string | null;
    imageUrl?: string | null;
    explanationImageUrl?: string | null;
  }>;
  correctCount: number;
  currentCardIndex: number;
  expiresAt: string;
}

export interface InitiateWagerResult {
  success: boolean;
  message?: string;
  wageredCoins?: number;
  newBalance?: number;
  cards?: Array<{
    id: string;
    deckId: string;
    question: string;
    options: Array<{ id: string; text: string; imageUrl?: string | null }>;
    explanation: string | null;
    imageUrl?: string | null;
    explanationImageUrl?: string | null;
  }>;
}

export interface SubmitWagerAnswerResult {
  correct: boolean;
  finished: boolean;
  won: boolean;
  reward?: number;
  newBalance?: number;
  nextCardIndex?: number;
  message?: string;
}

export async function fetchActiveWager(): Promise<WagerState | null> {
  return apiGet<WagerState | null>('/gamify/wager/active');
}

export async function initiateWager(wagerCoins: number, deckId?: string): Promise<InitiateWagerResult> {
  return apiPost<InitiateWagerResult>('/gamify/wager/initiate', { wagerCoins, deckId });
}

export async function submitWagerAnswer(cardId: string, selectedOptionId: string): Promise<SubmitWagerAnswerResult> {
  return apiPost<SubmitWagerAnswerResult>('/gamify/wager/submit', { cardId, selectedOptionId });
}
