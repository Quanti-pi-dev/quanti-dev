// ─── Request Logger Plugin ──────────────────────────────────
// Emits a single, human-readable log line per HTTP request.
// Format:  METHOD /path → STATUS in Xms  [userId]
//
// Uses log level based on status code so errors surface visually:
//   ≥500 → error  |  ≥400 → warn  |  otherwise → info

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ─── Helpers ────────────────────────────────────────────────

/** Left-pad method to 6 chars for alignment: GET   POST  DELETE */
function padMethod(method: string): string {
  return method.padEnd(6);
}

/** Format elapsed ms cleanly — e.g. 2ms, 142ms, 1.2s */
function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 100)  return `${Math.round(ms)}ms`;
  return `${ms.toFixed(1)}ms`;
}

// ─── Plugin ─────────────────────────────────────────────────

export async function requestLoggerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const { url, method } = request;

    // Skip noisy infra endpoints
    if (url === '/health' || url === '/metrics') return done();

    const status  = reply.statusCode;
    const elapsed = formatMs(reply.elapsedTime);
    const user    = request.user?.id ?? 'anon';
    const msg     = `${padMethod(method)} ${url} → ${status}  (${elapsed})  [${user}]`;

    // Route to appropriate log level so errors stand out in the terminal
    if (status >= 500) {
      request.log.error(msg);
    } else if (status >= 400) {
      request.log.warn(msg);
    } else {
      request.log.info(msg);
    }

    done();
  });
}
