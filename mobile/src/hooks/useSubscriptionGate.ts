// ─── useSubscriptionGate ──────────────────────────────────────
// Single hook for all screens. Encapsulates subscription gating
// logic so screens never import SubscriptionContext directly.

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSubscription } from '../contexts/SubscriptionContext';
import type { PlanFeatures } from '@kd/shared';

export interface SubscriptionGate {
  /** True when user has any active subscription (incl. trial) */
  isSubscribed: boolean;
  /** 0 = free, 1 = Basic, 2 = Pro, 3 = Master */
  planTier: 0 | 1 | 2 | 3;
  /** Check a named PlanFeatures key */
  canUseFeature: (key: keyof PlanFeatures) => boolean;
  /** Max decks (-1 = unlimited, 0 = no access) */
  maxDecks: number;
  /** Max exams allowed per day (-1 = unlimited) */
  maxExamsPerDay: number;
  /** Max subjects per exam (-1 = unlimited) */
  maxSubjectsPerExam: number;
  /**
   * Max level index (0=Beginner … 5=Master) the user can access.
   * -1 means all levels are accessible.
   */
  maxLevelIndex: number;
  /** Returns true if user has hit their deck limit */
  isDeckLimitReached: (currentCount: number) => boolean;
  /** Returns true if examsUsedToday >= daily limit */
  isDailyLimitReached: (examsUsedToday: number) => boolean;
  /** Returns true if the subject at display-index is locked for this tier */
  isSubjectLocked: (index: number) => boolean;
  /** Returns true if level at levelIndex (0-5) is tier-locked regardless of unlock progress */
  isLevelTierLocked: (levelIndex: number) => boolean;
  /** Navigate to subscription screen */
  goToUpgrade: () => void;
}

export function useSubscriptionGate(): SubscriptionGate {
  const { isSubscribed, planTier, hasFeature, subscription } = useSubscription();
  const router = useRouter();

  const features = subscription?.plan?.features;
  const maxDecks: number =
    typeof features?.max_decks === 'number' ? features.max_decks : -1;
  const maxExamsPerDay: number =
    typeof features?.max_exams_per_day === 'number' ? features.max_exams_per_day : -1;
  const maxSubjectsPerExam: number =
    typeof features?.max_subjects_per_exam === 'number' ? features.max_subjects_per_exam : 3;
  // max_level: 1=Beginner only (index 0), 2=+Rookie (index 0-1), -1=all
  const maxLevelIndex: number =
    typeof features?.max_level === 'number'
      ? features.max_level === -1 ? 5 : features.max_level - 1
      : 1; // free: Beginner + Rookie (same as Basic)

  const canUseFeature = useCallback(
    (key: keyof PlanFeatures): boolean => hasFeature(key),
    [hasFeature],
  );

  const isDeckLimitReached = useCallback(
    (currentCount: number): boolean => {
      if (!isSubscribed) return true; // free: no decks
      if (maxDecks === -1) return false; // unlimited
      return currentCount >= maxDecks;
    },
    [isSubscribed, maxDecks],
  );

  const isDailyLimitReached = useCallback(
    (examsUsedToday: number): boolean => {
      if (maxExamsPerDay === -1) return false; // unlimited
      return examsUsedToday >= maxExamsPerDay;
    },
    [maxExamsPerDay],
  );

  const isSubjectLocked = useCallback(
    (index: number): boolean => {
      if (maxSubjectsPerExam === -1) return false;
      return index >= maxSubjectsPerExam;
    },
    [maxSubjectsPerExam],
  );

  const isLevelTierLocked = useCallback(
    (levelIndex: number): boolean => {
      return levelIndex > maxLevelIndex;
    },
    [maxLevelIndex],
  );

  const goToUpgrade = useCallback(() => {
    router.push('/subscription');
  }, [router]);

  return {
    isSubscribed,
    planTier,
    canUseFeature,
    maxDecks,
    maxExamsPerDay,
    maxSubjectsPerExam,
    maxLevelIndex,
    isDeckLimitReached,
    isDailyLimitReached,
    isSubjectLocked,
    isLevelTierLocked,
    goToUpgrade,
  };
}
