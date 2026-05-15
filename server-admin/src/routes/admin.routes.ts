// ─── Admin Service Routes (Orchestrator) ────────────────────
// Registers all admin domain sub-routes under /api/admin.
// Each domain file handles its own schemas and repository imports.
//
// Domain files:
//   admin-exam.routes.ts      — Exam CRUD + exam-subject mappings
//   admin-subject.routes.ts   — Subject CRUD + exam-subject creation
//   admin-topic.routes.ts     — Topic CRUD (exam-scoped)
//   admin-content.routes.ts    — Deck + Flashcard CRUD + bulk import
//   admin-pyq.routes.ts        — PYQ dedicated management + bulk import
//   admin-shop.routes.ts       — Badge + Shop Item CRUD (PostgreSQL)
//   admin-analytics.routes.ts  — Platform analytics + asset uploads
//   admin-mocktest.routes.ts   — Mock Test template CRUD

import { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/rbac.js';
import { adminExamRoutes } from './admin-exam.routes.js';
import { adminSubjectRoutes } from './admin-subject.routes.js';
import { adminTopicRoutes } from './admin-topic.routes.js';
import { adminContentRoutes } from './admin-content.routes.js';
import { adminPYQRoutes } from './admin-pyq.routes.js';
import { adminShopRoutes } from './admin-shop.routes.js';
import { adminAnalyticsRoutes } from './admin-analytics.routes.js';
import { adminMockTestRoutes } from './admin-mocktest.routes.js';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // All admin routes require admin role
  fastify.addHook('preHandler', requireRole('admin'));

  // Register domain-specific route groups
  // (no prefix needed — they share the parent /api/admin prefix)
  await fastify.register(adminExamRoutes);
  await fastify.register(adminSubjectRoutes);
  await fastify.register(adminTopicRoutes);
  await fastify.register(adminContentRoutes);
  await fastify.register(adminPYQRoutes);
  await fastify.register(adminShopRoutes);
  await fastify.register(adminAnalyticsRoutes);
  await fastify.register(adminMockTestRoutes);
}
