// ─── Gamification ───────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  criteria: string;
  createdAt: string;
}

export interface UserBadge {
  badgeId: string;
  badge: Badge;
  earnedAt: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number; // in coins
  /** Phase 2: flashcard_pack, theme, and power_up (consumables). */
  category: 'flashcard_pack' | 'theme' | 'power_up';
  isAvailable: boolean;
  createdAt: string;
  // flashcard_pack extras
  deckId?: string | null;
  cardCount?: number | null;
  // theme extras
  themeKey?: string | null;
}

export interface PurchaseEffect {
  type: 'flashcard_pack' | 'theme' | 'power_up';
  /** deckId for flashcard_pack, themeKey for theme, item key for power_up */
  value: string;
}

export interface CoinBalance {
  userId: string;
  balance: number;
  lifetimeEarned: number;
}

export type CoinTransactionReason =
  | 'correct_answer'
  | 'level_unlock'
  | 'master_level_completed'
  | 'perfect_session'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'shop_purchase'
  // P2P Challenge coin events
  | 'challenge_escrow'
  | 'challenge_won'
  | 'challenge_refund_tie'
  | 'challenge_refund_declined'
  | 'challenge_refund_cancelled'
  | 'challenge_refund_expired'
  // Coin pack IAP
  | 'coin_pack_purchase'
  | 'custom_coin_purchase'
  // Consumable power-ups
  | 'streak_freeze_purchase'
  // Tournament coin events
  | 'tournament_entry'
  | 'tournament_refund'
  | 'tournament_prize'
  // Variable reward system
  | 'daily_chest';

export interface CoinTransaction {
  id: string;
  userId: string;
  /** Positive = earned, negative = spent */
  amount: number;
  reason: CoinTransactionReason | string;
  referenceId: string | null;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  totalParticipants: number;
  updatedAt: string;
}

export interface Reward {
  id: string;
  type: 'coins' | 'badge' | 'shop_item';
  amount: number | null;
  badgeId: string | null;
  itemId: string | null;
  reason: string;
  awardedAt: string;
}

// ─── P2P Challenges ─────────────────────────────────────────

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export type ChallengeStatus =
  | 'pending'
  | 'accepted'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'expired';

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;          // PostgreSQL UUID
  firebaseUid: string;     // Firebase UID
  displayName: string;
  avatarUrl: string | null;
  enrollmentId: string; // Unique human-readable ID (e.g. QP-8F2A9C)
}

export interface Challenge {
  id: string;
  creatorId: string;
  opponentId: string;
  deckId: string;
  examId: string;
  subjectId: string;
  level: string;
  betAmount: number;
  durationSeconds: number;
  status: ChallengeStatus;
  creatorScore: number;
  opponentScore: number;
  winnerId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeDetail extends Challenge {
  creatorName: string;
  opponentName: string;
  examName?: string;
  subjectName?: string;
}

export interface AnswerResult {
  yourScore: number;
  opponentScore: number;
  timeRemainingMs: number;
}

// ─── Variable Reward System (Behavioral Psychology Layer) ────

/** Drop rarity — controls celebration animation intensity on mobile. */
export type CoinDropRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Attached to each correct-answer response so the client knows how to celebrate. */
export interface VariableRewardInfo {
  /** Drop rarity tier */
  rarity: CoinDropRarity;
  /** Multiplier applied to base coin value (1, 3, 5, or 10) */
  multiplier: number;
  /** True if an active boost (daily chest, flash event) amplified this drop */
  boosted: boolean;
}

/** Near-miss celebration — surface "so close!" moments to drive continued play. */
export interface NearMiss {
  type: 'level_unlock' | 'streak_milestone' | 'perfect_accuracy';
  /** Human-readable celebration message (with emoji) */
  message: string;
  /** How close to the goal (0-100%) — controls animation intensity */
  proximity: number;
}

/** Daily bonus chest tiers. */
export type ChestTier = 'bronze' | 'silver' | 'gold';

/** Response when opening the daily bonus chest. */
export interface DailyChestResult {
  opened: boolean;
  tier: ChestTier;
  coinsAwarded: number;
  multiplierGranted: number | null;
  multiplierDurationMinutes: number | null;
}

// ─── Social Activity Feed ───────────────────────────────────

export type FeedEventType =
  | 'streak_milestone'
  | 'level_unlocked'
  | 'challenge_won'
  | 'perfect_session'
  | 'coins_legendary_drop'
  | 'badge_earned'
  | 'exam_readiness'
  | 'comeback';

/** A single event in the friend activity feed. */
export interface FeedEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  type: FeedEventType;
  message: string;
  metadata: Record<string, string>;
  timestamp: string;
}

