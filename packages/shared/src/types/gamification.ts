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
  | 'tournament_prize';

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
  auth0Id: string;     // Auth0 sub claim
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
