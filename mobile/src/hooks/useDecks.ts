import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Deck, Flashcard, PaginatedResponse } from '@kd/shared';

// ─── Query Keys ─────────────────────────────────────────────

export const deckKeys = {
  all: ['decks'] as const,
  lists: () => [...deckKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...deckKeys.lists(), filters] as const,
  detail: (id: string) => [...deckKeys.all, 'detail', id] as const,
  cards: (id: string) => [...deckKeys.all, 'cards', id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────

export function useDecks(pageSize = 10) {
  return useInfiniteQuery({
    queryKey: deckKeys.lists(),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<PaginatedResponse<Deck>>('/decks', {
        params: { page: pageParam, pageSize },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min — deck lists change infrequently (FIX P2)
    initialPageParam: 1,
    getNextPageParam: (lastPage) => 
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
  });
}

export function useDeckCards(deckId: string, decks?: string) {
  return useQuery({
    queryKey: deckId === 'adaptive' ? ['adaptive-cards', decks] : deckKeys.cards(deckId),
    queryFn: async () => {
      if (deckId === 'adaptive') {
        // Use Axios params instead of manual URL construction (FIX H6)
        const deckIds = decks?.split(',').filter(Boolean) ?? [];
        const { data } = await api.get('/study/adaptive', {
          params: { decks: deckIds, pageSize: 100 },
        });
        return data?.data;
      } else {
        const { data } = await api.get<PaginatedResponse<Flashcard>>(`/decks/${deckId}/cards`, {
          params: { pageSize: 100 },
        });
        return data?.data;
      }
    },
    enabled: !!deckId && (deckId === 'adaptive' ? !!decks : true),
    staleTime: 5 * 60 * 1000, // 5 min — card content rarely changes (FIX P3)
  });
}
