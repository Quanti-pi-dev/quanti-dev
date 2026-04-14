// ─── Tournament Service ──────────────────────────────────────
// Mobile API functions for tournaments.

import { api } from './api';

export interface Tournament {
  _id: string;
  name: string;
  description: string;
  entryFeeCoins: number;
  requiredTier: number;
  maxParticipants: number;
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  prizeDescription: string;
  prizeCoins: number;
  rules: string;
  deckId: string | null;
  examId: string | null;
  entryCount: number;
  hasEntered?: boolean;
}

export interface TournamentEntry {
  _id: string;
  tournamentId: string;
  userId: string;
  score: number;
  answersCorrect: number;
  answersTotal: number;
  completedAt: string | null;
  joinedAt: string;
}

/** List active + upcoming tournaments */
export async function fetchTournaments(): Promise<Tournament[]> {
  const { data } = await api.get('/tournaments');
  return (data?.data ?? []) as Tournament[];
}

/** Get tournament detail */
export async function fetchTournament(id: string): Promise<Tournament & { hasEntered: boolean }> {
  const { data } = await api.get(`/tournaments/${id}`);
  return data?.data as Tournament & { hasEntered: boolean };
}

/** Enter a tournament */
export async function enterTournament(id: string): Promise<{ entryId: string; message: string }> {
  const { data } = await api.post(`/tournaments/${id}/enter`);
  return data?.data as { entryId: string; message: string };
}

/** Get tournament leaderboard */
export async function fetchLeaderboard(id: string): Promise<TournamentEntry[]> {
  const { data } = await api.get(`/tournaments/${id}/leaderboard`);
  return (data?.data ?? []) as TournamentEntry[];
}

/** Submit score after playing a tournament */
export async function submitTournamentScore(
  id: string,
  score: number,
  answersCorrect: number,
  answersTotal: number,
): Promise<{ updated: boolean; score: number; answersCorrect: number }> {
  const { data } = await api.post(`/tournaments/${id}/score`, {
    score,
    answersCorrect,
    answersTotal,
  });
  return data?.data as { updated: boolean; score: number; answersCorrect: number };
}
