// ─── Request Logger Plugin ──────────────────────────────────
// Enriches Pino logs with user context and request metadata.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function requestLoggerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip health and metrics endpoints to reduce log noise
    if (request.url === '/health' || request.url === '/metrics') return;

    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      userId: request.user?.id ?? 'anonymous',
      responseTime: reply.elapsedTime,
    }, 'request completed');
  });
}
