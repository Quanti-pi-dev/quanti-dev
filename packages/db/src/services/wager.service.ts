// ─── Double-or-Nothing Wager Service ──────────────────────────
// Psychology: Risk/Reward & Gamification (Skinner Box) — wagering
// earned coins on rapid-fire, high-difficulty questions.
//
// Users wager 5, 10, 20, or 25 coins. They must answer 3 random
// cards correctly in a row. If they succeed, they double their wager.
// If they miss a single question, the wager is lost.

import { ObjectId } from 'mongodb';
import { getRedisClient, getPostgresPool, getMongoDb } from '../clients/database.js';
import { gamificationRepository } from '../repositories/gamification.repository.js';
import { flashcardRepository } from '../repositories/flashcard.repository.js';
import { celebrationService } from './celebration.service.js';
import { createServiceLogger } from '../lib/logger.js';
import type { Flashcard } from '@kd/shared';

const log = createServiceLogger('WagerService');

export interface WagerState {
  wageredCoins: number;
  cardIds: string[];
  cards?: Omit<Flashcard, 'correctAnswerId'>[];
  correctCount: number;
  currentCardIndex: number;
  expiresAt: string;
}

export interface InitiateWagerResult {
  success: boolean;
  message?: string;
  wageredCoins?: number;
  newBalance?: number;
  cards?: Omit<Flashcard, 'correctAnswerId'>[];
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

class WagerService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  /**
   * Start a new wager.
   * Deducts the coins, queries 3 random challenging cards, and stores state in Redis.
   */
  async initiateWager(
    userId: string,
    wagerCoins: number,
    deckId?: string
  ): Promise<InitiateWagerResult> {
    // 1. Validate wager amount (cap at 25, only allow 5, 10, 20, 25)
    const allowedWagers = [5, 10, 20, 25];
    if (!allowedWagers.includes(wagerCoins)) {
      return { success: false, message: 'Invalid wager amount. Allowed: 5, 10, 20, or 25 coins.' };
    }

    // 2. Check balance
    const wallet = await gamificationRepository.getCoinBalance(userId);
    if (wallet.balance < wagerCoins) {
      return { success: false, message: 'Insufficient coin balance to place wager.' };
    }

    // 3. Check for existing active wager to prevent double-spending/abuse
    const activeKey = `active_wager:${userId}`;
    const existing = await this.redis.get(activeKey);
    if (existing) {
      return { success: false, message: 'You already have an active wager session. Finish or let it expire.' };
    }

    // 4. Fetch 3 random flashcards
    const db = getMongoDb();
    const matchFilter: Record<string, any> = {};
    if (deckId && ObjectId.isValid(deckId)) {
      matchFilter.deckId = new ObjectId(deckId);
    }

    // Attempt to get 3 random cards
    let docs = await db.collection('flashcards').aggregate([
      { $match: matchFilter },
      { $sample: { size: 3 } }
    ]).toArray();

    // Fallback: If specified deck has fewer than 3 cards, fetch from any deck
    if (docs.length < 3) {
      docs = await db.collection('flashcards').aggregate([
        { $sample: { size: 3 } }
      ]).toArray();
    }

    if (docs.length < 3) {
      return { success: false, message: 'Not enough flashcards in the system to start a wager.' };
    }

    const cards: Flashcard[] = docs.map((doc) => ({
      id: doc._id.toHexString(),
      deckId: doc.deckId ? doc.deckId.toHexString() : '',
      question: doc.question || '',
      options: doc.options || [],
      correctAnswerId: doc.correctAnswerId || '',
      explanation: doc.explanation || '',
      imageUrl: doc.imageUrl || null,
      source: doc.source || 'original',
      tags: doc.tags || [],
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    }));

    // 5. Spend coins atomically
    const spendResult = await gamificationRepository.spendCoins(userId, wagerCoins);
    if (!spendResult.success) {
      return { success: false, message: 'Coin deduction failed.' };
    }

    // Log the transaction in pg
    await this.recordTransaction(userId, -wagerCoins, 'wager_initiate', null);

    const safeCards = cards.map(({ correctAnswerId, ...rest }) => rest);

    const cardIds = cards.map((c) => c.id);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const wagerState: WagerState = {
      wageredCoins: wagerCoins,
      cardIds,
      cards: safeCards,
      correctCount: 0,
      currentCardIndex: 0,
      expiresAt,
    };

    await this.redis.set(activeKey, JSON.stringify(wagerState), 'EX', 600);

    return {
      success: true,
      wageredCoins: wagerCoins,
      newBalance: spendResult.balance.balance,
      cards: safeCards,
    };
  }

