// ─── Coin Pack API Service ────────────────────────────────────
// Mobile-side API functions for coin pack listing, checkout, and verification.

import { api } from './api';

// ─── Types ───────────────────────────────────────────────────

export interface CoinPack {
  id: string;
  name: string;
  description: string;
  coins: number;
  pricePaise: number;
  badgeText: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CoinPackCheckoutResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  pack: CoinPack;
}

export interface CoinPackVerifyResult {
  coinsAwarded: number;
  newBalance: number;
  alreadyCaptured?: boolean;
}

// ─── API Functions ───────────────────────────────────────────

/** Fetch active coin packs */
export async function fetchCoinPacks(): Promise<CoinPack[]> {
  const { data } = await api.get('/gamify/coin-packs');
  return (data?.data ?? []) as CoinPack[];
}

/** Initiate coin pack checkout (creates Razorpay order) */
export async function initiateCoinPackCheckout(coinPackId: string): Promise<CoinPackCheckoutResult> {
  const { data } = await api.post('/gamify/coin-packs/checkout', { coinPackId });
  return data?.data as CoinPackCheckoutResult;
}

/** Verify coin pack payment and credit coins */
export async function verifyCoinPackPayment(payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<CoinPackVerifyResult> {
  const { data } = await api.post('/gamify/coin-packs/verify', payload);
  return data?.data as CoinPackVerifyResult;
}

// ─── Custom Coin Purchase (1 Rupee = 1 Coin) ────────────────

export interface CustomCoinCheckoutResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  coins: number;
}

/** Initiate custom coin checkout — user picks any amount (min 10, max 100k) */
export async function initiateCustomCoinCheckout(coins: number): Promise<CustomCoinCheckoutResult> {
  const { data } = await api.post('/gamify/coin-packs/custom-checkout', { coins });
  return data?.data as CustomCoinCheckoutResult;
}
