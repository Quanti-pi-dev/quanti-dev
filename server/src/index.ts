import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

import { config, validateConfig } from './config.js';
import { buildFastifyLoggerOptions } from './lib/logger.js';
import { connectDatabases, disconnectDatabases } from './lib/database.js';
import { authPlugin } from './middleware/auth.js';
import { errorHandlerPlugin } from './middleware/error-handler.js';
import { metricsPlugin } from './middleware/metrics.js';
import { requestLoggerPlugin } from './middleware/request-logger.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { contentRoutes } from './routes/content.routes.js';
import { progressRoutes } from './routes/progress.routes.js';
import { gamificationRoutes } from './routes/gamification.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { subscriptionRoutes } from './routes/subscription.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { adminSubscriptionRoutes } from './routes/admin-subscription.routes.js';
import { expireSubscriptions } from './jobs/expire-subscriptions.js';
import { retryFailedPayments } from './jobs/retry-payments.js';
import { sendSubscriptionReminders } from './jobs/send-reminders.js';
import { expirePendingChallenges, finalizeAbandonedChallenges } from './jobs/expire-challenges.js';
import { completeTournaments } from './jobs/expire-tournaments.js';
import { disconnectRealtime } from './services/realtime.service.js';
import { friendRoutes } from './routes/friend.routes.js';
import { challengeRoutes } from './routes/challenge.routes.js';
import { publicConfigRoutes, adminConfigRoutes } from './routes/config.routes.js';
import { coinPackRoutes, adminCoinPackRoutes } from './routes/coinpack.routes.js';
import { tournamentRoutes, adminTournamentRoutes } from './routes/tournament.routes.js';
import { tournamentRepository } from './repositories/tournament.repository.js';
import { withCronLock } from './lib/cron-lock.js';

// ─── Fastify Instance ───────────────────────────────────────

const server = Fastify({
  trustProxy: true, // Crucial for Cloudflare to pass X-Forwarded-For IPs correctly
  // Suppress Fastify's built-in per-request noise — our requestLoggerPlugin
  // emits a single clean line per request instead.
  disableRequestLogging: true,
  logger: { ...buildFastifyLoggerOptions(), level: config.logLevel },
  genReqId: () => crypto.randomUUID(),
});

// ─── Plugins ────────────────────────────────────────────────

async function registerPlugins() {
  // Security & utilities
  await server.register(cors, { origin: config.cors.origin, credentials: true });
  await server.register(helmet, { contentSecurityPolicy: false });
  await server.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await server.register(sensible);

  // Custom middleware
  await server.register(errorHandlerPlugin);
  await server.register(authPlugin);
  await server.register(metricsPlugin);
  await server.register(requestLoggerPlugin);
}

// ─── Routes ─────────────────────────────────────────────────