  /**
   * Submit an answer for the active wager card.
   */
  async submitWagerAnswer(
    userId: string,
    cardId: string,
    selectedOptionId: string
  ): Promise<SubmitWagerAnswerResult> {
    const activeKey = `active_wager:${userId}`;
    const rawState = await this.redis.get(activeKey);

    if (!rawState) {
      return { correct: false, finished: true, won: false, message: 'Wager session expired or not found.' };
    }

    const state: WagerState = JSON.parse(rawState);
    const { wageredCoins, cardIds, currentCardIndex } = state;

    // Verify current card
    const expectedCardId = cardIds[currentCardIndex];
    if (cardId !== expectedCardId) {
      return { correct: false, finished: false, won: false, message: 'Invalid card submitted for the current step.' };
    }

    // Check correctness
    const card = await flashcardRepository.findById(cardId);
    if (!card) {
      return { correct: false, finished: true, won: false, message: 'Flashcard not found in database.' };
    }

    const isCorrect = card.correctAnswerId === selectedOptionId;

    if (!isCorrect) {
      // Wager lost immediately
      await this.redis.del(activeKey);
      await this.recordTransaction(userId, 0, 'wager_loss', cardId); // logs that they finished the wager with a loss

      const wallet = await gamificationRepository.getCoinBalance(userId);
      return {
        correct: false,
        finished: true,
        won: false,
        newBalance: wallet.balance,
        message: `Incorrect answer. The correct answer was: ${(card.options?.find(o => o.id === card.correctAnswerId)?.text) || 'Option ' + card.correctAnswerId}`,
      };
    }

    // Correct answer
    const nextIndex = currentCardIndex + 1;

    if (nextIndex === 3) {
      // Wager Won! User gets double their wagered coins (net refund + win bonus)
      const rewardAmount = wageredCoins * 2;
      const creditResult = await gamificationRepository.creditCoins(userId, rewardAmount);

      // Record transaction
      await this.recordTransaction(userId, rewardAmount, 'wager_win', cardId);

      // Trigger Celebration sequence
      const celebrationSeq = celebrationService.buildLevelUnlockCelebration(
        '🎰 Double-or-Nothing',
        'Wager Quest',
        rewardAmount,
        'epic'
      );
      // Customise the celebration sequence for wager
      celebrationSeq.trigger = 'wager_win';
      celebrationSeq.steps = [
        {
          type: 'sound_effect',
          durationMs: 500,
          delayMs: 0,
          payload: { sound: 'wager_win', volume: 1.0 },
        },
        {
          type: 'stat_card',
          durationMs: 2500,
          delayMs: 200,
          payload: {
            stat: '🎰',
            label: 'DOUBLE-OR-NOTHING',
            message: `Perfect Streak! You doubled your coins!`,
          },
        },
        {
          type: 'confetti',
          durationMs: 3000,
          delayMs: 800,
          payload: {
            particleCount: 150,
            spread: 360,
            colors: ['#FFD700', '#10B981', '#3B82F6', '#8B5CF6'],
          },
        },
        {
          type: 'coin_shower',
          durationMs: 2000,
          delayMs: 1500,
          payload: {
            coinCount: rewardAmount,
            rarity: 'epic',
            message: `Double Win: +${rewardAmount} coins!`,
          },
        },
      ];
      
      // Save celebration in queue
      await this.redis.set(`celebration_queue:${userId}`, JSON.stringify(celebrationSeq));

      // Clean up active wager
      await this.redis.del(activeKey);

      return {
        correct: true,
        finished: true,
        won: true,
        reward: rewardAmount,
        newBalance: creditResult.balance,
      };
    }

    // Advance to next card
    state.correctCount += 1;
    state.currentCardIndex = nextIndex;
    await this.redis.set(activeKey, JSON.stringify(state), 'EX', 600);

    return {
      correct: true,
      finished: false,
      won: false,
      nextCardIndex: nextIndex,
    };
  }

  /**
   * Retrieve active wager status if exists.
   */
  async getActiveWager(userId: string): Promise<WagerState | null> {
    const raw = await this.redis.get(`active_wager:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as WagerState;
  }

  /**
   * Helper to write to Postgres coin_transactions
   */
  private async recordTransaction(
    userId: string,
    amount: number,
    reason: string,
    referenceId: string | null
  ): Promise<void> {
    try {
      await this.pg.query(
        `INSERT INTO coin_transactions (user_id, amount, reason, reference_id)
         SELECT id, $2, $3, $4 FROM users WHERE firebase_uid = $1`,
        [userId, amount, reason, referenceId]
      );
    } catch (err) {
      log.error({ userId, reason, err }, 'failed to record wager transaction');
    }
  }
}

export const wagerService = new WagerService();
