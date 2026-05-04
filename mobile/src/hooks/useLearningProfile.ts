// ─── useLearningProfile ──────────────────────────────────────
// Hook for fetching the full learning intelligence profile.
// Powers the redesigned analytics screen: study plan, knowledge
// health, exam readiness, velocity, and topic forecasts.

import { useQuery } from '@tanstack/react-query';
import { fetchLearningProfile } from '../services/api-contracts';
import { progressKeys } from './useProgress';

export const learningProfileKeys = {
  all: [...progressKeys.all, 'learning-profile'] as const,
};

/**
 * Fetch the user's complete learning profile.
 * Available to all tiers (free included).
 */
export function useLearningProfile() {
  return useQuery({
    queryKey: learningProfileKeys.all,
    queryFn: fetchLearningProfile,
    staleTime: 300_000, // 5 min — server caches this + invalidated after study sessions
  });
}
