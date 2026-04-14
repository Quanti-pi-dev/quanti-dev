// ─── useExams ─────────────────────────────────────────────────
// TanStack Query hook to fetch paginated exam list from the API.

import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Exam, PaginatedResponse } from '@kd/shared';

export const examKeys = {
  all: ['exams'] as const,
  lists: () => [...examKeys.all, 'list'] as const,
};

export function useExams(pageSize = 20) {
  return useInfiniteQuery({
    queryKey: examKeys.lists(),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<PaginatedResponse<Exam>>('/exams', {
        params: { page: pageParam, pageSize },
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    staleTime: 5 * 60 * 1000, // Exams rarely change
  });
}
