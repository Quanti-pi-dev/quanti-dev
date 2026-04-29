// ─── Friend Hooks (React Query) ─────────────────────────────
// Query keys, list queries, and mutations for the friend system.
// Pattern: identical to useGamification.ts.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFriends,
  fetchPendingFriendRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  deleteFriendship,
  removeFriendByUser,
  blockUser,
} from '../services/api-contracts';
import { useGlobalUI } from '../contexts/GlobalUIContext';

export const friendKeys = {
  all: ['friends'] as const,
  list: () => [...friendKeys.all, 'list'] as const,
  pending: () => [...friendKeys.all, 'pending'] as const,
  search: (q: string) => [...friendKeys.all, 'search', q] as const,
};

export function useFriends() {
  return useQuery({
    queryKey: friendKeys.list(),
    queryFn: fetchFriends,
    staleTime: 60_000, // 1 min
  });
}

export function usePendingFriendRequests() {
  return useQuery({
    queryKey: friendKeys.pending(),
    queryFn: fetchPendingFriendRequests,
    staleTime: 30_000, // 30s — friend requests feel urgent
  });
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: friendKeys.search(query),
    queryFn: () => searchUsers(query),
    enabled: query.length >= 2, // Don't search on single chars
    staleTime: 15_000,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.pending() });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
    },
  });
}

export function useDeleteFriendship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFriendship,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  const { showAlert } = useGlobalUI();

  return useMutation({
    mutationFn: removeFriendByUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error?.message || err.message || 'Could not remove friend.';
      showAlert({
        title: 'Error',
        message,
        type: 'error',
        buttons: [{ text: 'OK' }]
      });
    }
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: blockUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
    },
  });
}
