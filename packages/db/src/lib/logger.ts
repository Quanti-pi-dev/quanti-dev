// ─── Logger ─────────────────────────────────────────────────
// Centralized Pino logger for use outside Fastify route handlers.
// Inside routes, prefer `request.log` for automatic request-id correlation.
//
// Environments:
//   development / test → pino-pretty (colourized, human-readable)
//   production         → raw NDJSON  (parseable by Datadog / Loki / CloudWatch)
//
// Usage:
//   import { createServiceLogger } from './logger.js';
//   const log = createServiceLogger('MyService');
//   log.info({ userId }, 'User signed in');

import pino, { type LoggerOptions } from 'pino';

// Read env vars directly to avoid circular dependency with config.ts
const LOG_LEVEL  = process.env['LOG_LEVEL'] ?? 'info';
const IS_PROD    = process.env['NODE_ENV'] === 'production';

// ─── Shared redact list ──────────────────────────────────────
// Applied to both the standalone logger and the Fastify instance.
// Prevents secrets appearing in logs even if accidentally included
// in structured context objects.

const REDACT_PATHS = [
  'password', 'token', 'secret', 'authorization',
  'email',                        // PII — redact in prod log lines
  '*.email',                      // nested objects
  'razorpaySubscriptionId',
  'razorpay_subscription_id',
  '*.razorpay_subscription_id',
  'apiKey', 'api_key',
];

// ─── Transport config ────────────────────────────────────────
// dev/test → pino-pretty (colorised, human-readable terminal output)
// production → no transport (raw NDJSON — let the aggregator handle it)

const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize:      true,
    translateTime: 'SYS:standard',
    ignore:        'pid,hostname',
    messageFormat: '{if service}[{service}] {end}{msg}',
    customColors:  'fatal:bgRed,error:red,warn:yellow,info:cyan,debug:gray,trace:white',
    levelFirst:    false,
    singleLine:    false,
  },
};

// ─── Error serializer ────────────────────────────────────────
// Pino by default serializes Error objects as `{}`.
// This serializer captures message + stack so errors are always
// visible as structured fields, not silent empty objects.

const serializers = {
  err: pino.stdSerializers.err,
  error: pino.stdSerializers.err,
};

// ─── Shared options ──────────────────────────────────────────

const baseOptions: LoggerOptions = {
  level:       LOG_LEVEL,
  serializers,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  ...(!IS_PROD && { transport: devTransport }),
};

// ─── Standalone logger (services, jobs, scripts) ─────────────

export const logger = pino(baseOptions);

// ─── Fastify logger options ──────────────────────────────────
// Call this in Fastify({ logger: buildFastifyLoggerOptions() })
// instead of duplicating the pino config inline.

export function buildFastifyLoggerOptions(): LoggerOptions {
  return {
    ...baseOptions,
    // Fastify adds reqId, req, res fields — suppress the raw ones
    // since our requestLoggerPlugin emits a cleaner single line.
    ...(!IS_PROD && {
      transport: {
        ...devTransport,
        options: {
          ...devTransport.options,
          ignore: 'pid,hostname,reqId,responseTime,req,res',
        },
      },
    }),
  };
}

/**
 * Create a child logger scoped to a named service.
 * The `service` field is automatically included in every log line.
 *
 * @example
 *   const log = createServiceLogger('PaymentService');
 *   log.info({ userId, amountPaise }, 'Payment captured');
 */
export function createServiceLogger(service: string) {
  return logger.child({ service });
}

