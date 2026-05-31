// ─── Profile Routes ─────────────────────────────────────────
// Progressive profile unlock status + weekly highlight reel.
//
// NOTE on /tiers vs /unlock-status:
//   The mobile client (behavioral-contracts.ts) calls GET /profile/tiers.
//   It expects an XP-threshold-based tier system (Rookie / Scholar / Expert / Legend)
//   with xpCurrent, xpRequired, percentToNext fields plus structured feature arrays.
//   The backend service computes account-age-based tiers (Starter / Explorer / Analyst…).
//   This route bridges both worlds: it reads the account-age tier from the service,
//   maps it to the nearest XP tier, and reshapes the feature list into the typed
//   ProfileFeatureUnlock[] structure the client renders.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/rbac.js';
import { progressiveProfileService, weeklyHighlightService } from '@kd/db';

// ─── XP Tier Mapping ────────────────────────────────────────
// Maps the account-age tiers from the backend service to the four-tier
// progression (Rookie → Scholar → Expert → Legend) rendered by the mobile client.
// XP is derived from the user's total correct answers tracked in the service.

type ClientTier = 'Rookie' | 'Scholar' | 'Expert' | 'Legend';

// Account-age tier → client tier
const AGE_TIER_TO_CLIENT: Record<string, ClientTier> = {
  Starter:   'Rookie',
  Explorer:  'Rookie',
  Analyst:   'Scholar',
  Strategist:'Scholar',
  Scholar:   'Expert',
  Expert:    'Expert',
  Elite:     'Legend',
};

// XP thresholds that gate each client tier
const TIER_XP: Record<ClientTier, { required: number }> = {
  Rookie:  { required: 0 },
  Scholar: { required: 500 },
  Expert:  { required: 2000 },
  Legend:  { required: 5000 },
};

const TIER_ORDER: ClientTier[] = ['Rookie', 'Scholar', 'Expert', 'Legend'];

// Feature key → human readable metadata
const FEATURE_META: Record<string, { label: string; description: string; unlockedAt: ClientTier }> = {
  basic_dashboard:          { label: 'Study Dashboard',        description: 'Track your daily sessions and progress.',          unlockedAt: 'Rookie' },
  study_streaks:            { label: 'Study Streaks',          description: 'Daily streak tracking with milestone rewards.',      unlockedAt: 'Rookie' },
  coin_economy:             { label: 'Coin Economy',           description: 'Earn and spend coins across the platform.',          unlockedAt: 'Rookie' },
  level_progress:           { label: 'Level Progress',         description: 'Track your level progression per subject.',          unlockedAt: 'Rookie' },
  learning_velocity_chart:  { label: 'Learning Velocity',      description: 'See how fast you absorb new material.',              unlockedAt: 'Scholar' },
  error_journal:            { label: 'Error Journal',          description: 'Review your past mistakes for targeted revision.',   unlockedAt: 'Scholar' },
  study_sessions_history:   { label: 'Session History',        description: 'Browse all past study sessions with stats.',         unlockedAt: 'Scholar' },
  chronotype_analysis:      { label: 'Chronotype Analysis',    description: 'Discover your peak study hours.',                    unlockedAt: 'Scholar' },
  peak_study_hours:         { label: 'Peak Hours Chart',       description: 'Visualise when you study best.',                     unlockedAt: 'Scholar' },
  weekly_highlight_reel:    { label: 'Weekly Highlight Reel',  description: 'Personalized weekly performance summary.',           unlockedAt: 'Scholar' },
  exam_readiness_forecast:  { label: 'Exam Readiness',         description: 'AI-powered exam readiness score.',                   unlockedAt: 'Expert' },
  knowledge_decay_alerts:   { label: 'Decay Alerts',           description: 'Get notified when knowledge starts fading.',         unlockedAt: 'Expert' },
  topic_forecasts:          { label: 'Topic Forecasts',        description: 'Predicted mastery timelines per topic.',             unlockedAt: 'Expert' },
  comparative_analytics:    { label: 'Comparative Analytics',  description: 'See how you rank vs the platform average.',          unlockedAt: 'Expert' },
  percentile_ranking:       { label: 'Percentile Ranking',     description: 'Your global percentile across all users.',            unlockedAt: 'Expert' },
  subject_mastery_radar:    { label: 'Mastery Radar',          description: 'Spider chart of subject-level mastery.',             unlockedAt: 'Expert' },
  efficiency_score:         { label: 'Efficiency Score',       description: 'Score measuring study ROI and retention quality.',   unlockedAt: 'Legend' },
  historical_trend_analysis:{ label: 'Historical Trends',      description: 'Multi-month progress trends and inflection points.', unlockedAt: 'Legend' },
  advanced_predictions:     { label: 'Advanced Predictions',   description: 'AI predictions for subject mastery completion.',     unlockedAt: 'Legend' },
  elite_badge:              { label: 'Elite Badge',            description: 'Exclusive badge shown on your profile.',             unlockedAt: 'Legend' },
  exclusive_insights:       { label: 'Exclusive Insights',     description: 'Unique insights only Legend-tier users see.',        unlockedAt: 'Legend' },
  mentor_mode:              { label: 'Mentor Mode',            description: 'Help and guide other students on the platform.',     unlockedAt: 'Legend' },
};

