// ─── Logger ─────────────────────────────────────────────────
// Centralized Pino logger for use outside Fastify route handlers.
// Inside routes, prefer `request.log` for automatic request-id correlation.
//
// This module creates a standalone Pino instance with the same
// configuration as the Fastify server's built-in logger. Services,
// jobs, and startup code should import `logger` or create child
// loggers via `logger.child({ service: 'MyService' })`.

import pino from 'pino';

// Read env vars directly to avoid circular dependency with config.ts
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';
const NODE_ENV  = process.env['NODE_ENV']  ?? 'development';

// ─── Pretty Transport Options ───────────────────────────────
// Applied only outside production; production emits raw NDJSON
// for log aggregators (Datadog, Loki, CloudWatch, etc.).

const prettyOptions = {
  target: 'pino-pretty',
  options: {
    colorize:        true,
    translateTime:   'HH:MM:ss',
    ignore:          'pid,hostname',
    // Show the `service` binding after the level badge when present
    messageFormat:   '{msg}',
    // Custom level labels with icons — easier to scan at a glance
    customLevels:    '',
    customColors:    'fatal:bgRed,error:red,warn:yellow,info:cyan,debug:gray,trace:white',
    levelFirst:      false,
    singleLine:      false,
  },
};

export const logger = pino({
  level: LOG_LEVEL,
  transport: NODE_ENV !== 'production' ? prettyOptions : undefined,
  // Redact sensitive fields from structured context
  redact: {
    paths: ['password', 'token', 'secret', 'authorization'],
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger scoped to a service name.
 * Usage: `const log = createServiceLogger('NotificationService');`
 */
export function createServiceLogger(service: string) {
  return logger.child({ service });
}