async function registerRoutes() {
  // Health check (no auth) — lightweight for load balancers
  server.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Detailed health check — verifies database connectivity
  server.get('/health/detailed', async () => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // Redis
    try {
      const start = Date.now();
      const { getRedisClient } = await import('./lib/database.js');
      await getRedisClient().ping();
      checks['redis'] = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks['redis'] = { status: 'unhealthy', error: (err as Error).message };
    }

    // PostgreSQL
    try {
      const start = Date.now();
      const { getPostgresPool } = await import('./lib/database.js');
      await getPostgresPool().query('SELECT 1');
      checks['postgres'] = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks['postgres'] = { status: 'unhealthy', error: (err as Error).message };
    }

    // MongoDB
    try {
      const start = Date.now();
      const { getMongoDb } = await import('./lib/database.js');
      await getMongoDb().command({ ping: 1 });
      checks['mongodb'] = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks['mongodb'] = { status: 'unhealthy', error: (err as Error).message };
    }

    const overallHealthy = Object.values(checks).every(c => c.status === 'healthy');

    return {
      status: overallHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // API v1 — Student routes
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(userRoutes, { prefix: '/api/v1/users' });
  await server.register(contentRoutes, { prefix: '/api/v1' });
  await server.register(progressRoutes, { prefix: '/api/v1/progress' });
  await server.register(gamificationRoutes, { prefix: '/api/v1/gamify' });
  await server.register(coinPackRoutes, { prefix: '/api/v1/gamify' });
  await server.register(aiRoutes, { prefix: '/api/v1/ai' });

  // Platform config (public, cached)
  await server.register(publicConfigRoutes, { prefix: '/api/v1' });

  // Subscription & payment routes (user-facing)
  await server.register(subscriptionRoutes, { prefix: '/api/v1' });

  // Razorpay webhooks (no auth prefix — uses signature verification)
  await server.register(webhookRoutes, { prefix: '/api/v1' });

  // API Admin — Admin-only routes
  await server.register(adminRoutes, { prefix: '/api/admin' });
  await server.register(adminSubscriptionRoutes, { prefix: '/api/admin' });
  await server.register(adminConfigRoutes, { prefix: '/api/admin' });
  await server.register(adminCoinPackRoutes, { prefix: '/api/admin' });

  // P2P Challenge & Friends
  await server.register(friendRoutes, { prefix: '/api/v1' });
  await server.register(challengeRoutes, { prefix: '/api/v1' });

  // Tournaments
  await server.register(tournamentRoutes, { prefix: '/api/v1' });
  await server.register(adminTournamentRoutes, { prefix: '/api/admin' });
}

// ─── Startup ────────────────────────────────────────────────

// ─── Cron Scheduler ─────────────────────────────────────────

function startCronJobs() {
  const log = server.log;

  // ─── Helper: wrap a cron in a distributed Redis lock ────
  // TTL (seconds) should exceed the job's max expected runtime.
  const locked = (name: string, ttlSec: number, job: () => Promise<void>) =>
    withCronLock(name, ttlSec, job, log);

  // Expire subscriptions every 15 minutes (lock: 120s)
  setInterval(() => void locked('expire-subscriptions', 120,
    () => expireSubscriptions(log)), 15 * 60 * 1000);

  // Retry failed payments every 6 hours (lock: 300s)
  setInterval(() => void locked('retry-payments', 300,
    () => retryFailedPayments(log)), 6 * 60 * 60 * 1000);

  // Send subscription reminders every 24 hours (lock: 600s)
  setInterval(() => void locked('send-reminders', 600,
    () => sendSubscriptionReminders(log)), 24 * 60 * 60 * 1000);
  // Run once immediately on startup (catches overnight events)
  void locked('send-reminders', 600,
    () => sendSubscriptionReminders(log));

  // Reset weekly leaderboard every Sunday at midnight UTC
  const resetWeeklyLeaderboard = () => locked('weekly-leaderboard-reset', 60, async () => {
    const { getRedisClient } = await import('./lib/database.js');
    await getRedisClient().del('leaderboard:weekly');
    log.info('Weekly leaderboard reset');
  });
  // Calculate ms until next Sunday midnight UTC, then repeat weekly
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  // If today is Sunday, target today's midnight; if already past midnight, fire immediately
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const nextSunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday, 0, 0, 0));
  const msUntilReset = Math.max(0, nextSunday.getTime() - now.getTime());
  if (msUntilReset === 0) {
    // It's Sunday and past midnight — reset now, then weekly
    void resetWeeklyLeaderboard();
    setInterval(() => void resetWeeklyLeaderboard(), 7 * 24 * 60 * 60 * 1000);
  } else {
    setTimeout(() => {
      void resetWeeklyLeaderboard();
      setInterval(() => void resetWeeklyLeaderboard(), 7 * 24 * 60 * 60 * 1000);
    }, msUntilReset);
  }

  log.info('Cron jobs scheduled');

  // P2P Challenge cron jobs
  setInterval(() => void locked('expire-pending-challenges', 60,
    () => expirePendingChallenges(log)), 5 * 60 * 1000);
  setInterval(() => void locked('finalize-abandoned-challenges', 25,
    () => finalizeAbandonedChallenges(log)), 30 * 1000);

  // Tournament completion cron — every 5 minutes (lock: 120s)
  setInterval(() => void locked('complete-tournaments', 120,
    () => completeTournaments(log)), 5 * 60 * 1000);
}

async function start() {
  try {
    validateConfig();
    await registerPlugins();
    await registerRoutes();
    await connectDatabases(server.log);
    // Ensure MongoDB indexes exist
    await tournamentRepository.ensureIndexes().catch(err => server.log.error(err, 'tournament-indexes failed'));
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`🚀  Listening on http://${config.host}:${config.port}  [${config.env}]`);
    startCronJobs();
  } catch (err) {
    server.log.fatal({ err }, 'FATAL STARTUP ERROR — exiting');
    process.exit(1);
  }
}

// ─── Graceful Shutdown ──────────────────────────────────────
// Includes a fail-safe timeout: if connections hang during teardown
// the process still exits after SHUTDOWN_TIMEOUT_MS so the
// orchestrator (Render / k8s) can restart a fresh instance.

const SHUTDOWN_TIMEOUT_MS = 10_000;
let isShuttingDown = false;

async function shutdown(exitCode = 0) {
  // Prevent re-entrant calls (e.g. SIGTERM during error handler)
  if (isShuttingDown) return;
  isShuttingDown = true;

  server.log.info(`Shutting down (exit ${exitCode})...`);

  // Fail-safe: force-kill if graceful teardown stalls
  const failsafe = setTimeout(() => {
    server.log.error('Graceful shutdown timed out — forcing exit');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);
  failsafe.unref(); // Don't let this timer keep the event loop alive

  try {
    await server.close();          // drain in-flight HTTP requests
    await disconnectRealtime();    // close WebSocket sessions
    await disconnectDatabases();   // release PG pool, Mongo, Redis
  } catch (err) {
    server.log.error(err, 'Error during graceful shutdown');
  }

  clearTimeout(failsafe);
  process.exit(exitCode);
}

// ─── Last-Resort Process Error Handlers ─────────────────────
// These catch fatal errors that escape every other layer (route
// handlers, services, cron callbacks). Without them, the process
// dies silently with no telemetry.
//
// Instead of a crude setTimeout+exit, we invoke the full graceful
// shutdown sequence so active connections are drained, Postgres
// transactions are released, and WebSockets cleanly disconnect.

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

if (process.env.NODE_ENV !== 'test') {
  start();
}

export default server;