// ─── Insight Reveals ────────────────────────────────────────

export type InsightCategory = 'comparative' | 'temporal' | 'achievement' | 'predictive' | 'behavioral';

/** A personalized "quantified self" insight surfaced periodically. */
export interface InsightReveal {
  id: string;
  category: InsightCategory;
  emoji: string;
  message: string;
  value?: number;
  unit?: string;
}

// ─── Micro Session ("Just 3 Cards") ─────────────────────────

/** Card selection reason — explains why this card was picked. */
export type MicroCardReason = 'overdue_review' | 'near_unlock' | 'error_retry' | 'keep_fresh';

/** A card in a micro-session pack. */
export interface MicroCard {
  cardId: string;
  question: string;
  answers: { id: string; text: string }[];
  correctAnswerId: string;
  topicSlug: string;
  subjectId: string;
  examId: string;
  level: string;
  selectionReason: MicroCardReason;
}

/** Response for the "Just 3 Cards" micro-session endpoint. */
export interface MicroSessionPack {
  cards: MicroCard[];
  hook: string;
  estimatedSeconds: number;
  benefit: string;
}

// ─── Phase 3: Deep Engagement Types ─────────────────────────

/** Study Pact duration options (days). */
export type PactDuration = 3 | 7 | 14;

/** Study pact member progress snapshot. */
export interface PactMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  daysCompleted: number;
  totalDays: number;
  todayCards: number;
  metToday: boolean;
  completionRate: number;
}

/** Social accountability study pact. */
export interface StudyPact {
  id: string;
  creatorId: string;
  name: string;
  dailyTarget: number;
  durationDays: PactDuration;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'failed';
  completionBonus: number;
  perfectBonus: number;
  members: PactMember[];
  createdAt: string;
}

/** Flash event type identifiers. */
export type FlashEventType = 'subject_boost' | 'global_boost' | 'speed_challenge' | 'community_goal';

/** Time-limited flash event. */
export interface FlashEvent {
  id: string;
  type: FlashEventType;
  name: string;
  description: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  subjectId: string | null;
  communityProgress?: number;
  communityTarget?: number;
}

/** Profile tier in the progressive unlock system. */
export interface ProfileTier {
  name: string;
  minDays: number;
  features: string[];
  icon: string;
  unlocked: boolean;
  unlocksAt?: string;
  daysUntilUnlock?: number;
}

/** Profile unlock status response. */
export interface ProfileUnlockStatus {
  accountAgeDays: number;
  currentTier: string;
  tiers: ProfileTier[];
  unlockedFeatures: string[];
  nextUnlock: ProfileTier | null;
  newUnlock: boolean;
}

/** Weekly highlight reel summary. */
export interface WeeklyHighlight {
  userId: string;
  weekStarting: string;
  totalAnswers: number;
  correctAnswers: number;
  accuracy: number;
  totalSessions: number;
  totalMinutes: number;
  coinsEarned: number;
  currentStreak: number;
  friendsBeaten: number;
  conceptsMastered: number;
  headlineStat: string;
  funFact: string;
  shareText: string;
}

/** Celebration step type → client animation mapping. */
export type CelebrationStepType =
  | 'confetti'
  | 'badge_reveal'
  | 'coin_shower'
  | 'stat_card'
  | 'social_card'
  | 'streak_fire'
  | 'level_up'
  | 'sound_effect';

/** One step in a multi-stage celebration cascade. */
export interface CelebrationStep {
  type: CelebrationStepType;
  durationMs: number;
  delayMs: number;
  payload: Record<string, unknown>;
}

/** Multi-stage celebration sequence (Peak-End Rule). */
export interface CelebrationSequence {
  trigger: string;
  steps: CelebrationStep[];
  totalDurationMs: number;
  shareToFeed: boolean;
}
