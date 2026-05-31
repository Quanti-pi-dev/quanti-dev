// ─── Celebration Cascade Service ────────────────────────────
// Multi-stage achievement celebrations that exploit the Peak-End Rule.
//
// Psychology: Peak-End Rule (Kahneman) — people remember experiences
// based on the emotional peak and the ending, not the average.
// A single "Level Unlocked!" toast is forgettable. A cascading
// celebration (unlock → confetti → badge → insight → coin shower)
// creates a memorable emotional PEAK that reinforces the behavior.
//
// Architecture: This service returns a `CelebrationSequence` —
// an ordered array of celebration steps that the mobile client
// plays sequentially. Each step has a type, duration, and payload.
//
// The client maps step types to animations:
//   confetti    → particle explosion
//   badge       → badge reveal + shine
//   coin_shower → falling coins from top
//   stat_card   → slide-in stat display
//   social_card → "Your friends will see this!"
//   streak_fire → growing fire animation




// ─── Types ──────────────────────────────────────────────────

export type CelebrationStepType =
  | 'confetti'
  | 'badge_reveal'
  | 'coin_shower'
  | 'stat_card'
  | 'social_card'
  | 'streak_fire'
  | 'level_up'
  | 'sound_effect';

export interface CelebrationStep {
  /** Step type → client animation mapping */
  type: CelebrationStepType;
  /** Duration in milliseconds */
  durationMs: number;
  /** Delay before starting this step (ms from sequence start) */
  delayMs: number;
  /** Payload varies by type */
  payload: Record<string, unknown>;
}

export interface CelebrationSequence {
  /** Trigger event that caused this celebration */
  trigger: string;
  /** Ordered list of animation steps */
  steps: CelebrationStep[];
  /** Total duration of the sequence in ms */
  totalDurationMs: number;
  /** Whether this celebration should be shared to the friend feed */
  shareToFeed: boolean;
}

// ─── Celebration Builders ───────────────────────────────────

class CelebrationService {
  /**
   * Build a multi-step celebration for a level unlock event.
   * This is the most common celebration and should feel AMAZING.
   */
  buildLevelUnlockCelebration(
    levelName: string,
    subjectName: string,
    coinsEarned: number,
    coinRarity: string,
  ): CelebrationSequence {
    const steps: CelebrationStep[] = [
      // Step 1: Screen flash + sound effect
      {
        type: 'sound_effect',
        durationMs: 500,
        delayMs: 0,
        payload: { sound: 'level_up', volume: 1.0 },
      },
      // Step 2: Level-up banner slides in from top
      {
        type: 'level_up',
        durationMs: 2000,
        delayMs: 200,
        payload: {
          levelName,
          subjectName,
          message: `🔓 ${levelName} Unlocked!`,
        },
      },
      // Step 3: Confetti explosion
      {
        type: 'confetti',
        durationMs: 3000,
        delayMs: 800,
        payload: {
          particleCount: 150,
          spread: 360,
          colors: ['#FFD700', '#FF6B6B', '#48DBFB', '#FF9FF3'],
        },
      },
      // Step 4: Coin shower (amount depends on rarity)
      {
        type: 'coin_shower',
        durationMs: 2000,
        delayMs: 1500,
        payload: {
          coinCount: coinsEarned,
          rarity: coinRarity,
          message: `+${coinsEarned} coins!`,
        },
      },
      // Step 5: Social share prompt
      {
        type: 'social_card',
        durationMs: 3000,
        delayMs: 3000,
        payload: {
          message: `Your friends will see this achievement! 🎉`,
          shareText: `I just unlocked ${levelName} in ${subjectName}! 🔓`,
        },
      },
    ];

    return {
      trigger: 'level_unlock',
      steps,
      totalDurationMs: this.calculateTotalDuration(steps),
      shareToFeed: true,
    };
  }

  /**
   * Build celebration for streak milestones (3, 7, 14, 30, 60, 100 days).
   */
  buildStreakMilestoneCelebration(
    streakDays: number,
    coinsEarned: number,
  ): CelebrationSequence {
    const intensity = streakDays >= 30 ? 'epic' : streakDays >= 7 ? 'strong' : 'subtle';

    const steps: CelebrationStep[] = [
      {
        type: 'sound_effect',
        durationMs: 500,
        delayMs: 0,
        payload: { sound: `streak_${intensity}`, volume: 0.8 },
      },
      {
        type: 'streak_fire',
        durationMs: 2500,
        delayMs: 200,
        payload: {
          streakDays,
          intensity,
          message: `🔥 ${streakDays}-day streak!`,
        },
      },
    ];

    if (streakDays >= 7) {
      steps.push({
        type: 'confetti',
        durationMs: 2000,
        delayMs: 1000,
        payload: {
          particleCount: streakDays >= 30 ? 200 : 80,
          spread: 180,
          colors: ['#FF6B6B', '#FF9A3C', '#FFD700'],
        },
      });
    }

    if (coinsEarned > 0) {
      steps.push({
        type: 'coin_shower',
        durationMs: 1500,
        delayMs: 2000,
        payload: { coinCount: coinsEarned, message: `+${coinsEarned} streak bonus!` },
      });
    }

    if (streakDays >= 14) {
      steps.push({
        type: 'social_card',
        durationMs: 3000,
        delayMs: 3000,
        payload: {
          message: `🔥 ${streakDays} days! Your friends will be impressed!`,
          shareText: `${streakDays}-day study streak on Quanti-Pi! 🔥`,
        },
      });
    }

    return {
      trigger: 'streak_milestone',
      steps,
      totalDurationMs: this.calculateTotalDuration(steps),
      shareToFeed: streakDays >= 7,
    };
  }

