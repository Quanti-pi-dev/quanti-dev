// ─── Platform Config Routes ──────────────────────────────────
// Public: GET /config (cached, for mobile app).
// Admin: full CRUD on platform_config entries.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { configRepository } from '../repositories/config.repository.js';

// ─── Validation Schemas ──────────────────────────────────────

const upsertConfigSchema = z.object({
  value: z.unknown(),
  category: z.string().min(1).max(50),
  description: z.string().max(500).optional().default(''),
});

// ─── Public Config Route (registered under /api/v1) ──────────

export async function publicConfigRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // GET /api/v1/config — flat key-value map for mobile app
  fastify.get('/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    const configMap = await configRepository.getPublicMap();
    return reply.send({
      success: true,
      data: configMap,
      timestamp: new Date().toISOString(),
    });
  });
}

// ─── Admin Config Routes (registered under /api/admin) ───────

export async function adminConfigRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireRole('admin'));

  // GET /api/admin/config — full entries with metadata
  fastify.get('/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    const entries = await configRepository.getAll();
    return reply.send({
      success: true,
      data: entries,
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/admin/config/category/:category — entries by category
  fastify.get('/config/category/:category', async (request: FastifyRequest, reply: FastifyReply) => {
    const { category } = request.params as { category: string };
    const entries = await configRepository.getByCategory(category);
    return reply.send({
      success: true,
      data: entries,
      timestamp: new Date().toISOString(),
    });
  });

  // PUT /api/admin/config/:key — upsert a config value
  fastify.put('/config/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const { value, category, description } = upsertConfigSchema.parse(request.body);

    const entry = await configRepository.upsert(
      key,
      value,
      category,
      description ?? '',
      request.user!.id,
    );

    return reply.send({
      success: true,
      data: entry,
      timestamp: new Date().toISOString(),
    });
  });

  // DELETE /api/admin/config/:key — remove a config key
  fastify.delete('/config/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const deleted = await configRepository.delete(key);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Config key '${key}' not found` },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: { key },
      message: 'Config key deleted',
      timestamp: new Date().toISOString(),
    });
  });
}
