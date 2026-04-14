// ─── useSubjects ──────────────────────────────────────────────
// TanStack Query hooks for the Exam → Subject → Level flow.
// All API calls use centralized contracts from api-contracts.ts.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchExamSubjects,
  fetchSubjectLevelSummary,
  fetchExamProgress,
} from '../services/api-contracts';
import { api } from '../services/api';
import type { Subject, SubjectLevelSummary, ExamProgress, LevelAnswerResult } from '@kd/shared';
import type { SubjectLevel } from '@kd/shared';
import { gamificationKeys } from './useGamification';

// ─── Query Keys ──────────────────────────────────────────────

export const subjectKeys = {
  all: ['subjects'] as const,
  byExam: (examId: string) => ['subjects', 'exam', examId] as const,
  topics: (subjectId: string) => ['subjects', 'topics', subjectId] as const,
  levelSummary: (examId: string, subjectId: string, topicSlug: string) =>
    ['subjects', 'levelSummary', examId, subjectId, topicSlug] as const,
  examProgress: (examId: string) => ['subjects', 'examProgress', examId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────

/** Fetch all subjects mapped to an exam (ordered). */
export function useExamSubjects(examId: string) {
  return useQuery({
    queryKey: subjectKeys.byExam(examId),
    queryFn: () => fetchExamSubjects(examId),
    enabled: !!examId,
    staleTime: 5 * 60 * 1000, // 5 min — subject list rarely changes
  });
}

/** Fetch all 6 LevelProgress records for a (subject, exam, topic) triple. */
export function useSubjectLevelSummary(examId: string, subjectId: string, topicSlug: string) {
  return useQuery({
    queryKey: subjectKeys.levelSummary(examId, subjectId, topicSlug),
    queryFn: () => fetchSubjectLevelSummary(examId, subjectId, topicSlug),
    enabled: !!examId && !!subjectId && !!topicSlug,
    staleTime: 30_000, // 30s — refetch frequently to stay in sync
  });
}

/** Fetch highest unlocked level per subject for an exam (used by Subject List). */
export function useExamProgress(examId: string, subjectIds: string[]) {
  return useQuery({
    queryKey: [...subjectKeys.examProgress(examId), subjectIds.slice().sort().join(',')],
    queryFn: () => fetchExamProgress(examId, subjectIds),
    enabled: !!examId && (subjectIds?.length ?? 0) > 0,
    staleTime: 30_000,
  });
}

/** Fetch all topics for a subject from the dynamic MongoDB endpoint. */
export function useSubjectTopics(subjectId: string) {
  return useQuery<{ slug: string; displayName: string }[]>({
    queryKey: subjectKeys.topics(subjectId),
    queryFn: async () => {
      const { data } = await api.get(`/subjects/${subjectId}/topics`);
      return (data.data as { topics: { slug: string; displayName: string }[] }).topics;
    },
    enabled: !!subjectId,
    staleTime: 300_000, // 5 min — topics rarely change
  });
}

// ─── Mutations ───────────────────────────────────────────────

interface LevelAnswerPayload {
  examId: string;
  subjectId: string;
  topicSlug: string;
  level: SubjectLevel;
  cardId: string;
  selectedAnswerId: string;
  responseTimeMs: number;
}

/** Record one answer in the (subject, exam, level) context.
 *  Automatically invalidates the level summary cache and coin balance on success. */
export function useRecordLevelAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LevelAnswerPayload): Promise<LevelAnswerResult> => {
      const { data } = await api.post<{ data: LevelAnswerResult }>('/progress/level-answer', payload);
      return data?.data as LevelAnswerResult;
    },
    onSuccess: (result, variables) => {
      // Invalidate topic-scoped level summary so the Level Selector screen reflects new progress
      queryClient.invalidateQueries({
        queryKey: subjectKeys.levelSummary(variables.examId, variables.subjectId, variables.topicSlug),
      });
      queryClient.invalidateQueries({
        queryKey: subjectKeys.examProgress(variables.examId),
      });
      // Refresh coin balance in real-time when coins were awarded
      if (result.coinsEarned > 0) {
        queryClient.invalidateQueries({ queryKey: gamificationKeys.coins() });
        queryClient.invalidateQueries({ queryKey: gamificationKeys.coinsToday() });
      }
    },
  });
}
