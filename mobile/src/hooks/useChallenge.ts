// ─── Challenge Hooks (React Query) ──────────────────────────
// Queries + mutations for the P2P challenge system.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  fetchPendingChallenges,
  fetchActiveChallenge,
  fetchChallengeHistory,
  fetchChallengeDetail,
  createChallenge,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  submitChallengeAnswer,
} from '../services/api-contracts';
import type { CreateChallengeInput } from '../services/api-contracts';
import { gamificationKeys } from './useGamification';
import { useGlobalUI } from '../contexts/GlobalUIContext';

export const challengeKeys = {
  all: ['challenges'] as const,
  pending: () => [...challengeKeys.all, 'pending'] as const,
  active: () => [...challengeKeys.all, 'active'] as const,
  history: (page: number) => [...challengeKeys.all, 'history', page] as const,
  detail: (id: string) => [...challengeKeys.all, id] as const,
};

/** Pending invites (opponent's inbox). Auto-refreshes every 5s when enabled.
 *  FIX PF1: Pass `enabled: false` when the screen is not focused to stop polling. */
export function usePendingChallenges(enabled = true) {
  return useQuery({
    queryKey: challengeKeys.pending(),
    queryFn: fetchPendingChallenges,
    refetchInterval: enabled ? 5_000 : false, // Only poll when screen is focused
    staleTime: 3_000,
    enabled,
  });
}

/** Currently active game (at most 1). */
export function useActiveChallenge() {
  return useQuery({
    queryKey: challengeKeys.active(),
    queryFn: fetchActiveChallenge,
    staleTime: 5_000,
  });
}

/** Challenge history (paginated). */
export function useChallengeHistory(page = 1) {
  return useQuery({
    queryKey: challengeKeys.history(page),
    queryFn: () => fetchChallengeHistory(page),
    staleTime: 30_000,
  });
}

/** Single challenge detail. */
export function useChallengeDetail(id: string | null) {
  return useQuery({
    queryKey: challengeKeys.detail(id ?? ''),
    queryFn: () => fetchChallengeDetail(id!),
    enabled: !!id,
    staleTime: 5_000,
  });
}

/** Lobby polling — detail with refetchInterval when waiting for acceptance. */
export function useChallengeDetailPolling(id: string | null) {
  return useQuery({
    queryKey: challengeKeys.detail(id ?? ''),
    queryFn: () => fetchChallengeDetail(id!),
    enabled: !!id,
    refetchInterval: 3_000,
    staleTime: 2_000,
  });
}

/** Create a new challenge. */
export function useCreateChallenge() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showAlert } = useGlobalUI();

  return useMutation({
    mutationFn: (input: CreateChallengeInput) => createChallenge(input),
    onSuccess: (challenge) => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.coins() });
      queryClient.invalidateQueries({ queryKey: challengeKeys.all });
      router.push(`/battles/lobby/${challenge.id}`);
    },
    // FIX U7/U8: Show user-facing error when challenge creation fails
    onError: (err: Error) => {
      showAlert({
        title: 'Challenge Failed',
        message: err.message || 'Could not create the challenge. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
    },
  });
}

/** Accept a challenge. */
export function useAcceptChallenge() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: acceptChallenge,
    onSuccess: (challenge) => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.coins() });
      queryClient.invalidateQueries({ queryKey: challengeKeys.all });
      router.push(`/battles/active/${challenge.id}`);
    },
  });
}

/** Decline a challenge. */
export function useDeclineChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: declineChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: challengeKeys.pending() });
    },
  });
}

/** Cancel a pending challenge (creator). */
export function useCancelChallenge() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: cancelChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.coins() });
      queryClient.invalidateQueries({ queryKey: challengeKeys.all });
      router.replace('/(tabs)/battles' as never);
    },
  });
}

/** Submit an answer during a live game (fire-and-forget). */
export function useSubmitAnswer(challengeId: string) {
  return useMutation({
    mutationFn: ({ cardId, selectedAnswerId }: { cardId: string; selectedAnswerId: string }) =>
      submitChallengeAnswer(challengeId, cardId, selectedAnswerId),
    // Fire-and-forget: errors are logged but never block UI
    onError: (err) => {
      console.warn('[ChallengeAnswer]', err);
    },
  });
}
