// ─── useLevelCards ───────────────────────────────────────────
// React Query hook for fetching flashcards scoped to an exam + subject + topic + level.
// Uses the centralized fetchLevelCards contract instead of raw api.get.

import { useQuery } from '@tanstack/react-query';
import { fetchLevelCards } from '../services/api-contracts';
import type { Flashcard } from '@kd/shared';

interface LevelCardsData {
  deckId: string;
  cards: Flashcard[];
}

export function useLevelCards(
  examId?: string,
  subjectId?: string,
  level?: string,
  topicSlug?: string,
) {
  return useQuery({
    queryKey: ['level-cards', examId, subjectId, level, topicSlug] as const,
    queryFn: async (): Promise<LevelCardsData> => {
      const result = await fetchLevelCards(examId!, subjectId!, topicSlug!, level!);
      return {
        deckId: result?.deckId ?? '',
        cards: result?.cards ?? [],
      };
    },
    enabled: !!examId && !!subjectId && !!level && !!topicSlug,
    staleTime: 5 * 60 * 1000, // 5 min — card content rarely changes
  });
}
