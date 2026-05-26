import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

import {
  config, validateConfig,
  buildFastifyLoggerOptions,
  connectDatabases, disconnectDatabases,
  getRedisClient, getMongoDb, getPostgresPool,
  tournamentRepository,
} from '@kd/db';

import { adminAuthPlugin } from './middleware/auth.js';
import { errorHandlerPlugin } from './middleware/error-handler.js';
import { metricsPlugin } from './middleware/metrics.js';
import { requestLoggerPlugin } from './middleware/request-logger.js';

import { adminRoutes } from './routes/admin.routes.js';

import { adminSubscriptionRoutes } from './routes/admin-subscription.routes.js';
import { adminConfigRoutes } from './routes/config.routes.js';
import { adminCoinPackRoutes } from './routes/coinpack.routes.js';
import { adminTournamentRoutes } from './routes/tournament.routes.js';
import { adminInstituteRoutes } from './routes/admin-institute.routes.js';
import { adminNotificationRoutes } from './routes/admin-notifications.routes.js';
import { adminChallengeRoutes }    from './routes/admin-challenges.routes.js';
import { adminGamificationRoutes } from './routes/admin-gamification.routes.js';

// ─── Fastify Instance ─────────────────────────────────────────

const server = Fastify({
  trustProxy: true,
  disableRequestLogging: true,
  // Admin API port defaults to 3001 to avoid conflict with user API in dev
  logger: { ...buildFastifyLoggerOptions(), level: config.logLevel },
  genReqId: () => crypto.randomUUID(),
});

// ─── Plugins ──────────────────────────────────────────────────

async function registerPlugins() {
  // Admin API allows requests from the admin web app origin
  const adminOrigin = process.env['ADMIN_WEB_ORIGIN'] ?? config.cors.origin;
  await server.register(cors, { origin: adminOrigin, credentials: true });
  await server.register(helmet, { contentSecurityPolicy: false });
  // Higher rate limit — admin performs bulk operations
  await server.register(rateLimit, { max: 500, timeWindow: '1 minute' });
  await server.register(sensible);
  await server.register(errorHandlerPlugin);
  // Admin auth: rejects all non-admin tokens before routes are reached
  await server.register(adminAuthPlugin);
  await server.register(metricsPlugin);
  await server.register(requestLoggerPlugin);
}

// ─── Routes ───────────────────────────────────────────────────

async function registerRoutes() {
  // Health checks (only unprotected paths on the Admin API)
  server.get('/health', async () => ({
    status: 'healthy',
    service: 'admin-api',
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
      await getPostgresPool().query('SELECT 1');
      checks['postgres'] = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks['postgres'] = { status: 'unhealthy', error: (err as Error).message };
    }

    try {
      const start = Date.now();
      await getMongoDb().command({ ping: 1 });
      checks['mongodb'] = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks['mongodb'] = { status: 'unhealthy', error: (err as Error).message };
    }

    const overallHealthy = Object.values(checks).every(c => c.status === 'healthy');
    return {
      status: overallHealthy ? 'healthy' : 'degraded',
      service: 'admin-api',
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Admin routes — all require admin role (enforced at auth plugin level)
  await server.register(adminRoutes,             { prefix: '/api/admin' });

  await server.register(adminSubscriptionRoutes, { prefix: '/api/admin' });
  await server.register(adminConfigRoutes,       { prefix: '/api/admin' });
  await server.register(adminCoinPackRoutes,     { prefix: '/api/admin' });
  await server.register(adminTournamentRoutes,   { prefix: '/api/admin' });
  await server.register(adminInstituteRoutes,    { prefix: '/api/admin' });
  await server.register(adminNotificationRoutes, { prefix: '/api/admin' });
  await server.register(adminChallengeRoutes,    { prefix: '/api/admin' });
  await server.register(adminGamificationRoutes, { prefix: '/api/admin' });
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

    const port = Number(process.env['PORT'] ?? 3001);
    await server.listen({ port, host: config.host });
    server.log.info(`🔐  Admin API listening on http://${config.host}:${port}  [${config.env}]`);
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