export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth());

  // ─── GET /profile/unlock-status — Raw service data (internal / admin) ─
  fastify.get('/unlock-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const status = await progressiveProfileService.getProfileStatus(userId);
    return reply.send({ success: true, data: status, timestamp: new Date().toISOString() });
  });

  // ─── GET /profile/tiers — Client-facing tier status ───────
  // Maps the account-age-based backend tiers to the XP-based tier
  // structure (Rookie / Scholar / Expert / Legend) expected by the
  // mobile client's profile-tiers.tsx screen.
  //
  // Psychology: Escalation of Commitment — the more a user invests,
  // the costlier it feels to leave. Progressive feature unlocks create
  // both a sunk cost (their data) and a reward schedule (new features).
  fastify.get('/tiers', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;

    const raw = await progressiveProfileService.getProfileStatus(userId);

    // Resolve which client tier the user is currently on based on account age tier name
    const rawTierName = raw.currentTier.replace(/^[^a-zA-Z]*/, '').trim(); // strip emoji prefix
    const clientTier: ClientTier = AGE_TIER_TO_CLIENT[rawTierName] ?? 'Rookie';
    const clientTierIndex = TIER_ORDER.indexOf(clientTier);

    // Derive an XP proxy from unlockedFeatures count (each feature = 100 XP)
    // This gives a smooth XP bar even though the real gate is account age.
    const xpCurrent = raw.unlockedFeatures.length * 100;
    const nextClientTier = TIER_ORDER[clientTierIndex + 1] ?? null;
    const xpRequired = nextClientTier ? TIER_XP[nextClientTier].required : xpCurrent;
    const percentToNext = xpRequired > 0 ? Math.min((xpCurrent / xpRequired) * 100, 100) : 100;

    // Map each feature key to a structured ProfileFeatureUnlock
    const buildFeatureUnlock = (featureKey: string, isUnlocked: boolean) => {
      const meta = FEATURE_META[featureKey] ?? {
        label: featureKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        description: 'Available at this tier.',
        unlockedAt: 'Rookie' as ClientTier,
      };
      return {
        feature: featureKey,
        label: meta.label,
        description: meta.description,
        unlockedAt: meta.unlockedAt,
        isUnlocked,
      };
    };

    const unlockedFeatures = raw.unlockedFeatures.map((f) => buildFeatureUnlock(f, true));

    // Derive locked features from tiers beyond current
    const lockedFeatureKeys = raw.tiers
      .filter((t) => !t.unlocked)
      .flatMap((t) => t.features)
      .filter((f) => !raw.unlockedFeatures.includes(f));
    const lockedFeatures = lockedFeatureKeys.map((f) => buildFeatureUnlock(f, false));

    return reply.send({
      success: true,
      data: {
        currentTier: clientTier,
        nextTier: nextClientTier,
        xpCurrent,
        xpRequired,
        percentToNext: Math.round(percentToNext),
        unlockedFeatures,
        lockedFeatures,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /profile/weekly-highlight — Latest highlight reel ─
  // Returns the most recent weekly summary.
  // Schema is mapped to match the mobile client's WeeklyHighlight interface.
  fastify.get('/weekly-highlight', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;

    const raw = await weeklyHighlightService.getLatestHighlight(userId);

    if (!raw) {
      return reply.send({ success: true, data: null, timestamp: new Date().toISOString() });
    }

    // Map backend schema → mobile client WeeklyHighlight interface
    const weekStart = new Date(raw.weekStarting);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const mapped = {
      userId:         raw.userId,
      weekLabel:      `${fmt(weekStart)} – ${fmt(weekEnd)}`,
      cardsStudied:   raw.totalAnswers,
      correctAnswers: raw.correctAnswers,
      accuracy:       raw.accuracy,
      bestStreak:     raw.currentStreak,
      topSubject:     null,  // not tracked in current service — future enhancement
      coinsEarned:    raw.coinsEarned,
      minutesStudied: raw.totalMinutes,
      headline:       raw.headlineStat,
      generatedAt:    new Date().toISOString(),
    };

    return reply.send({ success: true, data: mapped, timestamp: new Date().toISOString() });
  });
}
