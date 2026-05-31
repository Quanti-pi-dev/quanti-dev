import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

import {
  config, validateConfig,
  buildFastifyLoggerOptions,
  connectDatabases, disconnectDatabases,
  disconnectRealtime,
  withCronLock,
  getRedisClient,
  tournamentRepository,
  expireSubscriptions,
  retryFailedPayments,
  sendSubscriptionReminders,
  expirePendingChallenges,
  finalizeAbandonedChallenges,
  completeTournaments,
  runSmartNudges,
} from '@kd/db';

import { authPlugin } from './middleware/auth.js';
import { errorHandlerPlugin } from './middleware/error-handler.js';
import { metricsPlugin } from './middleware/metrics.js';
import { requestLoggerPlugin } from './middleware/request-logger.js';

import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { contentRoutes } from './routes/content.routes.js';
import { progressRoutes } from './routes/progress.routes.js';
import { gamificationRoutes } from './routes/gamification.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { friendRoutes } from './routes/friend.routes.js';
import { challengeRoutes } from './routes/challenge.routes.js';
import { coinPackRoutes } from './routes/coinpack.routes.js';
import { publicConfigRoutes } from './routes/config.routes.js';
import { instituteStudentRoutes } from './routes/institute.routes.js';
import { instituteTestRoutes } from './routes/institute-tests.routes.js';
import { tournamentRoutes } from './routes/tournament.routes.js';
import { feedRoutes } from './routes/feed.routes.js';
import { microSessionRoutes } from './routes/micro-session.routes.js';
import { studyPactRoutes } from './routes/study-pact.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { userContentRoutes } from './routes/user-content.routes.js';

// ─── Fastify Instance ─────────────────────────────────────────

const server = Fastify({
  trustProxy: true,
  disableRequestLogging: true,
  logger: { ...buildFastifyLoggerOptions(), level: config.logLevel },
  genReqId: () => crypto.randomUUID(),
});

// ─── Plugins ──────────────────────────────────────────────────

async function registerPlugins() {
  await server.register(cors, { origin: config.cors.origin, credentials: true });
  await server.register(helmet, { contentSecurityPolicy: false });
  await server.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await server.register(sensible);
  await server.register(errorHandlerPlugin);
  await server.register(authPlugin);
  await server.register(metricsPlugin);
  await server.register(requestLoggerPlugin);
}

// ─── Routes ───────────────────────────────────────────────────

