// ─── @kd/db — Barrel Export ──────────────────────────────────
// Shared database layer for the QuantiPi platform.
// Both server-user and server-admin import from this package.
//
// Contains: database clients, repositories, services, jobs, and lib utilities.
// Does NOT contain Fastify-specific code (middleware, routes).

// ─── Database Clients ────────────────────────────────────────
export {
  getPostgresPool,
  getMongoClient,
  getMongoDb,
  getRedisClient,
  connectDatabases,
  disconnectDatabases,
} from './clients/database.js';

// ─── Config ──────────────────────────────────────────────────
export { config, validateConfig } from './config.js';
export type { Config } from './config.js';

// ─── Lib Utilities ───────────────────────────────────────────
export { logger, createServiceLogger, buildFastifyLoggerOptions } from './lib/logger.js';
export { CacheKey, CACHE_TTL, bustDeckCache, bustDeckCacheById } from './lib/cache.js';
export { withCronLock } from './lib/cron-lock.js';
export { getFirebaseAdmin } from './lib/firebase-admin.js';
export { generateAvatarPresignedUrl, generateAdminPresignedUrl } from './lib/storage.js';
export type { PresignedUploadResult } from './lib/storage.js';
export { getGeminiClient, geminiGenerate, geminiGenerateJSON } from './lib/gemini.js';

// ─── Repositories ────────────────────────────────────────────
export { userRepository } from './repositories/user.repository.js';
export {
  examRepository,
  deckRepository as contentDeckRepository,
  flashcardRepository as contentFlashcardRepository,
  questionRepository,
  subjectRepository as contentSubjectRepository,
  examSubjectRepository,
  topicRepository as contentTopicRepository,
} from './repositories/content.repository.js';
export { subjectRepository } from './repositories/subject.repository.js';
export { topicRepository } from './repositories/topic.repository.js';
export { deckRepository } from './repositories/deck.repository.js';
export { flashcardRepository } from './repositories/flashcard.repository.js';
export { progressRepository } from './repositories/progress.repository.js';
export { gamificationRepository } from './repositories/gamification.repository.js';
export { challengeRepository } from './repositories/challenge.repository.js';
export { coinPackRepository } from './repositories/coinpack.repository.js';
export { configRepository } from './repositories/config.repository.js';
export { couponRepository } from './repositories/coupon.repository.js';
export { paymentRepository } from './repositories/payment.repository.js';
export { planRepository } from './repositories/plan.repository.js';
export { subscriptionRepository } from './repositories/subscription.repository.js';
export { tournamentRepository } from './repositories/tournament.repository.js';
export { instituteRepository } from './repositories/institute.repository.js';
export { customTestRepository } from './repositories/custom-test.repository.js';
export { instituteMockTestRepository } from './repositories/institute-mocktest.repository.js';
export {
  adminExamRepository,
  adminExamSubjectRepository,
  adminDeckRepository,
  adminFlashcardRepository,
  adminBadgeRepository,
  adminShopItemRepository,
} from './repositories/admin.repository.js';

// ─── Services ────────────────────────────────────────────────
export { authService } from './services/auth.service.js';
export { analyticsService } from './services/analytics.service.js';
export { recommendationService, RecommendationService } from './services/ai.service.js';
export { subscriptionService } from './services/subscription.service.js';
export { paymentService } from './services/payment.service.js';
export { couponService } from './services/coupon.service.js';
export { emailService } from './services/email.service.js';
export { notificationService } from './services/notification.service.js';
export { friendService } from './services/friend.service.js';
export { challengeService } from './services/challenge.service.js';
export { rewardService } from './services/reward.service.js';
export { trialPassService } from './services/trialpass.service.js';
export { instituteService } from './services/institute.service.js';
export {
  publishScoreUpdate, onScoreUpdate,
  publishBadgeAwarded, onBadgeAwarded,
  publishChallengeLifecycle, onChallengeLifecycle,
  publishChallengeScore, onChallengeScore,
  disconnectRealtime,
} from './services/realtime.service.js';
export { selectAdaptiveOrder, updateKnowledgeModel } from './services/card-selector.js';
export { sm2, responseToQuality, INITIAL_EASE_FACTOR, estimateRetention } from './services/sm2.js';
export { bktUpdate, bktBatchUpdate, DEFAULT_BKT_PARAMS, informationGain, classifyMastery, buildConceptMastery } from './services/bkt.js';
export {
  estimateAbility, estimateDifficulty, difficultyMatchScore,
  adaptiveDifficultyScore, buildCardDifficulty, buildStudentAbility,
  updateCorrectRate,
} from './services/irt.js';
export { generateTargetedFeedback } from './services/targeted-feedback.service.js';
export { updateCardMemory, buildLearningProfile, backfillCardMemory } from './services/learning-intelligence.service.js';
export {
  getTopicConcepts, getPrerequisites, getStudyOrder, prerequisiteReadiness,
} from './services/knowledge-graph.service.js';

// ─── Jobs ────────────────────────────────────────────────────
export { expireSubscriptions } from './jobs/expire-subscriptions.js';
export { retryFailedPayments } from './jobs/retry-payments.js';
export { sendSubscriptionReminders } from './jobs/send-reminders.js';
export { expirePendingChallenges, finalizeAbandonedChallenges } from './jobs/expire-challenges.js';
export { completeTournaments } from './jobs/expire-tournaments.js';
export { runInstituteTestLifecycle } from './jobs/institute-test-lifecycle.js';
export { resetInstituteWeeklyLeaderboards } from './jobs/institute-leaderboard-reset.js';
