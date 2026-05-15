// ─── Institute Admin Routes (server-admin) ────────────────────────
// Admin-only endpoints to manage institutes and sync role claims.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { instituteRepository, authService, getPostgresPool } from '@kd/db';

const CreateInstituteSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(12).toUpperCase(),
  type: z.enum(['coaching', 'school', 'university']).default('coaching'),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
});

const SyncClaimsSchema = z.object({
  firebaseUid: z.string().min(1),
  role: z.enum(['student', 'educator', 'examiner', 'institute_admin', 'admin']),
  instituteId: z.string().optional(),
  instituteRole: z.string().optional(),
});

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function adminInstituteRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /admin/institutes — List all institutes ───────────────
  fastify.get<{ Querystring: unknown }>(
    '/institutes',
    async (request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) => {
      const query = ListQuerySchema.parse(request.query);
      const result = await instituteRepository.listAll({ limit: query.limit, offset: query.offset });
      return reply.send({
        success: true,
        data: result.data,
        pagination: { total: result.total, limit: query.limit, offset: query.offset },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /admin/institutes — Create institute ─────────────────
  fastify.post<{ Body: unknown }>(
    '/institutes',
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const body = CreateInstituteSchema.parse(request.body);
      const institute = await instituteRepository.create({
        name: body.name,
        code: body.code,
        type: body.type,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone ?? null,
        logoUrl: body.logoUrl ?? null,
      });
      return reply.status(201).send({ success: true, data: institute, timestamp: new Date().toISOString() });
    },
  );

  // ── PATCH /admin/institutes/:id/activate — Toggle active status ─
  fastify.patch<{ Params: { id: string }; Body: unknown }>(
    '/institutes/:id/activate',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const body = z.object({ isActive: z.boolean() }).parse(request.body);
      const updated = await instituteRepository.update(request.params.id, { isActive: body.isActive });
      if (!updated) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' }, timestamp: new Date().toISOString() });
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    },
  );

  // ── POST /admin/institutes/:id/subscriptions — Grant subscription ─
  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/institutes/:id/subscriptions',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const body = z.object({
        planId: z.string().min(1),
        maxSeats: z.number().int().positive(),
        periodStartDays: z.number().int().min(0).default(0),
        periodDays: z.number().int().positive().default(365),
      }).parse(request.body);

      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() + body.periodStartDays);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + body.periodDays);

      const sub = await instituteRepository.createSubscription({
        instituteId: request.params.id,
        planId: body.planId,
        maxSeats: body.maxSeats,
        periodStart,
        periodEnd,
        amountPaise: 0,  // admin-granted subscription; no payment
      });

      return reply.status(201).send({ success: true, data: sub, timestamp: new Date().toISOString() });
    },
  );

  // ── GET /admin/institutes/:id/members — List all members ─────
  fastify.get<{ Params: { id: string }; Querystring: unknown }>(
    '/institutes/:id/members',
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: unknown }>, reply: FastifyReply) => {
      const query = ListQuerySchema.parse(request.query);
      const result = await instituteRepository.listMembers(request.params.id, {
        limit: query.limit,
        offset: query.offset,
      });
      return reply.send({
        success: true,
        data: result.data,
        pagination: { total: result.total, limit: query.limit, offset: query.offset },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /admin/claims/sync — Sync Firebase role claim ────────
  // Used when admin promotes a user to educator / examiner / institute_admin.
  fastify.post<{ Body: unknown }>(
    '/claims/sync',
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const body = SyncClaimsSchema.parse(request.body);

      if (body.instituteId && body.instituteRole) {
        await authService.setInstituteClaims(body.firebaseUid, body.instituteId, body.instituteRole, body.role);
      } else {
        await authService.syncRoleClaim(body.firebaseUid, body.role);
      }

      // Mirror role to PostgreSQL
      const pg = getPostgresPool();
      await pg.query(
        'UPDATE users SET role = $1, updated_at = NOW() WHERE firebase_uid = $2',
        [body.role, body.firebaseUid],
      );

      return reply.send({
        success: true,
        data: { synced: true, firebaseUid: body.firebaseUid, role: body.role },
        timestamp: new Date().toISOString(),
      });
    },
  );
}
