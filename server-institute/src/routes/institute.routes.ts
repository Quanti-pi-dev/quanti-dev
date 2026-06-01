// ─── Institute Management Routes ──────────────────────────────────
// CRUD for institutes, members, and join codes.
// All routes require institute_admin or admin role.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { instituteRepository, instituteService, authService } from '@kd/db';
import { requireInstituteRole } from '../middleware/auth.js';

// ─── Schemas ──────────────────────────────────────────────────────

const CreateInstituteSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(12).toUpperCase(),
  type: z.enum(['coaching', 'school', 'university']).default('coaching'),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
  address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    pin: z.string(),
  }).optional().nullable(),
});

const UpdateInstituteSchema = CreateInstituteSchema.partial().omit({ code: true, type: true });

const CreateJoinCodeSchema = z.object({
  role: z.enum(['institute_admin', 'educator', 'examiner', 'student']).default('student'),
  department: z.string().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  expiresInDays: z.number().int().positive().optional(),
});

const ListMembersQuerySchema = z.object({
  role: z.enum(['institute_admin', 'educator', 'examiner', 'student']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Route Registration ───────────────────────────────────────────

export async function instituteMgmtRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /institutes/:instituteId — Get institute details ──────
  fastify.get<{ Params: { instituteId: string } }>(
    '/institutes/:instituteId',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request: FastifyRequest<{ Params: { instituteId: string } }>, reply: FastifyReply) => {
      const institute = await instituteRepository.findById(request.params.instituteId);
      if (!institute) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Institute not found' }, timestamp: new Date().toISOString() });
      return reply.send({ success: true, data: institute, timestamp: new Date().toISOString() });
    },
  );

  // ── PATCH /institutes/:instituteId — Update institute ─────────
  fastify.patch<{ Params: { instituteId: string }; Body: unknown }>(
    '/institutes/:instituteId',
    { preHandler: [requireInstituteRole('institute_admin')] },
    async (request, reply) => {
      const params = request.params as { instituteId: string };
      const body = UpdateInstituteSchema.parse(request.body);
      const updated = await instituteRepository.update(params.instituteId, {
        name: body.name,
        logoUrl: body.logoUrl,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        address: body.address,
      });
      if (!updated) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Institute not found' }, timestamp: new Date().toISOString() });
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    },
  );

  // ── GET /institutes/:instituteId/members — List members ───────
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institutes/:instituteId/members',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request, reply) => {
      const params = request.params as { instituteId: string };
      const query = ListMembersQuerySchema.parse(request.query);
      const result = await instituteRepository.listMembers(params.instituteId, {
        role: query.role,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });
      return reply.send({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + query.limit < result.total,
        },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── DELETE /institutes/:instituteId/members/:userId — Remove member
  fastify.delete<{ Params: { instituteId: string; userId: string } }>(
    '/institutes/:instituteId/members/:userId',
    { preHandler: [requireInstituteRole('institute_admin')] },
    async (request, reply) => {
      const { instituteId, userId } = request.params;
      const removed = await instituteRepository.removeMember(instituteId, userId);
      if (!removed) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' }, timestamp: new Date().toISOString() });
      await instituteService.invalidateMembershipCache(userId);
      // Clear Firebase institute claims so the revocation takes effect immediately
      void authService.clearInstituteClaims(userId);
      return reply.send({ success: true, data: { removed: true }, timestamp: new Date().toISOString() });
    },
  );

  // ── GET /institutes/:instituteId/join-codes — List join codes ─
  fastify.get<{ Params: { instituteId: string } }>(
    '/institutes/:instituteId/join-codes',
    { preHandler: [requireInstituteRole('institute_admin')] },
    async (request, reply) => {
      const { instituteId } = request.params;
      const codes = await instituteRepository.listJoinCodes(instituteId);
      return reply.send({ success: true, data: codes, timestamp: new Date().toISOString() });
    },
  );

  // ── POST /institutes/:instituteId/join-codes — Create join code
  fastify.post<{ Params: { instituteId: string }; Body: unknown }>(
    '/institutes/:instituteId/join-codes',
    { preHandler: [requireInstituteRole('institute_admin')] },
    async (request, reply) => {
      const { instituteId } = request.params;
      const body = CreateJoinCodeSchema.parse(request.body);

      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86400 * 1000)
        : null;

      const code = await instituteRepository.createJoinCode({
        instituteId,
        role: body.role,
        department: body.department ?? null,
        maxUses: body.maxUses ?? null,
        expiresAt,
        createdBy: request.user!.id,
      });

      return reply.status(201).send({ success: true, data: code, timestamp: new Date().toISOString() });
    },
  );

  // ── DELETE /institutes/:instituteId/join-codes/:codeId — Revoke
  fastify.delete<{ Params: { instituteId: string; codeId: string } }>(
    '/institutes/:instituteId/join-codes/:codeId',
    { preHandler: [requireInstituteRole('institute_admin')] },
    async (request, reply) => {
      const { instituteId, codeId } = request.params;
      const revoked = await instituteRepository.revokeJoinCode(codeId, instituteId);
      if (!revoked) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Join code not found' }, timestamp: new Date().toISOString() });
      return reply.send({ success: true, data: { revoked: true }, timestamp: new Date().toISOString() });
    },
  );

  // ── GET /institutes/:instituteId/subscriptions — Seat summary ─
  fastify.get<{ Params: { instituteId: string } }>(
    '/institutes/:instituteId/subscriptions',
    { preHandler: [requireInstituteRole('institute_admin')] },
    async (request, reply) => {
      const { instituteId } = request.params;
      const sub = await instituteRepository.findActiveSubscription(instituteId);
      return reply.send({
        success: true,
        data: sub ?? null,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /institutes/:instituteId/upload/presign — R2 presigned URL for content images ─
  const presignSchema = z.object({
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  });

  fastify.post<{ Params: { instituteId: string }; Body: unknown }>(
    '/institutes/:instituteId/upload/presign',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request, reply) => {
      const { mimeType } = presignSchema.parse(request.body);
      const { generateAdminPresignedUrl } = await import('@kd/db');

      try {
        // Reuse the admin presign function — images are stored under content/<userId>/
        const result = await generateAdminPresignedUrl(request.user!.id, mimeType);
        return reply.send({
          success: true,
          data: { uploadUrl: result.uploadUrl, cdnUrl: result.cdnUrl },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        request.log.error({ err }, 'Failed to generate institute presigned URL');
        return reply.status(500).send({
          success: false,
          error: { code: 'PRESIGN_FAILED', message: 'Could not generate upload URL' },
          timestamp: new Date().toISOString(),
        });
      }
    },
  );
}
