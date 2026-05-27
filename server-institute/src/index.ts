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
  withCronLock,
  customTestRepository, instituteMockTestRepository,
  runInstituteTestLifecycle,
  resetInstituteWeeklyLeaderboards,
} from '@kd/db';

import { instituteAuthPlugin } from './middleware/auth.js';
import { errorHandlerPlugin } from './middleware/error-handler.js';
import { metricsPlugin } from './middleware/metrics.js';
import { requestLoggerPlugin } from './middleware/request-logger.js';

import { instituteMgmtRoutes } from './routes/institute.routes.js';
import { instituteLeaderboardRoutes } from './routes/leaderboard.routes.js';
import { customTestRoutes } from './routes/custom-test.routes.js';
import { mockTestRoutes } from './routes/mock-test.routes.js';
import { studentProgressRoutes } from './routes/student-progress.routes.js';
import { instituteAIRoutes } from './routes/institute-ai.routes.js';

// ─── Fastify Instance ─────────────────────────────────────────────

const server = Fastify({
  trustProxy: true,
  disableRequestLogging: true,
  logger: { ...buildFastifyLoggerOptions(), level: config.logLevel },
  genReqId: () => crypto.randomUUID(),
});

// ─── Plugins ──────────────────────────────────────────────────────

async function registerPlugins() {
  // Institute API allows requests from the institute web app origin (supports comma-separated list)
  const rawInstOrigin = process.env['INSTITUTE_WEB_ORIGIN'] ?? config.cors.origin;
  const instituteWebOrigin = rawInstOrigin.includes(',')
    ? rawInstOrigin.split(',').map((o: string) => o.trim())
    : rawInstOrigin;
  await server.register(cors, { origin: instituteWebOrigin, credentials: true });
  await server.register(helmet, { contentSecurityPolicy: false });
  // Moderate rate limit — staff operations
  await server.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await server.register(sensible);
  await server.register(errorHandlerPlugin);
  await server.register(instituteAuthPlugin);
  await server.register(metricsPlugin);
  await server.register(requestLoggerPlugin);
}

// ─── Routes ───────────────────────────────────────────────────────

async function registerRoutes() {
  server.get('/health', async () => ({
    status: 'healthy',
    service: 'institute-api',
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
      service: 'institute-api',
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Institute API routes — all under /api/inst/v1
  await server.register(instituteMgmtRoutes,        { prefix: '/api/inst/v1' });
  await server.register(instituteLeaderboardRoutes, { prefix: '/api/inst/v1' });
  await server.register(customTestRoutes,           { prefix: '/api/inst/v1' });
  await server.register(mockTestRoutes,             { prefix: '/api/inst/v1' });
  await server.register(studentProgressRoutes,      { prefix: '/api/inst/v1' });
  await server.register(instituteAIRoutes,           { prefix: '/api/inst/v1' });
}

// ─── Startup ──────────────────────────────────────────────────────

async function start() {
  try {
    validateConfig();
    await registerPlugins();
    await registerRoutes();
    await connectDatabases(server.log);

    // Ensure MongoDB indexes for institute collections
    await Promise.allSettled([
      customTestRepository.ensureIndexes(),
      instituteMockTestRepository.ensureIndexes(),
    ]);

    const port = Number(process.env['PORT'] ?? 3002);
    await server.listen({ port, host: config.host });
    server.log.info(`🏫  Institute API listening on http://${config.host}:${port}  [${config.env}]`);
    startCronJobs();
  } catch (err) {
    server.log.fatal({ err }, 'FATAL STARTUP ERROR — exiting');
    process.exit(1);
  }
}

// ─── Cron Jobs ────────────────────────────────────────────

function startCronJobs() {
  const log = server.log;
  const locked = (name: string, ttlSec: number, job: () => Promise<void>) =>
    withCronLock(name, ttlSec, job, log);

  // Institute test lifecycle (scheduled → live → closed) — every 5 minutes
  setInterval(
    () => void locked('institute-test-lifecycle', 240, () => runInstituteTestLifecycle(log)),
    5 * 60 * 1000,
  );
  // Also run immediately on startup to catch any missed transitions
  void locked('institute-test-lifecycle', 240, () => runInstituteTestLifecycle(log));

  // Weekly institute leaderboard reset — Sunday midnight UTC
  const scheduleWeeklyReset = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek; // next Sunday (not today)
    const nextSunday = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday,
    ));
    const msUntil = nextSunday.getTime() - now.getTime();
    setTimeout(() => {
      void locked('institute-weekly-leaderboard-reset', 60,
        () => resetInstituteWeeklyLeaderboards(log));
      setInterval(
        () => void locked('institute-weekly-leaderboard-reset', 60,
          () => resetInstituteWeeklyLeaderboards(log)),
        7 * 24 * 60 * 60 * 1000,
      );
    }, msUntil);
  };
  scheduleWeeklyReset();

  log.info('Institute cron jobs scheduled');
}

// ─── Graceful Shutdown ────────────────────────────────────────────

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
