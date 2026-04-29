// ─── Friend Routes ──────────────────────────────────────────
// REST endpoints for the social/friendship system.
// All routes require authentication via requireAuth().

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { friendService } from '../services/friend.service.js';

// ─── Validation Schemas ─────────────────────────────────────

const sendRequestSchema = z.object({
  addresseeId: z.string().uuid(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export async function friendRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── POST /friends/request — Send friend request ──────
  fastify.post('/friends/request', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = sendRequestSchema.parse(request.body);
    try {
      const friendship = await friendService.sendFriendRequest(request.user!.id, input.addresseeId);
      return reply.status(201).send({
        success: true,
        data: friendship,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'FRIEND_REQUEST_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── POST /friends/:id/accept — Accept a request ──────
  fastify.post('/friends/:id/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      await friendService.acceptFriendRequest(id, request.user!.id);
      return reply.send({
        success: true,
        data: { message: 'Friend request accepted' },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'ACCEPT_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── DELETE /friends/user/:userId — Remove an accepted friend by User ID ─
  fastify.delete('/friends/user/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    try {
      await friendService.removeFriendByUser(request.user!.id, userId);
      return reply.send({
        success: true,
        data: { message: 'Friendship removed' },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'REMOVE_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── DELETE /friends/:id — Reject request or remove friend ─
  // M7 fix: Status-based dispatch instead of error-driven control flow
  fastify.delete('/friends/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      // Look up the friendship first to determine the correct action
      const friendship = await friendService.getFriendship(id);
      if (!friendship) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Friendship not found' },
          timestamp: new Date().toISOString(),
        });
      }

      if (friendship.status === 'pending') {
        await friendService.rejectFriendRequest(id, request.user!.id);
      } else {
        await friendService.removeFriend(id, request.user!.id);
      }

      return reply.send({
        success: true,
        data: { message: 'Friendship removed' },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'REMOVE_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });



  // ─── POST /friends/:userId/block — Block a user ───────
  fastify.post('/friends/:userId/block', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    try {
      await friendService.blockUser(request.user!.id, userId);
      return reply.send({
        success: true,
        data: { message: 'User blocked' },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'BLOCK_FAILED', message: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── GET /friends — List accepted friends ─────────────
  fastify.get('/friends', async (request: FastifyRequest, reply: FastifyReply) => {
    const friends = await friendService.listFriends(request.user!.id);
    return reply.send({
      success: true,
      data: friends,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /friends/requests/received — Pending received ─
  fastify.get('/friends/requests/received', async (request: FastifyRequest, reply: FastifyReply) => {
    const requests = await friendService.listPendingReceived(request.user!.id);
    return reply.send({
      success: true,
      data: requests,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /friends/requests/sent — Pending sent ────────
  fastify.get('/friends/requests/sent', async (request: FastifyRequest, reply: FastifyReply) => {
    const requests = await friendService.listPendingSent(request.user!.id);
    return reply.send({
      success: true,
      data: requests,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /users/search — Search users by display name ─
  fastify.get('/users/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = searchQuerySchema.parse(request.query);
    const users = await friendService.searchUsers(query.q, request.user!.id);
    return reply.send({
      success: true,
      data: users,
      timestamp: new Date().toISOString(),
    });
  });
}
