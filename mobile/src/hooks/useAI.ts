// ─── useAI Hooks ─────────────────────────────────────────────
// React Query hooks for AI insights, recommendations, and live card explanations.

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  fetchInsights,
  fetchRecommendations,
  fetchExplainCard,
  fetchExplainWrong,
  type InsightsResponse,
  type Recommendation as RecommendationType,
  type TargetedFeedbackResponse,
} from '../services/api-contracts';

// ─── Re-exports for consumers ────────────────────────────────

export type { InsightsResponse, TargetedFeedbackResponse };
export type AIRecommendation = RecommendationType;

// ─── Query Keys ─────────────────────────────────────────────

export const aiKeys = {
  all: ['ai'] as const,
  recommendations: () => [...aiKeys.all, 'recommendations'] as const,
  insights: () => [...aiKeys.all, 'insights'] as const,
};

// ─── Hooks ──────────────────────────────────────────────────

/**
 * Personalized deck recommendations from study_sessions (accuracy + recency).
 * enabled flag allows gating behind subscription tier.
 */
export function useRecommendations(enabled = true) {
  return useQuery({
    queryKey: aiKeys.recommendations(),
    queryFn: fetchRecommendations,
    staleTime: 3 * 60_000,    // 3 minutes
    gcTime: 10 * 60_000,
    enabled,
    retry: 1,
  });
}

/**
 * Gemini-powered study insights.
 * Includes heuristic data + AI narrative (aiSummary, aiRecommendations) when user
 * has ≥ 3 study sessions.
 */
export function useInsights(enabled = true) {
  return useQuery({
    queryKey: aiKeys.insights(),
    queryFn: fetchInsights,
    staleTime: 5 * 60_000,    // 5 minutes — Gemini calls are expensive
    gcTime: 15 * 60_000,
    enabled,
    retry: 1,
  });
}

/**
 * Mutation for requesting a live Gemini explanation for a specific flashcard.
 *
 * Usage:
 *   const explain = useExplainCard();
 *   const text = await explain.mutateAsync(card.id);
 *
 * The caller should cache the result locally (e.g., in a Map) to avoid
 * redundant API calls when the user re-opens the deep dive on the same card.
 */
export function useExplainCard() {
  return useMutation<string, Error, string>({
    mutationFn: (cardId: string) => fetchExplainCard(cardId),
  });
}

/**
 * Mutation for requesting a targeted, misconception-aware explanation.
 *
 * When a student picks a wrong answer, this calls POST /ai/explain-wrong
 * with both the cardId and the option they selected. The response explains
 * WHY their specific choice was wrong — not just what the right answer is.
 *
 * Usage:
 *   const explainWrong = useExplainWrong();
 *   const feedback = await explainWrong.mutateAsync({ cardId, selectedOptionId });
 */
export function useExplainWrong() {
  return useMutation<TargetedFeedbackResponse | null, Error, { cardId: string; selectedOptionId: string }>({
    mutationFn: ({ cardId, selectedOptionId }) => fetchExplainWrong(cardId, selectedOptionId),
  });
}

