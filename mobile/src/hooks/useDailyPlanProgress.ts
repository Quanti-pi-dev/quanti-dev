// ─── useDailyPlanProgress ────────────────────────────────────
// Tracks per-session partial / full progress for Today's Study Plan
// in AsyncStorage so the card can immediately reflect mid-session
// state even before the server re-validates the learning profile.
//
// Key schema:  daily_plan_progress:YYYY-MM-DD
// Value schema: Record<topicSlug, SessionProgress>
//
// Usage:
//   const { getProgress, recordProgress } = useDailyPlanProgress();
//   recordProgress('kinematics', { answered: 7, total: 20, isComplete: false });

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateString } from '../utils/time';

// ─── Types ───────────────────────────────────────────────────

export interface SessionProgress {
  /** Cards answered (correct + incorrect, not skipped). */
  answered: number;
  /** Total cards in this session (plan's cardCount). */
  total: number;
  /** Whether the student finished all cards. */
  isComplete: boolean;
  /** ISO timestamp of when the session was first opened. */
  startedAt: string;
  /** ISO timestamp of last update (for staleness detection). */
  updatedAt: string;
}

type DayProgress = Record<string, SessionProgress>;

// ─── Storage helpers ─────────────────────────────────────────

const storageKey = (date: string) => `daily_plan_progress:${date}`;

async function readDay(date: string): Promise<DayProgress> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(date));
    return raw ? (JSON.parse(raw) as DayProgress) : {};
  } catch {
    return {};
  }
}

async function writeDay(date: string, data: DayProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(date), JSON.stringify(data));
  } catch { /* silently fail — progress will re-compute */ }
}

// Purge entries older than 3 days to avoid stale AsyncStorage bloat.
async function pruneOldDays(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = 'daily_plan_progress:';
    const progressKeys = keys.filter(k => k.startsWith(prefix));
    const today = getLocalDateString();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const staleKeys = progressKeys.filter(k => {
      const dateStr = k.slice(prefix.length);
      return new Date(dateStr) < threeDaysAgo && dateStr !== today;
    });
    if (staleKeys.length > 0) {
      await AsyncStorage.multiRemove(staleKeys);
    }
  } catch { /* non-critical */ }
}

// ─── Hook ────────────────────────────────────────────────────

interface UseDailyPlanProgressResult {
  /** Progress keyed by topicSlug for today. */
  progress: DayProgress;
  /** Record or update a session's progress. */
  recordProgress: (topicSlug: string, update: Omit<SessionProgress, 'startedAt' | 'updatedAt'> & { startedAt?: string }) => Promise<void>;
  /** True while reading the initial AsyncStorage value. */
  isLoading: boolean;
}

export function useDailyPlanProgress(): UseDailyPlanProgressResult {
  const today = getLocalDateString();
  const [progress, setProgress] = useState<DayProgress>({});
  const [isLoading, setIsLoading] = useState(true);
  const progressRef = useRef<DayProgress>({});

  // Load from AsyncStorage on mount
  useEffect(() => {
    let cancelled = false;
    readDay(today).then(data => {
      if (!cancelled) {
        progressRef.current = data;
        setProgress(data);
        setIsLoading(false);
      }
    });
    // Prune on mount (best effort, no await needed)
    pruneOldDays();
    return () => { cancelled = true; };
  }, [today]);

  const recordProgress = useCallback(async (
    topicSlug: string,
    update: Omit<SessionProgress, 'startedAt' | 'updatedAt'> & { startedAt?: string },
  ) => {
    const existing = progressRef.current[topicSlug];
    const next: SessionProgress = {
      answered: update.answered,
      total: update.total,
      isComplete: update.isComplete,
      startedAt: update.startedAt ?? existing?.startedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nextDay: DayProgress = { ...progressRef.current, [topicSlug]: next };
    progressRef.current = nextDay;
    setProgress(nextDay);
    await writeDay(today, nextDay);
  }, [today]);

  return { progress, recordProgress, isLoading };
}
