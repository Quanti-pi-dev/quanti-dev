// ─── User Content Routes ─────────────────────────────────────
// Personal study decks and card annotations.
//
// Psychology (Blueprint §4.2 — Investment Loop):
//   Content creation is the highest-value investment a user can make.
//   Every deck built and every annotation written is stored value that
//   makes platform abandonment progressively more costly.
//
// Route groups:
//   /user-decks         — CRUD for personal study decks + sharing
//   /annotations/:cardId — Personal notes on platform flashcards

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { userDeckService, cardAnnotationService } from '@kd/db';

// ─── Schemas ─────────────────────────────────────────────────

const createDeckSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const updateDeckSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

const optionSchema = z.object({
  id: z.string().min(1).max(50),
  text: z.string().min(1).max(1000),
});

const createCardSchema = z.object({
  question: z.string().min(1).max(2000),
  options: z.array(optionSchema).min(2).max(6),
  correctAnswerId: z.string().min(1).max(50),
  explanation: z.string().max(2000).nullable().optional(),
});

const shareDeckSchema = z.object({
  recipientFirebaseUid: z.string().min(1),
});

const revokeDeckSchema = z.object({
  recipientFirebaseUid: z.string().min(1),
});

const annotationSchema = z.object({
  note: z.string().min(1).max(2000),
});

// ─── Route Registration ──────────────────────────────────────

export async function userContentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ═══════════════════════════════════════════════════════════
  // USER DECKS
  // ═══════════════════════════════════════════════════════════

  // ── POST /user-decks — Create a new personal deck ─────────
  fastify.post('/user-decks', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const input = createDeckSchema.parse(request.body);

    const deck = await userDeckService.createDeck(userId, input);

    return reply.status(201).send({
      success: true,
      data: deck,
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /user-decks — List my own decks ───────────────────
  fastify.get('/user-decks', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const [owned, sharedWithMe] = await Promise.all([
      userDeckService.listByOwner(userId),
      userDeckService.listSharedWithUser(userId),
    ]);

    return reply.send({
      success: true,
      data: { owned, sharedWithMe },
      timestamp: new Date().toISOString(),
    });
  });

  // ── PATCH /user-decks/:id — Update deck metadata ──────────
  fastify.patch<{ Params: { id: string } }>(
    '/user-decks/:id',
    async (request, reply) => {
      const userId = request.user!.id;
      const updates = updateDeckSchema.parse(request.body);

      const ok = await userDeckService.update(request.params.id, userId, updates);
      if (!ok) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Deck not found or access denied' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, timestamp: new Date().toISOString() });
    },
  );

  // ── DELETE /user-decks/:id — Delete a deck ────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/user-decks/:id',
    async (request, reply) => {
      const userId = request.user!.id;
      const ok = await userDeckService.deleteDeck(request.params.id, userId);

      if (!ok) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Deck not found or access denied' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, timestamp: new Date().toISOString() });
    },
  );

  // ── POST /user-decks/:id/share — Share with a friend ──────
  fastify.post<{ Params: { id: string } }>(
    '/user-decks/:id/share',
    async (request, reply) => {
      const userId = request.user!.id;
      const { recipientFirebaseUid } = shareDeckSchema.parse(request.body);

      const result = await userDeckService.shareWithFriend(
        request.params.id,
        userId,
        recipientFirebaseUid,
      );

      if (!result.ok) {
        const status = result.reason === 'deck_not_found' ? 404 : 400;
        return reply.status(status).send({
          success: false,
          error: { code: result.reason?.toUpperCase() ?? 'ERROR', message: result.reason },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, timestamp: new Date().toISOString() });
    },
  );

  // ── POST /user-decks/:id/revoke — Revoke a friend's access ─
  fastify.post<{ Params: { id: string } }>(
    '/user-decks/:id/revoke',
    async (request, reply) => {
      const userId = request.user!.id;
      const { recipientFirebaseUid } = revokeDeckSchema.parse(request.body);

      await userDeckService.revokeShare(request.params.id, userId, recipientFirebaseUid);

      return reply.send({ success: true, timestamp: new Date().toISOString() });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // DECK CARDS
  // ═══════════════════════════════════════════════════════════

  // ── GET /user-decks/:id/cards — List cards in a deck ──────
  fastify.get<{ Params: { id: string } }>(
    '/user-decks/:id/cards',
    async (request, reply) => {
      const userId = request.user!.id;
      const cards = await userDeckService.listCards(request.params.id, userId);

      if (cards === null) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Deck not found or access denied' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: cards,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /user-decks/:id/cards — Add a card to a deck ─────
  fastify.post<{ Params: { id: string } }>(
    '/user-decks/:id/cards',
    async (request, reply) => {
      const userId = request.user!.id;
      const input = createCardSchema.parse(request.body);

      const card = await userDeckService.addCard(request.params.id, userId, input);

      if (!card) {
        return reply.status(400).send({
          success: false,
          error: { code: 'LIMIT_REACHED', message: 'Deck not found, access denied, or 200-card limit reached' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(201).send({
        success: true,
        data: card,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── PATCH /user-decks/:deckId/cards/:cardId — Update a card ─
  fastify.patch<{ Params: { deckId: string; cardId: string } }>(
    '/user-decks/:deckId/cards/:cardId',
    async (request, reply) => {
      const userId = request.user!.id;
      const updates = createCardSchema.partial().parse(request.body);

      const ok = await userDeckService.updateCard(
        request.params.cardId,
        request.params.deckId,
        userId,
        updates,
      );

      if (!ok) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Card not found or access denied' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, timestamp: new Date().toISOString() });
    },
  );

  // ── DELETE /user-decks/:deckId/cards/:cardId — Remove a card ─
  fastify.delete<{ Params: { deckId: string; cardId: string } }>(
    '/user-decks/:deckId/cards/:cardId',
    async (request, reply) => {
      const userId = request.user!.id;
      const ok = await userDeckService.deleteCard(
        request.params.cardId,
        request.params.deckId,
        userId,
      );

      if (!ok) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Card not found or access denied' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, timestamp: new Date().toISOString() });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // CARD ANNOTATIONS (personal notes on platform flashcards)
  // ═══════════════════════════════════════════════════════════

  // ── GET /annotations/:cardId — Get my note on a card ──────
  fastify.get<{ Params: { cardId: string } }>(
    '/annotations/:cardId',
    async (request, reply) => {
      const userId = request.user!.id;
      const annotation = await cardAnnotationService.findOne(userId, request.params.cardId);

      return reply.send({
        success: true,
        data: annotation,          // null if no note exists yet
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── PUT /annotations/:cardId — Create or update my note ───
  // Idempotent upsert — calling again simply overwrites the note.
  fastify.put<{ Params: { cardId: string } }>(
    '/annotations/:cardId',
    async (request, reply) => {
      const userId = request.user!.id;
      const { note } = annotationSchema.parse(request.body);

      const annotation = await cardAnnotationService.upsert(userId, request.params.cardId, note);

      return reply.send({
        success: true,
        data: annotation,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── DELETE /annotations/:cardId — Remove my note ──────────
  fastify.delete<{ Params: { cardId: string } }>(
    '/annotations/:cardId',
    async (request, reply) => {
      const userId = request.user!.id;
      const ok = await cardAnnotationService.delete(userId, request.params.cardId);

      if (!ok) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Annotation not found' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, timestamp: new Date().toISOString() });
    },
  );
}
