// ─── Admin Content Hooks ──────────────────────────────────────
// TanStack Query hooks for admin content management:
// exams, subjects, level cards.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGlobalUI } from '../contexts/GlobalUIContext';
import { adminApi, api } from '../services/api';
import {
  adminCreateExamApi,
  adminUpdateExamApi,
  adminDeleteExamApi,
} from '../services/admin-shop-contracts';

// ─── Module-level showAlert reference ───────────────────────
// Populated by useAdminMutationErrorHandler() which must be called once
// at the root of any admin screen to activate glass alerts.

let _showAlert: ReturnType<typeof useGlobalUI>['showAlert'] | null = null;

/** Call once in the root admin layout to wire up glass alerts. */
export function useAdminMutationErrorHandler() {
  const { showAlert } = useGlobalUI();
  _showAlert = showAlert;
}

function showMutationError(action: string, err: unknown) {
  const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
  if (_showAlert) {
    _showAlert({ title: `${action} Failed`, message, type: 'error' });
  }
}

// ─── Types ──────────────────────────────────────────────────

export interface AdminExam {
  id: string;
  title: string;
  description: string;
  category: string;
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

export function useAdminLevelCards(examId: string, subjectId: string, level: string, topicSlug: string) {
  return useQuery({
    queryKey: ['admin', 'level-cards', examId, subjectId, level, topicSlug],
    queryFn: async () => {
      // Resolve deck via hierarchy endpoint then fetch its cards
      const { data: deckRes } = await adminApi.get(
        `/exams/${examId}/subjects/${subjectId}/topics/${topicSlug}/levels/${level}/deck`,
      );
      const deckId: string = deckRes?.data?.deckId;
      if (!deckId) return { deckId: null, cardCount: 0, cards: [] } as AdminLevelCards;
      const { data } = await adminApi.get(`/decks/${deckId}/flashcards`);
      return {
        deckId,
        cardCount: data?.data?.length ?? 0,
        cards: data?.data ?? [],
      } as AdminLevelCards;
    },
    enabled: !!examId && !!subjectId && !!level && !!topicSlug,
  });
}

export function useAddLevelCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      examId, subjectId, level, topicSlug, card,
    }: {
      examId: string;
      subjectId: string;
      level: string;
      topicSlug: string;
      card: {
        question: string;
        options: { id: string; text: string }[];
        correctAnswerId: string;
        explanation?: string | null;
        imageUrl?: string | null;
        tags?: string[];
      };
    }) => {
      // Resolve deckId from hierarchy, then post to the clean deck endpoint
      const { data: deckRes } = await adminApi.get(
        `/exams/${examId}/subjects/${subjectId}/topics/${topicSlug}/levels/${level}/deck`,
      );
      const deckId: string = deckRes?.data?.deckId;
      if (!deckId) throw new Error('No deck found for this topic/level');
      const { data } = await adminApi.post(`/decks/${deckId}/flashcards`, card);
      return data?.data as { id: string; deckId: string };
    },
    onSuccess: (_, { examId, subjectId, level, topicSlug }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'level-cards', examId, subjectId, level, topicSlug] });
    },
    onError: (err) => showMutationError('Add Card', err),
  });
}

export function useUpdateLevelCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      examId, subjectId, level, topicSlug: _topicSlug, cardId, updates,
    }: {
      examId: string; subjectId: string; level: string; topicSlug: string; cardId: string;
      updates: Partial<{ question: string; options: { id: string; text: string }[]; correctAnswerId: string; explanation: string | null; imageUrl: string | null }>;
    }) => {
      await adminApi.put(`/flashcards/${cardId}`, updates);
    },
    onSuccess: (_, { examId, subjectId, level, topicSlug }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'level-cards', examId, subjectId, level, topicSlug] });
    },
    onError: (err) => showMutationError('Update Card', err),
  });
}

export function useDeleteLevelCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ examId, subjectId, level, topicSlug, deckId, cardId }: {
      examId: string; subjectId: string; level: string; topicSlug: string; deckId: string; cardId: string;
    }) => {
      await adminApi.delete(`/decks/${deckId}/flashcards/${cardId}`);
    },
    onMutate: async ({ examId, subjectId, level, topicSlug, cardId }) => {
      const key = ['admin', 'level-cards', examId, subjectId, level, topicSlug];
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
    onSettled: (_, __, { examId, subjectId, level, topicSlug }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'level-cards', examId, subjectId, level, topicSlug] });
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
 * Create a new topic for a subject (exam-scoped).
 */
