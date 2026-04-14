// ─── Admin Content Hooks ──────────────────────────────────────
// TanStack Query hooks for admin content management:
// exams, subjects, level cards.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { adminApi } from '../services/api';
import {
  adminCreateExamApi,
  adminUpdateExamApi,
  adminDeleteExamApi,
} from '../services/admin-shop-contracts';

// ─── Shared error handler for admin mutations ───────────────

function showMutationError(action: string, err: unknown) {
  const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
  Alert.alert(`${action} Failed`, message);
}

// ─── Types ──────────────────────────────────────────────────

export interface AdminExam {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationMinutes: number;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubject {
  id: string;
  name: string;
  description?: string;
  iconName?: string;
  accent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFlashcard {
  id: string;
  deckId: string;
  question: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string | null;
  imageUrl: string | null;
  tags: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLevelCards {
  deckId: string | null;
  cardCount: number;
  cards: AdminFlashcard[];
}

// ─── Exam hooks ─────────────────────────────────────────────

export function useAdminExams(page = 1) {
  return useQuery({
    queryKey: ['admin', 'exams', page],
    queryFn: async () => {
      const { data } = await adminApi.get('/exams', { params: { page, pageSize: 50 } });
      return data as { data: AdminExam[]; pagination: { total: number; page: number; pageSize: number } };
    },
  });
}

export function useAdminExam(id: string) {
  return useQuery({
    queryKey: ['admin', 'exam', id],
    queryFn: async () => {
      const { data } = await adminApi.get(`/exams/${id}`);
      return data?.data as AdminExam;
    },
    enabled: !!id,
  });
}

export function useTogglePublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (examId: string) => {
      const { data } = await adminApi.patch(`/exams/${examId}/publish`);
      return data?.data as { id: string; isPublished: boolean };
    },
    // ── Optimistic toggle ──
    onMutate: async (examId) => {
      await qc.cancelQueries({ queryKey: ['admin', 'exams'] });
      const prevPages = qc.getQueriesData<{ data: AdminExam[] }>({ queryKey: ['admin', 'exams'] });
      qc.setQueriesData<{ data: AdminExam[]; pagination: unknown }>(
        { queryKey: ['admin', 'exams'] },
        (old) => old ? { ...old, data: old.data.map((e) => e.id === examId ? { ...e, isPublished: !e.isPublished } : e) } : old!,
      );
      return { prevPages };
    },
    onError: (_err, _id, context) => {
      context?.prevPages?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: (_, __, examId) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exams'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'exam', examId] });
    },
  });
}

// ─── Exam CRUD hooks ────────────────────────────────────────

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => adminCreateExamApi(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (err) => showMutationError('Create Exam', err),
  });
}

export function useUpdateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      adminUpdateExamApi(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (err) => showMutationError('Update Exam', err),
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteExamApi(id),
    // ── Optimistic delete ──
    onMutate: async (deletedId) => {
      await qc.cancelQueries({ queryKey: ['admin', 'exams'] });
      const prevPages = qc.getQueriesData<{ data: AdminExam[] }>({ queryKey: ['admin', 'exams'] });
      qc.setQueriesData<{ data: AdminExam[]; pagination: unknown }>(
        { queryKey: ['admin', 'exams'] },
        (old) => old ? { ...old, data: old.data.filter((e) => e.id !== deletedId) } : old!,
      );
      return { prevPages };
    },
    onError: (_err, _id, context) => {
      context?.prevPages?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
  });
}

// ─── Subject hooks ──────────────────────────────────────────

export function useAdminSubjects() {
  return useQuery({
    queryKey: ['admin', 'subjects'],
    queryFn: async () => {
      const { data } = await adminApi.get('/subjects');
      return (data?.data ?? []) as AdminSubject[];
    },
  });
}

export function useAdminExamSubjects(examId: string) {
  return useQuery({
    queryKey: ['admin', 'exam-subjects', examId],
    queryFn: async () => {
      const { data } = await adminApi.get(`/exams/${examId}/subjects`);
      return (data?.data ?? []) as Array<{
        id: string; examId: string; subjectId: string; order: number;
        subject: AdminSubject | null;
      }>;
    },
    enabled: !!examId,
  });
}

export function useMapSubjectToExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ examId, subjectId, order }: { examId: string; subjectId: string; order?: number }) => {
      const { data } = await adminApi.post(`/exams/${examId}/subjects`, { subjectId, order });
      return data?.data as { id: string; examId: string; subjectId: string; order: number };
    },
    onSuccess: (_, { examId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exam-subjects', examId] });
    },
    onError: (err) => showMutationError('Map Subject', err),
  });
}

export function useReorderSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ examId, subjectId, order }: { examId: string; subjectId: string; order: number }) => {
      await adminApi.patch(`/exams/${examId}/subjects/${subjectId}/order`, { order });
    },
    onSuccess: (_, { examId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exam-subjects', examId] });
    },
    onError: (err) => showMutationError('Reorder Subject', err),
  });
}

