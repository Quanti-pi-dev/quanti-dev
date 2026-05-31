// ─── Study Pact Routes ────────────────────────────────────────────────────────
// Social accountability pact API endpoints.
//
// ADAPTER NOTE — mapPactToClient():
//   The database service (study-pact.service.ts) stores progress in CARDS
//   and uses internal field names. The mobile client contract
//   (behavioral-contracts.ts) expects MINUTES and different field names.
//   The adapter below bridges the gap without touching the service layer.
//
//   Key translations:
//     avatarUrl        → photoUrl
//     todayCards       → todayMinutes  (3 min/card heuristic)
//     pact.dailyTarget → member.dailyTarget (cards → minutes)
//     metToday         → metTargetToday
//     daysCompleted    → streak (proxy: consecutive days met)
//     startDate        → startsAt
//     endDate          → endsAt
//     status 'failed'  → 'broken'
//     myStatus         → derived from the requesting user's PactMember
//
// MINUTES HEURISTIC:
//   1 card ≈ 3 minutes of focused study (answer + review time on SM-2).
//   This matches the onboarding survey data (avg session: 20 cards / 60 min).
//   The UI shows minutes; the cron still gates rewards on cards.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/rbac.js';
import { studyPactService } from '@kd/db';

// ─── Service-layer return shapes (mirrors study-pact.service.ts) ───────────────
// Kept inline here because the types aren't re-exported from @kd/db's barrel.
// If the service types change, update these interfaces to match.

interface PactMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  daysCompleted: number;
  totalDays: number;
  todayCards: number;
  metToday: boolean;
  completionRate: number;
}

type PactStatus = 'active' | 'completed' | 'failed';
type PactDuration = 3 | 7 | 14;

interface StudyPact {
  id: string;
  creatorId: string;
  name: string;
  dailyTarget: number;
  durationDays: PactDuration;
  startDate: string;
  endDate: string;
  status: PactStatus;
  completionBonus: number;
  perfectBonus: number;
  members: PactMember[];
  createdAt: string;
}

const CARDS_TO_MINUTES = 3; // 1 card ≈ 3 min

// ─── Client-facing types ──────────────────────────────────────────────────────

interface ClientPactMember {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  todayMinutes: number;
  dailyTarget: number;   // minutes
  streak: number;
  metTargetToday: boolean;
}

interface ClientStudyPact {
  id: string;
  name: string;
  dailyTarget: number;   // minutes
  durationDays: 3 | 7 | 14;
  startsAt: string;
  endsAt: string;
  members: ClientPactMember[];
  status: 'pending' | 'active' | 'completed' | 'broken';
  myStatus: 'met' | 'at_risk' | 'broken';
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

function mapMember(member: PactMember, dailyTargetCards: number): ClientPactMember {
  return {
    userId: member.userId,
    displayName: member.displayName,
    photoUrl: member.avatarUrl,           // avatarUrl → photoUrl
    todayMinutes: member.todayCards * CARDS_TO_MINUTES,
    dailyTarget: dailyTargetCards * CARDS_TO_MINUTES,  // cards → minutes
    streak: member.daysCompleted,         // daysCompleted proxied as streak
    metTargetToday: member.metToday,      // metToday → metTargetToday
  };
}

function deriveMyStatus(
  me: ClientPactMember | undefined,
  pactStatus: ClientStudyPact['status'],
): ClientStudyPact['myStatus'] {
  if (!me || pactStatus === 'broken') return 'broken';
  if (me.metTargetToday) return 'met';
  // At-risk threshold: studied < 50% of today's target
  if (me.todayMinutes >= me.dailyTarget * 0.5) return 'at_risk';
  return 'at_risk';
}

function mapPactToClient(pact: StudyPact, requestingUserId: string): ClientStudyPact {
  const clientStatus: ClientStudyPact['status'] =
    pact.status === 'failed' ? 'broken' : (pact.status as ClientStudyPact['status']);

  const clientMembers = pact.members.map((m) => mapMember(m, pact.dailyTarget));

  const me = clientMembers.find((m) => m.userId === requestingUserId);

  return {
    id: pact.id,
    name: pact.name,
    dailyTarget: pact.dailyTarget * CARDS_TO_MINUTES,  // cards → minutes
    durationDays: pact.durationDays,
    startsAt: pact.startDate,            // startDate → startsAt
    endsAt: pact.endDate,               // endDate → endsAt
    members: clientMembers,
    status: clientStatus,
    myStatus: deriveMyStatus(me, clientStatus),
  };
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const createPactSchema = z.object({
  name: z.string().min(3).max(50),
  // Client sends minutes; convert back to cards for the service
  dailyTarget: z.number().int().min(5).max(300),
  durationDays: z.union([z.literal(3), z.literal(7), z.literal(14)]),
  memberFirebaseUids: z.array(z.string()).min(1).max(4),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function studyPactRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── POST /study-pacts — Create a new study pact ────────────
  // Client sends dailyTarget in MINUTES; convert to cards for the service.
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const raw = createPactSchema.parse(request.body);
    const userId = request.user!.id;

    const serviceInput = {
      ...raw,
      // Convert minutes → cards (ceiling to avoid zero)
      dailyTarget: Math.max(1, Math.ceil(raw.dailyTarget / CARDS_TO_MINUTES)),
    };

    const pact = await studyPactService.createPact(userId, serviceInput);

    return reply.status(201).send({
      success: true,
      data: mapPactToClient(pact, userId),
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /study-pacts/active — Get user's active pact ─────
  // Returns null if the user has no active pact.
  // Psychology: Social Comparison — seeing "X/Y min" for each friend
  // creates competitive drive and reduces missing daily targets.
  fastify.get('/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const pact = await studyPactService.getActivePactForUser(userId);

    return reply.send({
      success: true,
      data: pact ? mapPactToClient(pact, userId) : null,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /study-pacts/:id — Get pact details ─────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const userId = request.user!.id;
      const pact = await studyPactService.getPact(request.params.id);

      return reply.send({
        success: true,
        data: mapPactToClient(pact, userId),
        timestamp: new Date().toISOString(),
      });
    },
  );
}
