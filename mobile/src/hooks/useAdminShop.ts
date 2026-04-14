// ─── Admin Shop Hooks ─────────────────────────────────────────
// TanStack Query hooks for admin shop item CRUD with optimistic updates.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ShopItem } from '@kd/shared';
import {
  adminFetchShopItems,
  adminCreateShopItem,
  adminUpdateShopItem,
  adminDeleteShopItem,
} from '../services/admin-shop-contracts';

const SHOP_KEY = ['admin', 'shop-items'] as const;

export function useAdminShopItems() {
  return useQuery<ShopItem[]>({
    queryKey: [...SHOP_KEY],
    queryFn: adminFetchShopItems,
  });
}

export function useCreateShopItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => adminCreateShopItem(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...SHOP_KEY] });
    },
  });
}

export function useUpdateShopItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      adminUpdateShopItem(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...SHOP_KEY] });
    },
  });
}

export function useDeleteShopItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteShopItem(id),
    // ── Optimistic delete ──
    onMutate: async (deletedId) => {
      await qc.cancelQueries({ queryKey: [...SHOP_KEY] });
      const prev = qc.getQueryData<ShopItem[]>([...SHOP_KEY]);
      qc.setQueryData<ShopItem[]>([...SHOP_KEY], (old) =>
        old ? old.filter((i) => i.id !== deletedId) : [],
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData([...SHOP_KEY], context.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...SHOP_KEY] });
    },
  });
}
