// ─── Tournament Hooks ────────────────────────────────────────
// React Query hooks for tournament data.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamificationKeys } from './useGamification';
import {
  fetchTournaments,
  fetchTournament,
  enterTournament,
  fetchLeaderboard,
  submitTournamentScore,
} from '../services/tournament.service';

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: fetchTournaments,
    staleTime: 1000 * 60 * 2,
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: ['tournament', id],
    queryFn: () => fetchTournament(id),
    enabled: !!id,
  });
}

export function useTournamentLeaderboard(id: string) {
  return useQuery({
    queryKey: ['tournament-leaderboard', id],
    queryFn: () => fetchLeaderboard(id),
    enabled: !!id,
    staleTime: 1000 * 30,
  });
}

export function useEnterTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enterTournament(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      void queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.coins() });
    },
  });
}

export function useSubmitTournamentScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score, correct, total }: {
      id: string; score: number; correct: number; total: number;
    }) => submitTournamentScore(id, score, correct, total),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['tournament-leaderboard', id] });
      void queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      void queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}
