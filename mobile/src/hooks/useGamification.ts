import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCoinBalance,
  fetchUserBadges,
  fetchLeaderboard,
  fetchShopItems,
  purchaseShopItem,
  fetchCoinHistory,
  fetchUnlockedDecks,
  fetchCoinsToday,
  fetchAdminAnalytics,
  fetchLevelProgressSummary,
} from '../services/api-contracts';
import type { PurchaseEffect } from '@kd/shared';

export const gamificationKeys = {
  all: ['gamification'] as const,
  coins: () => [...gamificationKeys.all, 'coins'] as const,
  coinsToday: () => [...gamificationKeys.all, 'coinsToday'] as const,
  coinHistory: (page: number) => [...gamificationKeys.all, 'coinHistory', page] as const,
  badges: () => [...gamificationKeys.all, 'badges'] as const,
  leaderboard: (type: string) => [...gamificationKeys.all, 'leaderboard', type] as const,
  shop: () => [...gamificationKeys.all, 'shop'] as const,
  unlockedDecks: () => [...gamificationKeys.all, 'unlockedDecks'] as const,
  adminAnalytics: () => [...gamificationKeys.all, 'admin', 'analytics'] as const, // FIX A4
};

export function useCoinBalance() {
  return useQuery({
    queryKey: gamificationKeys.coins(),
    queryFn: fetchCoinBalance,
    staleTime: 60_000, // 1 min — coins are important but don't change second-by-second
  });
}

export function useCoinHistory(page = 1) {
  return useQuery({
    queryKey: gamificationKeys.coinHistory(page),
    queryFn: () => fetchCoinHistory(page, 20),
  });
}

export function useUserBadges() {
  return useQuery({
    queryKey: gamificationKeys.badges(),
    queryFn: fetchUserBadges,
    staleTime: 300_000, // 5 min — badges change infrequently
  });
}

export function useLeaderboard(type: 'global' | 'weekly' = 'global') {
  return useQuery({
    queryKey: gamificationKeys.leaderboard(type),
    queryFn: () => fetchLeaderboard(type, 100),
    staleTime: 300_000, // 5 min — leaderboard positions don't change rapidly
  });
}

export function useShopItems() {
  return useQuery({
    queryKey: gamificationKeys.shop(),
    queryFn: fetchShopItems,
    staleTime: 60_000, // 1 min
  });
}

export function useUnlockedDecks() {
  return useQuery({
    queryKey: gamificationKeys.unlockedDecks(),
    queryFn: fetchUnlockedDecks,
    staleTime: 60_000, // 1 min
  });
}

export function usePurchaseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: purchaseShopItem,
    onSuccess: (result: { message: string; effect: PurchaseEffect | null }) => {
      // Always invalidate coin balance after a purchase
      queryClient.invalidateQueries({ queryKey: gamificationKeys.coins() });
      // Also invalidate coin history so the spend shows up
      queryClient.invalidateQueries({ queryKey: gamificationKeys.all });
      // Refresh today's earnings widget
      queryClient.invalidateQueries({ queryKey: gamificationKeys.coinsToday() });

      // If a flashcard pack was unlocked, invalidate the unlocked decks list
      if (result.effect?.type === 'flashcard_pack') {
        queryClient.invalidateQueries({ queryKey: gamificationKeys.unlockedDecks() });
      }

      // If a power-up was purchased, invalidate streak/progress data (freeze inventory)
      if (result.effect?.type === 'power_up') {
        queryClient.invalidateQueries({ queryKey: ['progress'] });
      }
    },
  });
}

/** Coins earned today vs the 500/day cap. Refreshes every 60 seconds. */
export function useCoinsToday() {
  return useQuery({
    queryKey: gamificationKeys.coinsToday(),
    queryFn: fetchCoinsToday,
    staleTime: 60_000,
  });
}

/** Platform-wide stats for the admin analytics screen. */
export function useAdminAnalytics() {
  return useQuery({
    queryKey: gamificationKeys.adminAnalytics(),
    queryFn: fetchAdminAnalytics,
    staleTime: 30_000, // 30s — fresh enough for an admin dashboard
  });
}

/** All subjects the user has studied, with their highest reached level. */
export function useLevelProgressSummary() {
  return useQuery({
    queryKey: ['progress', 'levelSummary'] as const,
    queryFn: fetchLevelProgressSummary,
    staleTime: 60_000,
  });
}

/** Revenue dashboard combining subscription + coin pack revenue. */
export function useRevenueDashboard() {
  return useQuery({
    queryKey: ['admin', 'revenue-dashboard'] as const,
    queryFn: async () => {
      const { adminApi } = await import('../services/api');
      const { data } = await adminApi.get('/analytics/revenue-dashboard');
      return data?.data as {
        subscriptions: { totalRevenuePaise: number; paymentCount: number; last7dPaise: number; last30dPaise: number };
        coinPacks: { totalRevenuePaise: number; purchaseCount: number; last7dPaise: number; last30dPaise: number };
        totalRevenuePaise: number;
        totalUsers: number;
        activeToday: number;
      };
    },
    staleTime: 30_000,
  });
}
