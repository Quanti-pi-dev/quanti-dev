// ─── Subscription Context ────────────────────────────────────
// Stores the user's subscription state, exposes isSubscribed, planTier, hasFeature.
// Also checks for streak-triggered trial passes and merges them into the gate.
// Offline cache: persists to AsyncStorage so gates don't block on network error.

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchMySubscription } from '../services/subscription.service';
import { api } from '../services/api';
import type { SubscriptionSummary } from '@kd/shared';

const CACHE_KEY = 'sub:cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedSubscription {
  data: SubscriptionSummary | null;
  cachedAt: number;
}

// ─── Trial Pass Types ────────────────────────────────────────

export interface TrialPassStatus {
  active: boolean;
  expiresAt: string | null;
  remainingSeconds: number;
  durationDays: number;
}

interface SubscriptionContextValue {
  subscription: SubscriptionSummary | null;
  isLoading: boolean;
  isSubscribed: boolean;
  planTier: 0 | 1 | 2 | 3;
  hasFeature: (key: string) => boolean;
  refreshSubscription: () => Promise<void>;
  setSubscription: (s: SubscriptionSummary | null) => void;
  /** Trial pass state (streak-triggered) */
  trialPass: TrialPassStatus | null;
}

const defaultValue: SubscriptionContextValue = {
  subscription: null,
  isLoading: true,
  isSubscribed: false,
  planTier: 0,
  hasFeature: () => false,
  refreshSubscription: async () => {},
  setSubscription: () => {},
  trialPass: null,
};

const SubscriptionContext = createContext<SubscriptionContextValue>(defaultValue);

// ─── Trial Pass Fetcher ──────────────────────────────────────

async function fetchTrialPass(): Promise<TrialPassStatus | null> {
  try {
    const { data } = await api.get('/subscriptions/trial-pass');
    return (data?.data ?? null) as TrialPassStatus | null;
  } catch {
    return null;
  }
}

// ─── Provider ────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscriptionState] = useState<SubscriptionSummary | null>(null);
  const [trialPass, setTrialPass] = useState<TrialPassStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Load cache from AsyncStorage on mount ──────────────
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then((raw: string | null) => {
      if (!raw) return;
      try {
        const cached: CachedSubscription = JSON.parse(raw);
        const age = Date.now() - cached.cachedAt;
        if (age < CACHE_TTL_MS) {
          setSubscriptionState(cached.data);
          setIsLoading(false);
        }
      } catch {
        // Corrupt cache — ignore
      }
    }).catch(() => {});
  }, []);

  const persistCache = useCallback(async (data: SubscriptionSummary | null) => {
    try {
      const entry: CachedSubscription = { data, cachedAt: Date.now() };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
      // Non-critical — storage may be unavailable
    }
  }, []);

  const setSubscription = useCallback((s: SubscriptionSummary | null) => {
    setSubscriptionState(s);
    void persistCache(s);
  }, [persistCache]);

  const refreshSubscription = useCallback(async () => {
    try {
      const [data, pass] = await Promise.all([
        Promise.race([
          fetchMySubscription(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Subscription fetch timeout')), 10_000),
          ),
        ]),
        fetchTrialPass(),
      ]);
      setSubscription(data);
      setTrialPass(pass);
    } catch {
      // Network failure or timeout — keep existing state
    } finally {
      setIsLoading(false);
    }
  }, [setSubscription]);

  useEffect(() => { refreshSubscription(); }, [refreshSubscription]);

  const hasFeature = useCallback(
    (key: string): boolean => {
      // If user has a regular subscription, check its features
      if (subscription?.isActive) {
        const f = subscription.plan?.features as unknown as Record<string, unknown> | undefined;
        return !!f?.[key];
      }
      // If user has an active trial pass, grant Pro-level features
      if (trialPass?.active) return true;
      return false;
    },
    [subscription, trialPass],
  );

  // Derive effective plan tier:
  // - Regular subscription tier takes priority
  // - Active trial pass grants tier 2 (Pro)
  // - Otherwise tier 0 (free)
  const effectiveTier = useMemo((): 0 | 1 | 2 | 3 => {
    if (subscription?.isActive) return (subscription.plan?.tier ?? 0) as 0 | 1 | 2 | 3;
    if (trialPass?.active) return 2; // Pro during trial pass
    return 0;
  }, [subscription, trialPass]);

  const isSubscribed = !!subscription?.isActive || !!trialPass?.active;

  const value = useMemo<SubscriptionContextValue>(() => ({
    subscription,
    isLoading,
    isSubscribed,
    planTier: effectiveTier,
    hasFeature,
    refreshSubscription,
    setSubscription,
    trialPass,
  }), [subscription, isLoading, isSubscribed, effectiveTier, hasFeature, refreshSubscription, setSubscription, trialPass]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}

