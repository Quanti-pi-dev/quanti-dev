// ─── Global Error Handler ───────────────────────────────────
// Structured error responses with request context for observability.

import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

export async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      const timestamp = new Date().toISOString();

      // ─── Zod Validation Errors ────────────────────────
      if (error instanceof ZodError || error.name === 'ZodError') {
        const zodError = error as ZodError;
        request.log.warn({ errors: zodError.errors, url: request.url }, 'Validation error');
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: zodError.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          timestamp,
        });
      }

      // ─── Fastify Errors (rate limit, not found, etc.) ─
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        const statusCode = error.statusCode;

        if (statusCode === 429) {
          return reply.status(429).send({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
            timestamp,
          });
        }

        if (statusCode === 404) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: error.message || 'Resource not found' },
            timestamp,
          });
        }

        // Other known HTTP errors
        return reply.status(statusCode).send({
          success: false,
          error: { code: error.code ?? 'ERROR', message: error.message },
          timestamp,
        });
      }

      // ─── Unhandled Errors ─────────────────────────────
      request.log.error(
        {
          err: error,
          stack: error.stack,
          url: request.url,
          method: request.method,
          userId: request.user?.id,
        },
        'Unhandled error',
      );

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            process.env['NODE_ENV'] === 'production'
              ? 'An unexpected error occurred'
              : error.message,
        },
        timestamp,
      });
    },
  );
}
