// ─── useAIQuota ──────────────────────────────────────────────
// Fetches and caches the user's current daily AI quota status.
// Automatically refreshes after each AI call via queryClient.invalidateQueries.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { AIQuotaStatus } from '@kd/shared';

export const AI_QUOTA_KEY = ['ai-quota'] as const;

async function fetchAIQuota(): Promise<AIQuotaStatus> {
  const { data } = await api.get('/ai/quota');
  return data?.data as AIQuotaStatus;
}

export function useAIQuota() {
  return useQuery<AIQuotaStatus | null>({
    queryKey: AI_QUOTA_KEY,
    queryFn: fetchAIQuota,
    staleTime: 5 * 60_000,  // 5 minutes — quota changes only on AI calls
    gcTime: 10 * 60_000,
    retry: 1,
  });
}

/**
 * Returns a callback that invalidates the quota cache.
 * Call this after every successful AI mutation so the UI reflects the new count.
 */
export function useInvalidateAIQuota() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: AI_QUOTA_KEY });
}
