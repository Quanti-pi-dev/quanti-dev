// ─── Cache Key Utilities ─────────────────────────────────────
// Centralized cache key builders and invalidation helpers.
// Import this instead of hand-rolling key strings.

import { getRedisClient } from '../clients/database.js';

// ─── TTLs ────────────────────────────────────────────────────

export const CACHE_TTL = {
  DECK: 300,        // 5 minutes — deck metadata changes rarely
  EXAM: 300,        // 5 minutes
  CONFIG: 600,      // 10 minutes
} as const;

// ─── Key Builders ────────────────────────────────────────────

export const CacheKey = {
  /** Deck by ID: `cache:deck:{id}` */
  deck: (id: string) => `cache:deck:${id}`,

  /**
   * Hierarchy-scoped deck: `cache:deck:hierarchy:{examId}:{subjectId}:{topicSlug}:{level}`
   * This is the canonical key for the exam-scoped architecture.
   */
  deckHierarchy: (examId: string, subjectId: string, topicSlug: string, level: string) =>
    `cache:deck:hierarchy:${examId}:${subjectId}:${topicSlug}:${level}`,

  /** Exam by ID: `cache:exam:{id}` */
  exam: (id: string) => `cache:exam:${id}`,
};

// ─── Deck Cache Invalidation ─────────────────────────────────

/** Deck shape needed to compute all associated cache keys. */
interface DeckCacheMeta {
  id: string;
  examId?: string | null;
  subjectId?: string | null;
  topicSlug?: string | null;
  level?: string | null;
}

/**
 * Bust all cache keys associated with a deck.
 * Deletes: `cache:deck:{id}` and hierarchy key (if available).
 * Uses Redis UNLINK for non-blocking deletes.
 */
export async function bustDeckCache(deck: DeckCacheMeta): Promise<void> {
  const redis = getRedisClient();
  const keys: string[] = [CacheKey.deck(deck.id)];

  // Bust hierarchy key if we have all 4 components
  if (deck.examId && deck.subjectId && deck.topicSlug && deck.level) {
    keys.push(CacheKey.deckHierarchy(deck.examId, deck.subjectId, deck.topicSlug, deck.level));
  }

  // UNLINK is async-delete (non-blocking), preferred over DEL for cache busting
  await redis.unlink(...keys);
}

/**
 * Bust all cache keys for a deck when you only have the ID.
 * Fetches the deck metadata first; use `bustDeckCache` directly when you already have it.
 */
export async function bustDeckCacheById(
  deckId: string,
  fetchMeta: (id: string) => Promise<DeckCacheMeta | null>,
): Promise<void> {
  const deck = await fetchMeta(deckId);
  if (!deck) {
    // At minimum, bust the ID key
    await getRedisClient().unlink(CacheKey.deck(deckId));
    return;
  }
  await bustDeckCache(deck);
}
