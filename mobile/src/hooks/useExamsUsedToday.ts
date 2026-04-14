// ─── useExamsUsedToday ────────────────────────────────────────
// Tracks the number of exam sessions started today.
// Refactored to React Query for consistency with the rest of the
// data layer (FIX H3 / A2).
//
// Primary source: server endpoint GET /progress/sessions-today
// Invalidate `sessionsKeys.today()` after recording a session
// to keep the count in sync across all screens.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export const sessionsKeys = {
  today: () => ['sessions-today'] as const,
};

export function useExamsUsedToday(): {
  examsUsedToday: number;
  incrementExamsUsedToday: () => Promise<void>;
} {
  const queryClient = useQueryClient();

  const { data: examsUsedToday = 0 } = useQuery({
    queryKey: sessionsKeys.today(),
    queryFn: async () => {
      const res = await api.get('/progress/sessions-today');
      return (res.data?.data?.count ?? 0) as number;
    },
    staleTime: 30_000, // 30s — recheck reasonably often
  });

  const incrementExamsUsedToday = async () => {
    // Optimistic local increment so the UI responds immediately
    queryClient.setQueryData<number>(sessionsKeys.today(), (prev) => (prev ?? 0) + 1);
  };

  return { examsUsedToday, incrementExamsUsedToday };
}