  /**
   * Build celebration for a legendary coin drop.
   * This should be RARE and UNFORGETTABLE.
   */
  buildLegendaryDropCelebration(coinsEarned: number): CelebrationSequence {
    return {
      trigger: 'legendary_drop',
      steps: [
        {
          type: 'sound_effect',
          durationMs: 500,
          delayMs: 0,
          payload: { sound: 'legendary_drop', volume: 1.0 },
        },
        {
          type: 'confetti',
          durationMs: 4000,
          delayMs: 0,
          payload: {
            particleCount: 300,
            spread: 360,
            colors: ['#FFD700', '#FFA500', '#FF4500'],
          },
        },
        {
          type: 'coin_shower',
          durationMs: 3000,
          delayMs: 500,
          payload: {
            coinCount: coinsEarned,
            rarity: 'legendary',
            message: `✨ LEGENDARY DROP! +${coinsEarned} coins! ✨`,
          },
        },
        {
          type: 'stat_card',
          durationMs: 2000,
          delayMs: 3000,
          payload: {
            stat: '2%',
            label: 'drop chance',
            message: 'Only 2% of answers get this!',
          },
        },
      ],
      totalDurationMs: 5000,
      shareToFeed: true,
    };
  }

  /**
   * Build celebration for badge earned.
   */
  buildBadgeCelebration(
    badgeName: string,
    badgeIcon: string,
    badgeDescription: string,
  ): CelebrationSequence {
    return {
      trigger: 'badge_earned',
      steps: [
        {
          type: 'sound_effect',
          durationMs: 500,
          delayMs: 0,
          payload: { sound: 'badge_earned', volume: 0.9 },
        },
        {
          type: 'badge_reveal',
          durationMs: 3000,
          delayMs: 200,
          payload: {
            badgeName,
            badgeIcon,
            badgeDescription,
            message: `🏅 Badge Earned: ${badgeName}`,
          },
        },
        {
          type: 'confetti',
          durationMs: 2000,
          delayMs: 1000,
          payload: {
            particleCount: 100,
            spread: 270,
            colors: ['#48DBFB', '#A29BFE', '#FF9FF3'],
          },
        },
      ],
      totalDurationMs: 3200,
      shareToFeed: true,
    };
  }

  /**
   * Build celebration for perfect session (100% accuracy).
   */
  buildPerfectSessionCelebration(questionsAnswered: number): CelebrationSequence {
    return {
      trigger: 'perfect_session',
      steps: [
        {
          type: 'sound_effect',
          durationMs: 500,
          delayMs: 0,
          payload: { sound: 'perfect', volume: 0.9 },
        },
        {
          type: 'stat_card',
          durationMs: 2500,
          delayMs: 200,
          payload: {
            stat: '100%',
            label: 'accuracy',
            message: `Perfect! ${questionsAnswered}/${questionsAnswered} correct!`,
          },
        },
        {
          type: 'confetti',
          durationMs: 2000,
          delayMs: 800,
          payload: {
            particleCount: 120,
            spread: 360,
            colors: ['#00CEC9', '#6C5CE7', '#FD79A8'],
          },
        },
      ],
      totalDurationMs: 2800,
      shareToFeed: false,
    };
  }

  /**
   * Build a celebration for a new profile tier unlock.
   */
  buildProfileTierCelebration(
    tierName: string,
    tierIcon: string,
    newFeatures: string[],
  ): CelebrationSequence {
    return {
      trigger: 'profile_tier_unlock',
      steps: [
        {
          type: 'sound_effect',
          durationMs: 500,
          delayMs: 0,
          payload: { sound: 'tier_unlock', volume: 1.0 },
        },
        {
          type: 'badge_reveal',
          durationMs: 3000,
          delayMs: 200,
          payload: {
            badgeName: tierName,
            badgeIcon: tierIcon,
            badgeDescription: `Profile tier unlocked!`,
            message: `${tierIcon} ${tierName} Tier Unlocked!`,
          },
        },
        {
          type: 'stat_card',
          durationMs: 3000,
          delayMs: 2500,
          payload: {
            stat: `${newFeatures.length}`,
            label: 'new features',
            message: `New: ${newFeatures.slice(0, 3).join(', ')}`,
          },
        },
        {
          type: 'confetti',
          durationMs: 2000,
          delayMs: 1500,
          payload: {
            particleCount: 150,
            spread: 360,
            colors: ['#FFD700', '#FF6B6B', '#48DBFB'],
          },
        },
      ],
      totalDurationMs: 5500,
      shareToFeed: true,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private calculateTotalDuration(steps: CelebrationStep[]): number {
    return steps.reduce((max, step) => Math.max(max, step.delayMs + step.durationMs), 0);
  }
}

export const celebrationService = new CelebrationService();