async function registerRoutes() {
  // Health checks (no auth)
  server.get('/health', async () => ({
    status: 'healthy',
    service: 'user-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  server.get('/health/detailed', async () => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    try {
      const start = Date.now();
      await getRedisClient().ping();
      checks['redis'] = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks['redis'] = { status: 'unhealthy', error: (err as Error).message };
    }

    try {
      const start = Date.now();
      const { getPostgresPool } = await import('@kd/db');
      await getPostgresPool().query('SELECT 1');
      checks['postgres'] = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks['postgres'] = { status: 'unhealthy', error: (err as Error).message };
    }

    try {
      const start = Date.now();
      const { getMongoDb } = await import('@kd/db');
      await getMongoDb().command({ ping: 1 });
      checks['mongodb'] = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks['mongodb'] = { status: 'unhealthy', error: (err as Error).message };
    }

    const overallHealthy = Object.values(checks).every(c => c.status === 'healthy');
    return {
      status: overallHealthy ? 'healthy' : 'degraded',
      service: 'user-api',
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Student routes
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(userRoutes, { prefix: '/api/v1/users' });
  await server.register(contentRoutes, { prefix: '/api/v1' });
  await server.register(progressRoutes, { prefix: '/api/v1/progress' });
  await server.register(gamificationRoutes, { prefix: '/api/v1/gamify' });
  await server.register(coinPackRoutes, { prefix: '/api/v1/gamify' });
  await server.register(aiRoutes, { prefix: '/api/v1/ai' });
  await server.register(publicConfigRoutes, { prefix: '/api/v1' });
  await server.register(subscriptionRoutes, { prefix: '/api/v1' });
  await server.register(webhookRoutes, { prefix: '/api/v1' });
  await server.register(friendRoutes, { prefix: '/api/v1' });
  await server.register(challengeRoutes, { prefix: '/api/v1' });
  await server.register(tournamentRoutes, { prefix: '/api/v1' });
  await server.register(instituteStudentRoutes, { prefix: '/api/v1' });
  await server.register(instituteTestRoutes,    { prefix: '/api/v1' });
  await server.register(feedRoutes,              { prefix: '/api/v1/feed' });
  await server.register(microSessionRoutes,      { prefix: '/api/v1/micro-session' });
  await server.register(studyPactRoutes,         { prefix: '/api/v1/study-pacts' });
  await server.register(profileRoutes,           { prefix: '/api/v1/profile' });
  // Content creation investment (Hook Model §4.2)
  // Personal decks, deck sharing, and card annotations
  await server.register(userContentRoutes,       { prefix: '/api/v1' });
}

// ─── Cron Jobs ────────────────────────────────────────────────

function startCronJobs() {
  const log = server.log;
  const locked = (name: string, ttlSec: number, job: () => Promise<void>) =>
    withCronLock(name, ttlSec, job, log);

  // Expire subscriptions — every 15 minutes
  setInterval(() => void locked('expire-subscriptions', 120,
    () => expireSubscriptions(log)), 15 * 60 * 1000);

  // Retry failed payments — every 6 hours
  setInterval(() => void locked('retry-payments', 300,
    () => retryFailedPayments(log)), 6 * 60 * 60 * 1000);

  // Send subscription reminders — every 24 hours, also on startup
  setInterval(() => void locked('send-reminders', 600,
    () => sendSubscriptionReminders(log)), 24 * 60 * 60 * 1000);
  void locked('send-reminders', 600, () => sendSubscriptionReminders(log));

  // Weekly leaderboard reset — Sunday midnight UTC
  const resetWeeklyLeaderboard = () => locked('weekly-leaderboard-reset', 60, async () => {
    await getRedisClient().del('leaderboard:weekly');
    log.info('Weekly leaderboard reset');
  });
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const nextSunday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday,
  ));
  const msUntilReset = Math.max(0, nextSunday.getTime() - now.getTime());
  if (msUntilReset === 0) {
    void resetWeeklyLeaderboard();
    setInterval(() => void resetWeeklyLeaderboard(), 7 * 24 * 60 * 60 * 1000);
  } else {
    setTimeout(() => {
      void resetWeeklyLeaderboard();
      setInterval(() => void resetWeeklyLeaderboard(), 7 * 24 * 60 * 60 * 1000);
    }, msUntilReset);
  }

  // P2P challenge cron jobs
  setInterval(() => void locked('expire-pending-challenges', 60,
    () => expirePendingChallenges(log)), 5 * 60 * 1000);
  setInterval(() => void locked('finalize-abandoned-challenges', 25,
    () => finalizeAbandonedChallenges(log)), 30 * 1000);

  // Tournament completion — every 5 minutes
  setInterval(() => void locked('complete-tournaments', 120,
    () => completeTournaments(log)), 5 * 60 * 1000);

  // Smart study nudges (behavioral psychology) — every 30 minutes
  // Scans user learning states and fires contextual push notifications:
  // streak-at-risk, knowledge decay, near-level-unlock, comeback.
  setInterval(() => void locked('smart-nudges', 120,
    () => runSmartNudges(log)), 30 * 60 * 1000);

  // Study pact evaluation — daily at midnight (check via hourly interval)
  setInterval(() => void locked('evaluate-pacts', 300, async () => {
    const { studyPactService } = await import('@kd/db');
    await studyPactService.evaluateActivePacts();
    log.info('Study pacts evaluated');
  }), 60 * 60 * 1000);

  // Flash event lifecycle — every 2 minutes (activate scheduled, expire completed)
  setInterval(() => void locked('flash-event-lifecycle', 30, async () => {
    const { flashEventService } = await import('@kd/db');
    await flashEventService.processEventLifecycle();
  }), 2 * 60 * 1000);

  // Weekly highlight reel — Sunday 7 PM (check hourly)
  setInterval(() => void locked('weekly-highlights', 3600, async () => {
    const nowCheck = new Date();
    if (nowCheck.getUTCDay() === 0 && nowCheck.getUTCHours() >= 19) {
      const { weeklyHighlightService } = await import('@kd/db');
      await weeklyHighlightService.generateAndSendHighlights();
      log.info('Weekly highlights generated');
    }
  }), 60 * 60 * 1000);

  log.info('Cron jobs scheduled');
}

// ─── Startup ──────────────────────────────────────────────────

async function start() {
  try {
    validateConfig();
    await registerPlugins();
    await registerRoutes();
    await connectDatabases(server.log);
    await tournamentRepository.ensureIndexes().catch(err =>
      server.log.error(err, 'tournament-indexes failed'));
    // Content creation investment: ensure MongoDB indexes for user decks
    // and card annotations (unique constraint on {userId, cardId}).
    await (async () => {
      try {
        const db = (await import('@kd/db')).getMongoDb();
        await Promise.all([
          // card_annotations: one note per user per card
          db.collection('card_annotations').createIndex(
            { userId: 1, cardId: 1 }, { unique: true, background: true },
          ),
          // user_decks: fast lookup by owner and shared recipients
          db.collection('user_decks').createIndex({ ownerId: 1 }, { background: true }),
          db.collection('user_decks').createIndex(
            { sharedWithUserIds: 1 }, { background: true },
          ),
          // user_deck_cards: ordered card list per deck
          db.collection('user_deck_cards').createIndex(
            { deckId: 1, order: 1 }, { background: true },
          ),
        ]);
      } catch (err) {
        server.log.error(err, 'user-content-indexes failed');
      }
    })();
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`🚀  User API listening on http://${config.host}:${config.port}  [${config.env}]`);
    startCronJobs();
  } catch (err) {
    server.log.fatal({ err }, 'FATAL STARTUP ERROR — exiting');
    process.exit(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────

const SHUTDOWN_TIMEOUT_MS = 10_000;
let isShuttingDown = false;

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  server.log.info(`Shutting down (exit ${exitCode})...`);

  const failsafe = setTimeout(() => {
    server.log.error('Graceful shutdown timed out — forcing exit');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);
  failsafe.unref();

  try {
    await server.close();
    await disconnectRealtime();
    await disconnectDatabases();
  } catch (err) {
    server.log.error(err, 'Error during graceful shutdown');
  }

  clearTimeout(failsafe);
  process.exit(exitCode);
}

process.on('uncaughtException', (err) => {
  server.log.fatal({ err }, 'UNCAUGHT EXCEPTION — shutting down gracefully');
  void shutdown(1);
});
process.on('unhandledRejection', (reason) => {
  server.log.fatal({ err: reason }, 'UNHANDLED REJECTION — shutting down gracefully');
  void shutdown(1);
});
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export async function build() {
  await registerPlugins();
  await registerRoutes();
  return server;
}

if (process.env['NODE_ENV'] !== 'test') {
  start();
}

export default server;
