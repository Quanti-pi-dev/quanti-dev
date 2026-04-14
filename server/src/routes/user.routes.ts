// ─── User Service Routes ────────────────────────────────────
// Profile management, avatar, and preferences endpoints.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { userRepository } from '../repositories/user.repository.js';
import { generateAvatarPresignedUrl } from '../lib/storage.js';
import { getRedisClient } from '../lib/database.js';

// ─── Validation Schemas ─────────────────────────────────────
// NOTE: email is intentionally excluded. User emails are managed exclusively
// through Auth0 to prevent local identity desynchronization and spoofing.

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notificationsEnabled: z.boolean().optional(),
  studyRemindersEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
  selectedExams: z.array(z.string()).optional(),
  selectedSubjects: z.array(z.string()).optional(),
});

// Allowed MIME types for avatar uploads
const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AvatarMimeType = (typeof ALLOWED_AVATAR_MIME_TYPES)[number];

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth to all user routes
  fastify.addHook('preHandler', requireAuth());

  // ─── PUT /users/profile — Update profile ──────────────
  // Update the authenticated user's display name (and optionally avatarUrl
  // directly, though the preferred avatar update path is POST /avatar/presign
  // followed by PUT /avatar).
  fastify.put('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = updateProfileSchema.parse(request.body);
    const profile = await userRepository.updateProfile(request.user!.id, input);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User profile not found' },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /users/avatar/presign — Generate R2 upload URL ──
  // Step 1 of the avatar upload flow:
  //   Mobile calls this → gets { uploadUrl, cdnUrl }
  //   Mobile PUTs the file binary directly to uploadUrl (straight to R2)
  //   Mobile calls PUT /users/avatar { avatarUrl: cdnUrl } to persist the URL
  //
  // This keeps file bandwidth off our server completely.
  fastify.post('/avatar/presign', async (request: FastifyRequest, reply: FastifyReply) => {
    const { mimeType } = z.object({
      mimeType: z.enum(ALLOWED_AVATAR_MIME_TYPES),
    }).parse(request.body);

    const userId = request.user!.id;

    try {
      const result = await generateAvatarPresignedUrl(userId, mimeType as AvatarMimeType);
      return reply.send({
        success: true,
        data: {
          uploadUrl: result.uploadUrl,
          cdnUrl:    result.cdnUrl,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      request.log.error({ err }, 'Failed to generate avatar presigned URL');
      return reply.status(500).send({
        success: false,
        error: { code: 'STORAGE_ERROR', message: 'Could not generate upload URL. Check storage configuration.' },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── PUT /users/avatar — Persist avatar CDN URL ────────
  // Step 3 of the avatar upload flow (after the mobile file PUT to R2 succeeds).
  // Body: { avatarUrl: string } — a fully-qualified CDN URL returned by /avatar/presign.
  // NOT a file upload endpoint — the file lives in R2, not on this server.
  fastify.put('/avatar', async (request: FastifyRequest, reply: FastifyReply) => {
    const { avatarUrl } = z.object({ avatarUrl: z.string().url() }).parse(request.body);
    const profile = await userRepository.updateProfile(request.user!.id, { avatarUrl });

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /users/preferences — Get preferences ────────
  fastify.get('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const prefs = await userRepository.getPreferences(request.user!.id);

    if (!prefs) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Preferences not found' },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: prefs,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── PUT /users/preferences — Update preferences ─────
  fastify.put('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = updatePreferencesSchema.parse(request.body);
    const prefs = await userRepository.updatePreferences(request.user!.id, input);

    if (!prefs) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      success: true,
      data: prefs,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── POST /users/fcm-token — Register device push token ──
  // Stores the device's FCM token in Redis so the NotificationService
  // can look it up when dispatching push notifications.
  fastify.post('/fcm-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(request.body);
    const userId = request.user!.id;

    try {
      // Store with 90-day TTL — token should be refreshed on each app launch
      await getRedisClient().setex(`fcm_token:${userId}`, 90 * 24 * 60 * 60, token);
      return reply.send({
        success: true,
        data: { message: 'FCM token registered' },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      request.log.error({ err }, 'Failed to store FCM token');
      return reply.status(500).send({
        success: false,
        error: { code: 'TOKEN_STORE_FAILED', message: 'Could not register device token' },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── DELETE /users/fcm-token — Unregister device push token ──
  // Removes the FCM token on logout to prevent ghost notifications.
  fastify.delete('/fcm-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;

    try {
      await getRedisClient().del(`fcm_token:${userId}`);
      return reply.send({
        success: true,
        data: { message: 'FCM token removed' },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      request.log.error({ err }, 'Failed to remove FCM token');
      return reply.status(500).send({
        success: false,
        error: { code: 'TOKEN_DELETE_FAILED', message: 'Could not remove device token' },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