export function useRemoveSubjectFromExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ examId, subjectId }: { examId: string; subjectId: string }) => {
      await adminApi.delete(`/exams/${examId}/subjects/${subjectId}`);
    },
    onSuccess: (_, { examId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exam-subjects', examId] });
    },
    onError: (err) => showMutationError('Remove Subject', err),
  });
}

// ─── Level card hooks ────────────────────────────────────────

export function useAdminLevelCards(subjectId: string, level: string, topicSlug: string) {
  return useQuery({
    queryKey: ['admin', 'level-cards', subjectId, level, topicSlug],
    queryFn: async () => {
      const { data } = await adminApi.get(`/subjects/${subjectId}/levels/${level}/cards`, {
        params: { topicSlug },
      });
      return data?.data as AdminLevelCards;
    },
    enabled: !!subjectId && !!level && !!topicSlug,
  });
}

export function useAddLevelCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subjectId, level, topicSlug, card,
    }: {
      subjectId: string;
      level: string;
      topicSlug: string;
      card: {
        question: string;
        options: { id: string; text: string }[];
        correctAnswerId: string;
        explanation?: string | null;
        tags?: string[];
      };
    }) => {
      const { data } = await adminApi.post(
        `/subjects/${subjectId}/levels/${level}/cards`,
        card,
        { params: { topicSlug } },
      );
      return data?.data as { id: string; deckId: string };
    },
    onSuccess: (_, { subjectId, level, topicSlug }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'level-cards', subjectId, level, topicSlug] });
    },
    onError: (err) => showMutationError('Add Card', err),
  });
}

export function useUpdateLevelCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subjectId, level, topicSlug, cardId, updates,
    }: {
      subjectId: string; level: string; topicSlug: string; cardId: string;
      updates: Partial<{ question: string; options: { id: string; text: string }[]; correctAnswerId: string; explanation: string | null }>;
    }) => {
      await adminApi.put(`/subjects/${subjectId}/levels/${level}/cards/${cardId}`, updates);
    },
    onSuccess: (_, { subjectId, level, topicSlug }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'level-cards', subjectId, level, topicSlug] });
    },
    onError: (err) => showMutationError('Update Card', err),
  });
}

export function useDeleteLevelCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subjectId, level, topicSlug, cardId }: { subjectId: string; level: string; topicSlug: string; cardId: string }) => {
      await adminApi.delete(`/subjects/${subjectId}/levels/${level}/cards/${cardId}`, { params: { topicSlug } });
    },
    // ── Optimistic delete ──
    onMutate: async ({ subjectId, level, topicSlug, cardId }) => {
      const key = ['admin', 'level-cards', subjectId, level, topicSlug];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AdminLevelCards>(key);
      qc.setQueryData<AdminLevelCards>(key, (old) =>
        old ? { ...old, cardCount: old.cardCount - 1, cards: old.cards.filter((c) => c.id !== cardId) } : old!,
      );
      return { prev, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(context.key, context.prev);
    },
    onSettled: (_, __, { subjectId, level, topicSlug }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'level-cards', subjectId, level, topicSlug] });
    },
  });
}

// ─── W4: Dynamic Topic Management ─────────────────────────────

export interface TopicEntry {
  id?: string;
  slug: string;
  displayName: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Fetch topic list for a subject from the dynamic MongoDB endpoint.
 */
export function useAdminSubjectTopics(subjectId: string) {
  return useQuery<{ subjectName: string; topics: TopicEntry[] }>({
    queryKey: ['admin', 'subject-topics', subjectId],
    queryFn: async () => {
      const { data } = await adminApi.get(`/subjects/${subjectId}/topics`);
      return data.data as { subjectName: string; topics: TopicEntry[] };
    },
    enabled: !!subjectId,
    staleTime: 300_000,
  });
}

/**
 * Create a new topic for a subject.
 */
export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subjectId, slug, displayName, order }: {
      subjectId: string; slug: string; displayName: string; order?: number;
    }) => {
      const { data } = await adminApi.post(`/subjects/${subjectId}/topics`, {
        slug, displayName, order,
      });
      return data.data as TopicEntry;
    },
    onSuccess: (_data, { subjectId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'subject-topics', subjectId] });
    },
    onError: (err) => showMutationError('Create Topic', err),
  });
}

/**
 * Update an existing topic.
 */
export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subjectId, topicId, updates }: {
      subjectId: string; topicId: string;
      updates: Partial<{ slug: string; displayName: string; order: number }>;
    }) => {
      const { data } = await adminApi.patch(`/subjects/${subjectId}/topics/${topicId}`, updates);
      return data.data as TopicEntry;
    },
    onSuccess: (_data, { subjectId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'subject-topics', subjectId] });
    },
    onError: (err) => showMutationError('Update Topic', err),
  });
}

/**
 * Delete a topic (blocked if decks exist).
 */
export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subjectId, topicId }: { subjectId: string; topicId: string }) => {
      await adminApi.delete(`/subjects/${subjectId}/topics/${topicId}`);
    },
    onSuccess: (_data, { subjectId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'subject-topics', subjectId] });
    },
    onError: (err) => showMutationError('Delete Topic', err),
  });
}