export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subjectId, examId, slug, displayName, order }: {
      subjectId: string; examId: string; slug: string; displayName: string; order?: number;
    }) => {
      const { data } = await adminApi.post(
        `/exams/${examId}/subjects/${subjectId}/topics`,
        { slug, displayName, order },
      );
      return data.data as TopicEntry;
    },
    onSuccess: (_data, { subjectId, examId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exam-topics', examId, subjectId] });
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
    mutationFn: async ({ subjectId, examId, topicId, updates }: {
      subjectId: string; examId: string; topicId: string;
      updates: Partial<{ slug: string; displayName: string; order: number }>;
    }) => {
      const { data } = await adminApi.patch(
        `/exams/${examId}/subjects/${subjectId}/topics/${topicId}`,
        updates,
      );
      return data.data as TopicEntry;
    },
    onSuccess: (_data, { subjectId, examId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exam-topics', examId, subjectId] });
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
    mutationFn: async ({ subjectId, examId, topicId }: { subjectId: string; examId: string; topicId: string }) => {
      await adminApi.delete(`/exams/${examId}/subjects/${subjectId}/topics/${topicId}`);
    },
    onSuccess: (_data, { subjectId, examId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exam-topics', examId, subjectId] });
    },
    onError: (err) => showMutationError('Delete Topic', err),
  });
}

/**
 * Bulk import topics for a subject (exam-scoped).
 */
export function useAdminBulkImportTopics() {
  const qc = useQueryClient();
  return useMutation<
    { inserted: number; skipped: number; requested: number },
    Error,
    {
      subjectId: string;
      examId: string;
      topics: { slug: string; displayName: string; order?: number }[];
    }
  >({
    mutationFn: async ({ subjectId, examId, topics }) => {
      const { data } = await adminApi.post(
        `/exams/${examId}/subjects/${subjectId}/topics/bulk`,
        { topics },
      );
      return data.data as { inserted: number; skipped: number; requested: number };
    },
    onSuccess: (_data, { subjectId, examId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'exam-topics', examId, subjectId] });
    },
    onError: (err) => showMutationError('Bulk Import Topics', err),
  });
}


/**
 * Fetch topics for an exam+subject pair (exam-scoped, admin-authenticated).
 * Uses the new /admin/exams/:examId/subjects/:subjectId/topics endpoint.
 */
export function useAdminExamTopics(examId: string, subjectId: string) {
  return useQuery<{ subjectName: string; topics: TopicEntry[] }>({
    queryKey: ['admin', 'exam-topics', examId, subjectId],
    queryFn: async () => {
      const { data } = await adminApi.get(`/exams/${examId}/subjects/${subjectId}/topics`);
      return data.data as { subjectName: string; topics: TopicEntry[] };
    },
    enabled: !!examId && !!subjectId,
    staleTime: 300_000,
  });
}

// ─── PYQ Management Hooks ────────────────────────────────────

export interface PYQCard {
  id: string;
  deckId: string;
  question: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string | null;
  source: 'pyq';
  sourceYear: number | null;
  sourcePaper: string | null;
  tags: string[];
  createdAt: string;
}

export interface PYQPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PYQFilters {
  examId?: string;
  subjectId?: string;
  topicSlug?: string;
  year?: number | null;
  paper?: string | null;
  page?: number;
  pageSize?: number;
}

/** Paginated list of PYQ flashcards with optional exam/subject/topic/year/paper filters. */
export function useAdminPYQ(filters: PYQFilters, enabled = true) {
  return useQuery<{ cards: PYQCard[]; pagination: PYQPagination }>({
    queryKey: ['admin', 'pyq', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.examId)    params['examId']    = filters.examId;
      if (filters.subjectId) params['subjectId'] = filters.subjectId;
      if (filters.topicSlug) params['topicSlug'] = filters.topicSlug;
      if (filters.year)      params['year']      = String(filters.year);
      if (filters.paper)     params['paper']     = filters.paper;
      if (filters.page)      params['page']      = String(filters.page);
      if (filters.pageSize)  params['pageSize']  = String(filters.pageSize);

      const { data } = await adminApi.get('/pyq', { params });
      return data.data as { cards: PYQCard[]; pagination: PYQPagination };
    },
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,  // keep previous data while refetching
  });
}

/** Returns available years and papers for filter dropdowns, scoped to exam/subject. */
export function useAdminPYQMeta(examId?: string, subjectId?: string) {
  return useQuery<{ years: number[]; papers: string[]; total: number }>({
    queryKey: ['admin', 'pyq-meta', examId, subjectId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (examId)    params['examId']    = examId;
      if (subjectId) params['subjectId'] = subjectId;
      const { data } = await adminApi.get('/pyq/meta', { params });
      return data.data as { years: number[]; papers: string[]; total: number };
    },
    enabled: !!(examId || subjectId),
    staleTime: 60_000,
  });
}

export interface PYQBulkImportPayload {
  examId: string;
  subjectId: string;
  topicSlug: string;
  level: string;
  sourceYear: number;
  sourcePaper?: string;
  examLabel?: string;
  cards: {
    question: string;
    options: { id: string; text: string }[];
    correctAnswerId: string;
    explanation?: string | null;
  }[];
}

/** Bulk import PYQ cards with request-level year/paper metadata. */
export function useAdminPYQBulkImport() {
  const queryClient = useQueryClient();
  return useMutation<
    { deckId: string; created: number; requested: number },
    Error,
    PYQBulkImportPayload
  >({
    mutationFn: async (payload) => {
      const { data } = await adminApi.post('/pyq/bulk', payload);
      return data.data as { deckId: string; created: number; requested: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pyq'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pyq-meta'] });
    },
    onError: (err) => showMutationError('PYQ Bulk Import', err),
  });
}

/** Delete a single PYQ card by ID. */
export function useAdminDeletePYQCard() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (cardId: string) => {
      await adminApi.delete(`/pyq/${cardId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pyq'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pyq-meta'] });
    },
    onError: (err) => showMutationError('Delete PYQ Card', err),
  });
}
