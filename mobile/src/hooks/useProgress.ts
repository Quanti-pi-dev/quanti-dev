import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProgressSummary, recordCompletion as recordCompletionFn, fetchStudyStreak, fetchAdvancedInsights } from '../services/api-contracts';

// ─── Query Keys ─────────────────────────────────────────────

export const progressKeys = {
  all: ['progress'] as const,
  summary: () => [...progressKeys.all, 'summary'] as const,
  streak: () => [...progressKeys.all, 'streak'] as const,
  history: (page: number) => [...progressKeys.all, 'history', page] as const,
  advancedInsights: () => [...progressKeys.all, 'advancedInsights'] as const,
};

// ─── Hooks ──────────────────────────────────────────────────

export function useProgressSummary() {
  return useQuery({
    queryKey: progressKeys.summary(),
    queryFn: fetchProgressSummary,
    staleTime: 60_000, // 1 min — summary changes after study sessions
  });
}

export function useStudyStreak() {
  return useQuery({
    queryKey: progressKeys.streak(),
    queryFn: fetchStudyStreak,
    staleTime: 60_000, // 1 min — streak changes at most once per day
  });
}

export function useRecordCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { deckId: string; cardId: string; correct: boolean; responseTimeMs: number }) =>
      recordCompletionFn(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: progressKeys.summary() });
      queryClient.invalidateQueries({ queryKey: progressKeys.streak() });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}

/** Advanced analytics: chronotype, speed-vs-accuracy, subject strengths. */
export function useAdvancedInsights(enabled = true) {
  return useQuery({
    queryKey: progressKeys.advancedInsights(),
    queryFn: fetchAdvancedInsights,
    staleTime: 120_000, // 2 min — analytics data changes infrequently
    enabled,
  });
}

