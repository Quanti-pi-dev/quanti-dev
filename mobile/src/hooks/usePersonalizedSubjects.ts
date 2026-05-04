// ─── usePersonalizedSubjects ─────────────────────────────────
// Single source of truth for the user's onboarding subjects.
// Previously, Home and Study screens each had their own inline
// useQuery with DIFFERENT query keys — causing duplicate API calls
// and defeating React Query's dedup cache.
//
// Now both screens call this hook. React Query deduplicates automatically.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { fetchExamSubjects } from '../services/api-contracts';
import type { Subject } from '@kd/shared';

export const personalizedSubjectsKeys = {
  all: ['personalized-subjects'] as const,
  byIds: (subjectIds: string[]) =>
    [...personalizedSubjectsKeys.all, subjectIds.join(',')] as const,
};

/**
 * Fetches the full Subject objects for the user's onboarding selections.
 * Returns subjects in the same order as selectedSubjects from preferences.
 *
 * Both the Home and Study screens consume this hook, and React Query
 * deduplicates the fetch since they share the same query key.
 */
export function usePersonalizedSubjects() {
  const { preferences } = useAuth();
  const selectedSubjectIds: string[] = preferences?.selectedSubjects ?? [];
  const selectedExamIds: string[] = preferences?.selectedExams ?? [];
  const isOnboarded = selectedSubjectIds.length > 0;

  return useQuery<Subject[]>({
    queryKey: personalizedSubjectsKeys.byIds(selectedSubjectIds),
    queryFn: async () => {
      const allSubjects = await Promise.all(
        selectedExamIds.map((eid) => fetchExamSubjects(eid)),
      );
      const subjectMap = new Map<string, Subject>();
      for (const batch of allSubjects) {
        for (const s of batch) {
          if (selectedSubjectIds.includes(s.id)) {
            subjectMap.set(s.id, s);
          }
        }
      }
      // Preserve onboarding order
      return selectedSubjectIds
        .map((id) => subjectMap.get(id))
        .filter((s): s is Subject => !!s);
    },
    enabled: isOnboarded && selectedExamIds.length > 0,
    staleTime: 5 * 60_000,
  });
}
