import { useQuery } from '@tanstack/react-query';
import { fetchInsights, fetchRecommendations } from '../services/api-contracts';
import type { InsightsResponse } from '../services/api-contracts';

export type Recommendation = Awaited<ReturnType<typeof fetchRecommendations>>[number];
export type LearnInsights = InsightsResponse;

export const aiKeys = {
  all: ['ai'] as const,
  recommendations: () => [...aiKeys.all, 'recommendations'] as const,
  insights: () => [...aiKeys.all, 'insights'] as const,
};

export function useRecommendations() {
  return useQuery({
    queryKey: aiKeys.recommendations(),
    queryFn: fetchRecommendations,
    staleTime: 300_000, // 5 min — AI computation is expensive (FIX P4)
  });
}

export function useInsights() {
  return useQuery({
    queryKey: aiKeys.insights(),
    queryFn: fetchInsights,
    staleTime: 600_000, // 10 min — insights rarely change mid-session (FIX P4)
  });
}

