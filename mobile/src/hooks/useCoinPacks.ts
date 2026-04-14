// ─── Coin Pack Hooks ─────────────────────────────────────────
// React Query hooks for fetching, purchasing, and verifying coin packs.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamificationKeys } from './useGamification';
import {
  fetchCoinPacks,
  initiateCoinPackCheckout,
  verifyCoinPackPayment,
  initiateCustomCoinCheckout,
  type CoinPack,
  type CoinPackCheckoutResult,
  type CoinPackVerifyResult,
  type CustomCoinCheckoutResult,
} from '../services/coinpack.service';

/** Fetch active coin packs */
export function useCoinPacks() {
  return useQuery<CoinPack[]>({
    queryKey: ['coin-packs'],
    queryFn: fetchCoinPacks,
    staleTime: 1000 * 60 * 10, // 10 min cache
  });
}

/** Initiate checkout for a coin pack (creates Razorpay order) */
export function useCoinPackCheckout() {
  return useMutation<CoinPackCheckoutResult, Error, string>({
    mutationFn: (coinPackId: string) => initiateCoinPackCheckout(coinPackId),
  });
}

/** Verify coin pack payment and credit coins */
export function useCoinPackVerify() {
  const queryClient = useQueryClient();

  return useMutation<CoinPackVerifyResult, Error, {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }>({
    mutationFn: verifyCoinPackPayment,
    onSuccess: () => {
      // Invalidate coin balance so the UI updates immediately
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.coins() });
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.all });
    },
  });
}

/** Initiate custom coin purchase — any amount at 1 Rupee = 1 Coin */
export function useCustomCoinCheckout() {
  return useMutation<CustomCoinCheckoutResult, Error, number>({
    mutationFn: (coins: number) => initiateCustomCoinCheckout(coins),
  });
}
