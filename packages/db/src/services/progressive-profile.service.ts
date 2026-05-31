// ─── Progressive Profile Service ────────────────────────────
// Gates features and insights by account age to create the
// "Investment" leg of the Hook Model.
//
// Psychology: Escalation of Commitment — the more a user invests,
// the costlier it feels to leave. By progressively unlocking
// deeper analytics as the user's account ages, we create both
// a sunk cost (their data) and a reward schedule (new features).
//
// This also leverages Variable Ratio Scheduling — the user never
// knows exactly WHEN the next unlock will arrive, creating
// anticipation.
//
// Unlock tiers:
//   Day 0  → Basic dashboard + study streaks
//   Day 3  → Learning velocity chart
//   Day 7  → Chronotype analysis (peak study hours)
//   Day 14 → Predictive exam readiness forecast
//   Day 30 → Comparative analytics (vs platform average)
//   Day 60 → Study efficiency score + historical trends
//   Day 90 → "Elite" badge + exclusive insights

import { getRedisClient, getPostgresPool } from '../clients/database.js';


// ─── Types ──────────────────────────────────────────────────

export interface ProfileTier {
  name: string;
  minDays: number;
  features: string[];
  icon: string;
  unlocked: boolean;
  unlocksAt?: string; // ISO date when this tier unlocks (if locked)
  daysUntilUnlock?: number;
}

export interface ProfileUnlockStatus {
  /** Account age in days */
  accountAgeDays: number;
  /** Current tier name */
  currentTier: string;
  /** All tiers with unlock status */
  tiers: ProfileTier[];
  /** Features available at the current tier */
  unlockedFeatures: string[];
  /** Next tier preview (what they'll get next) */
  nextUnlock: ProfileTier | null;
  /** Has a new tier been unlocked since last check? */
  newUnlock: boolean;
}

// ─── Tier Definitions ───────────────────────────────────────

const TIERS: Omit<ProfileTier, 'unlocked' | 'unlocksAt' | 'daysUntilUnlock'>[] = [
  {
    name: 'Starter',
    minDays: 0,
    icon: '🌱',
    features: ['basic_dashboard', 'study_streaks', 'coin_economy', 'level_progress'],
  },
  {
    name: 'Explorer',
    minDays: 3,
    icon: '🔍',
    features: ['learning_velocity_chart', 'error_journal', 'study_sessions_history'],
  },
  {
    name: 'Analyst',
    minDays: 7,
    icon: '📊',
    features: ['chronotype_analysis', 'peak_study_hours', 'weekly_highlight_reel'],
  },
  {
    name: 'Strategist',
    minDays: 14,
    icon: '🎯',
    features: ['exam_readiness_forecast', 'knowledge_decay_alerts', 'topic_forecasts'],
  },
  {
    name: 'Scholar',
    minDays: 30,
    icon: '🎓',
    features: ['comparative_analytics', 'percentile_ranking', 'subject_mastery_radar'],
  },
  {
    name: 'Expert',
    minDays: 60,
    icon: '⚡',
    features: ['efficiency_score', 'historical_trend_analysis', 'advanced_predictions'],
  },
  {
    name: 'Elite',
    minDays: 90,
    icon: '👑',
    features: ['elite_badge', 'exclusive_insights', 'mentor_mode'],
  },
];

// ─── Progressive Profile Service ────────────────────────────

class ProgressiveProfileService {
  private get redis() {
    return getRedisClient();
  }

  private get pg() {
    return getPostgresPool();
  }

  // ─── Get Profile Unlock Status ────────────────────────────

  /**
   * Returns the user's current profile tier and all unlock progress.
   * Called by the mobile client to render the profile page with
   * locked/unlocked feature indicators.
   */
  async getProfileStatus(firebaseUid: string): Promise<ProfileUnlockStatus> {
    const accountAgeDays = await this.getAccountAgeDays(firebaseUid);

    // Build tier list with unlock status
    const tiers: ProfileTier[] = [];
    let currentTier = TIERS[0]!;
    let nextUnlock: ProfileTier | null = null;
    const unlockedFeatures: string[] = [];

    const createdAt = await this.getAccountCreatedAt(firebaseUid);

    for (const tier of TIERS) {
      const unlocked = accountAgeDays >= tier.minDays;

      const profileTier: ProfileTier = {
        ...tier,
        unlocked,
      };

      if (!unlocked) {
        const unlocksAt = new Date(createdAt.getTime() + tier.minDays * 86400000);
        profileTier.unlocksAt = unlocksAt.toISOString();
        profileTier.daysUntilUnlock = tier.minDays - accountAgeDays;

        if (!nextUnlock) {
          nextUnlock = profileTier;
        }
      } else {
        currentTier = tier;
        unlockedFeatures.push(...tier.features);
      }

      tiers.push(profileTier);
    }

    // Check if a new tier was unlocked since last check
    const newUnlock = await this.checkNewUnlock(firebaseUid, currentTier.name);

    return {
      accountAgeDays,
      currentTier: `${currentTier.icon} ${currentTier.name}`,
      tiers,
      unlockedFeatures,
      nextUnlock,
      newUnlock,
    };
  }

  // ─── Feature Gate Check ───────────────────────────────────

  /**
   * Check if a specific feature is unlocked for the user.
   * Used by API routes to gate access to premium analytics.
   */
  async isFeatureUnlocked(firebaseUid: string, feature: string): Promise<boolean> {
    const accountAgeDays = await this.getAccountAgeDays(firebaseUid);

    for (const tier of TIERS) {
      if (tier.minDays > accountAgeDays) break;
      if (tier.features.includes(feature)) return true;
    }

    return false;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async getAccountAgeDays(firebaseUid: string): Promise<number> {
    // Cache in Redis (TTL: 1 hour — doesn't change often)
    const cacheKey = `account_age:${firebaseUid}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return parseInt(cached, 10);

    const result = await this.pg.query(
      `SELECT EXTRACT(DAY FROM NOW() - created_at)::int AS age_days
       FROM users WHERE firebase_uid = $1`,
      [firebaseUid],
    );

    const ageDays = (result.rows[0]?.age_days as number) ?? 0;
    await this.redis.setex(cacheKey, 3600, String(ageDays));
    return ageDays;
  }

  private async getAccountCreatedAt(firebaseUid: string): Promise<Date> {
    const result = await this.pg.query(
      `SELECT created_at FROM users WHERE firebase_uid = $1`,
      [firebaseUid],
    );
    return (result.rows[0]?.created_at as Date) ?? new Date();
  }

  /**
   * Check if the user's current tier changed since last check.
   * Returns true if a new tier was just unlocked (triggers celebration).
   */
  private async checkNewUnlock(firebaseUid: string, currentTierName: string): Promise<boolean> {
    const lastTierKey = `last_profile_tier:${firebaseUid}`;
    const lastTier = await this.redis.get(lastTierKey);

    if (lastTier !== currentTierName) {
      await this.redis.set(lastTierKey, currentTierName);
      // First check ever (lastTier is null) doesn't count as "new"
      return lastTier !== null;
    }

    return false;
  }
}

export const progressiveProfileService = new ProgressiveProfileService();
