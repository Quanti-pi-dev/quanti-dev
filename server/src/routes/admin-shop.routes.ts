// ─── Admin Shop Routes ──────────────────────────────────────
// CRUD for badges and shop items (PostgreSQL).

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPostgresPool } from '../lib/database.js';
import {
  adminBadgeRepository,
  adminShopItemRepository,
} from '../repositories/admin.repository.js';

// ─── Schemas ────────────────────────────────────────────────

const createBadgeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  iconUrl: z.string().min(1),
  criteria: z.string().min(1),
});

// U3 fix: imageUrl is now nullable/optional so admins don't need to provide placeholder strings
const createShopItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  price: z.number().int().nonnegative(),
  category: z.enum(['flashcard_pack', 'theme', 'power_up']),
  deckId: z.string().min(1).optional(),
  cardCount: z.number().int().positive().optional(),
  themeKey: z.string().min(1).optional(),
});

const updateShopItemSchema = createShopItemSchema.partial().extend({
  isAvailable: z.boolean().optional(),
});

// ─── Routes ─────────────────────────────────────────────────

export async function adminShopRoutes(fastify: FastifyInstance): Promise<void> {

  // ═══════════════════════════════════════════════════════
  // BADGES (PostgreSQL)
  // ═══════════════════════════════════════════════════════

  fastify.get('/badges', async (_request: FastifyRequest, reply: FastifyReply) => {
    const badges = await adminBadgeRepository.findAll();
    return reply.send({ success: true, data: badges, timestamp: new Date().toISOString() });
  });

  fastify.post('/badges', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createBadgeSchema.parse(request.body);
    const id = await adminBadgeRepository.create(input);
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  fastify.patch('/badges/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = createBadgeSchema.partial().parse(request.body);
    const updated = await adminBadgeRepository.update(id, updates);
    if (!updated) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Badge not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: { id }, message: 'Badge updated', timestamp: new Date().toISOString() });
  });

  fastify.delete('/badges/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await adminBadgeRepository.delete(id);
    if (!deleted) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Badge not found' }, timestamp: new Date().toISOString() });
    }
    return reply.send({ success: true, data: { id }, message: 'Badge deleted', timestamp: new Date().toISOString() });
  });

  // ═══════════════════════════════════════════════════════
  // SHOP ITEMS (PostgreSQL)
  // ═══════════════════════════════════════════════════════

  fastify.get('/shop-items', async (_request: FastifyRequest, reply: FastifyReply) => {
    const pg = getPostgresPool();
    const result = await pg.query(
      `SELECT id, name, description, image_url, price, category,
              is_available, deck_id, card_count, theme_key, created_at, updated_at
       FROM shop_items ORDER BY created_at DESC`,
    );
    const items = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      imageUrl: (row.image_url as string) ?? null,
      price: row.price as number,
      category: row.category as string,
      isAvailable: row.is_available as boolean,
      deckId: (row.deck_id as string) ?? null,
      cardCount: (row.card_count as number) ?? null,
      themeKey: (row.theme_key as string) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    }));
    return reply.send({ success: true, data: items, timestamp: new Date().toISOString() });
  });

  fastify.post('/shop-items', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createShopItemSchema.parse(request.body);
    const id = await adminShopItemRepository.create({ ...input, imageUrl: input.imageUrl ?? null });
    return reply.status(201).send({
      success: true,
      data: { id },
      timestamp: new Date().toISOString(),
    });
  });

  fastify.put('/shop-items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = updateShopItemSchema.parse(request.body);
    const { imageUrl: rawImageUrl, ...rest } = updates;
    const sanitizedUpdates = { ...rest, ...(rawImageUrl !== undefined ? { imageUrl: rawImageUrl ?? '' } : {}) };
    const updated = await adminShopItemRepository.update(id, sanitizedUpdates);
    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shop item not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });

  fastify.delete('/shop-items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await adminShopItemRepository.delete(id);
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shop item not found' },
        timestamp: new Date().toISOString(),
      });
    }
    return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
  });
}
