// ─── Admin Subscription & Plan Hooks ──────────────────────────
// TanStack Query hooks for admin plan CRUD, subscription management,
// manual grants, and user search.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Plan, Subscription, SubscriptionStatus, UserProfile } from '@kd/shared';
import {
  adminFetchPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeletePlan,
  adminFetchSubscriptions,
  adminFetchSubscription,
  adminGrantSubscription,
  adminPatchSubscription,
  adminSearchUsers,
  type CreatePlanInput,
  type AdminSubscriptionListResult,
  type AdminSubscriptionDetail,
  type GrantSubscriptionInput,
} from '../services/api-contracts';

// ─── Plan Hooks ──────────────────────────────────────────────

export function useAdminPlans() {
  return useQuery<Plan[]>({
    queryKey: ['admin', 'plans'],
    queryFn: adminFetchPlans,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanInput) => adminCreatePlan(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreatePlanInput> }) =>
      adminUpdatePlan(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeletePlan(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });
}

// ─── Subscription Hooks ──────────────────────────────────────

export function useAdminSubscriptions(
  page = 1,
  status?: SubscriptionStatus,
  pageSize = 20,
) {
  return useQuery<AdminSubscriptionListResult>({
    queryKey: ['admin', 'subscriptions', page, status, pageSize],
    queryFn: () =>
      adminFetchSubscriptions({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        status,
      }),
  });
}

export function useAdminSubscription(id: string) {
  return useQuery<AdminSubscriptionDetail>({
    queryKey: ['admin', 'subscription', id],
    queryFn: () => adminFetchSubscription(id),
    enabled: !!id,
  });
}

export function useGrantSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantSubscriptionInput) => adminGrantSubscription(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
    },
  });
}

export function usePatchSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { status?: SubscriptionStatus; cancelAtPeriodEnd?: boolean };
    }) => adminPatchSubscription(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'subscription'] });
    },
  });
}

// ─── User Search Hook ─────────────────────────────────────────

export function useSearchUsers(query: string) {
  return useQuery<UserProfile[]>({
    queryKey: ['admin', 'user-search', query],
    queryFn: () => adminSearchUsers(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

// ─── Badge Hooks ──────────────────────────────────────────────

import { adminApi } from '../services/api';

export interface AdminBadge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  criteria: string;
  createdAt: string;
}

export function useAdminBadges() {
  return useQuery<AdminBadge[]>({
    queryKey: ['admin', 'badges'],
    queryFn: async () => {
      const { data } = await adminApi.get('/badges');
      return (data?.data ?? []) as AdminBadge[];
    },
  });
}

export function useCreateBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<AdminBadge, 'id' | 'createdAt'>) => {
      const { data } = await adminApi.post('/badges', input);
      return data?.data as { id: string };
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'badges'] }); },
  });
}

export function useUpdateBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<AdminBadge, 'id' | 'createdAt'>> }) => {
      await adminApi.patch(`/badges/${id}`, updates);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'badges'] }); },
  });
}

export function useDeleteBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await adminApi.delete(`/badges/${id}`); },
    // ── Optimistic delete ──
    onMutate: async (deletedId) => {
      await qc.cancelQueries({ queryKey: ['admin', 'badges'] });
      const prev = qc.getQueryData<AdminBadge[]>(['admin', 'badges']);
      qc.setQueryData<AdminBadge[]>(['admin', 'badges'], (old) =>
        old ? old.filter((b) => b.id !== deletedId) : [],
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData(['admin', 'badges'], context.prev);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin', 'badges'] }); },
  });
}

// ─── Coupon Hooks ─────────────────────────────────────────────

import type { Coupon } from '@kd/shared';

export function useAdminCoupons() {
  return useQuery<Coupon[]>({
    queryKey: ['admin', 'coupons'],
    queryFn: async () => {
      const { data } = await adminApi.get('/coupons');
      return (data?.data ?? []) as Coupon[];
    },
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await adminApi.post('/coupons', input);
      return data?.data as Coupon;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }); },
  });
}

export function usePatchCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: { isActive?: boolean; maxUses?: number | null; validUntil?: string | null } }) => {
      const { data } = await adminApi.patch(`/coupons/${id}`, input);
      return data?.data as Coupon;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }); },
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await adminApi.delete(`/coupons/${id}`); },
    // ── Optimistic delete ──
    onMutate: async (deletedId) => {
      await qc.cancelQueries({ queryKey: ['admin', 'coupons'] });
      const prev = qc.getQueryData<Coupon[]>(['admin', 'coupons']);
      qc.setQueryData<Coupon[]>(['admin', 'coupons'], (old) =>
        old ? old.filter((c) => c.id !== deletedId) : [],
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData(['admin', 'coupons'], context.prev);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }); },
  });
}

// ─── Deck Hooks ───────────────────────────────────────────────

export interface AdminDeck {
  id: string;
  title: string;
  description: string;
  category: string;
  cardCount: number;
  imageUrl: string | null;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function useAdminDecks(page = 1) {
  return useQuery({
    queryKey: ['admin', 'decks', page],
    queryFn: async () => {
      const { data } = await adminApi.get('/decks', { params: { page, pageSize: 50 } });
      return data as { data: AdminDeck[]; pagination: { total: number; page: number; pageSize: number } };
    },
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await adminApi.delete(`/decks/${id}`); },
    // ── Optimistic delete ──
    onMutate: async (deletedId) => {
      await qc.cancelQueries({ queryKey: ['admin', 'decks'] });
      const prevPages = qc.getQueriesData<{ data: AdminDeck[] }>({ queryKey: ['admin', 'decks'] });
      qc.setQueriesData<{ data: AdminDeck[]; pagination: unknown }>(
        { queryKey: ['admin', 'decks'] },
        (old) => old ? { ...old, data: old.data.filter((d) => d.id !== deletedId) } : old!,
      );
      return { prevPages };
    },
    onError: (_err, _id, context) => {
      context?.prevPages?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin', 'decks'] }); },
  });
}
