// ─── Logger ─────────────────────────────────────────────────
// Centralized Pino logger for use outside Fastify route handlers.
// Inside routes, prefer `request.log` for automatic request-id correlation.
//
// This module creates a standalone Pino instance with the same
// configuration as the Fastify server's built-in logger. Services,
// jobs, and startup code should import `logger` or create child
// loggers via `logger.child({ service: 'MyService' })`.
//
// FIX A7 — Replace console.* with structured logging.

import pino from 'pino';

// Read env vars directly to avoid circular dependency with config.ts
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

export const logger = pino({
  level: LOG_LEVEL,
  transport:
    NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
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
