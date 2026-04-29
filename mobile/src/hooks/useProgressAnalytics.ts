// ─── useProgressAnalytics ─────────────────────────────────────
// Extracts all derived analytics data from raw progress hooks.
// Keeps the screen file lean — just layout and rendering.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useLevelProgressSummary } from './useGamification';
import { progressKeys, useAdvancedInsights } from './useProgress';

// ─── Constants ────────────────────────────────────────────────

/** Number of weeks shown in the heatmap grid. */
const HEATMAP_WEEKS = 5;

/** Assumed max cards per subject for mastery bar (6 levels × 20 cards). */
export const CARDS_PER_SUBJECT = 120;

/** Colors assigned to levels/topics by index. */
export const LEVEL_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#14B8A6'];
export const TOPIC_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6', '#14B8A6'];

// ─── Types ────────────────────────────────────────────────────

interface SessionRecord {
  cardsStudied: number;
  correctAnswers: number;
  startedAt: string;
  endedAt: string;
}

interface ChartPoint {
  label: string;
  value: number;
}

interface TopicBreakdown {
  name: string;
  pct: number;
  color: string;
}

interface WeeklyComparison {
  thisCards: number;
  thisAcc: number;
  lastCards: number;
  lastAcc: number;
  cardsDelta: number;
}

export interface ProgressAnalytics {
  // Chart data
  accuracyChartData: ChartPoint[];
  cardsChartData: ChartPoint[];
  heatmap: number[][];
  topicBreakdownPct: TopicBreakdown[];
  weeklyComparison: WeeklyComparison | null;

  // Summary stats
  totalWeekCards: number;
  bestDay: ChartPoint | null;
  avgAccuracy: number | null;

  // Level data
  levelSummary: NonNullable<ReturnType<typeof useLevelProgressSummary>['data']>;

  // Loading state
  isWeeklyLoading: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useProgressAnalytics(enabled: boolean): ProgressAnalytics {
  // Weekly session history
  const { data: weeklyData, isLoading: isWeeklyLoading } = useQuery({
    queryKey: [...progressKeys.all, 'weekly-history'],
    queryFn: async () => {
      const { data } = await api.get('/progress/history', { params: { page: 1, pageSize: 35 } });
      return data.data as SessionRecord[];
    },
    enabled,
  });

  // Level summary
  const { data: levelSummary = [] } = useLevelProgressSummary();

  // Advanced insights for comprehensive history
  const { data: advancedData } = useAdvancedInsights(enabled);

  // ── Accuracy chart (last 7 sessions) ───────────────────────
  const accuracyChartData = useMemo(() => {
    const last7 = (weeklyData ?? []).slice(0, 7);
    return last7
      .map((d) => ({
        label: new Date(d.endedAt).toLocaleDateString('en', { weekday: 'narrow' }),
        value: Math.round((d.correctAnswers / Math.max(d.cardsStudied, 1)) * 100),
      }))
      .reverse();
  }, [weeklyData]);

  // ── Cards studied chart (last 7 sessions) ──────────────────
  const cardsChartData = useMemo(() => {
    const last7 = (weeklyData ?? []).slice(0, 7);
    return last7
      .map((d) => ({
        label: new Date(d.endedAt).toLocaleDateString('en', { weekday: 'narrow' }),
        value: d.cardsStudied,
      }))
      .reverse();
  }, [weeklyData]);

  // ── Heatmap grid (last N weeks from real history) ──────────
  const heatmap = useMemo<number[][]>(() => {
    if (!weeklyData || weeklyData.length === 0) {
      return Array.from({ length: HEATMAP_WEEKS }, () => Array(7).fill(0));
    }

    const dateMap = new Map<string, number>();
    for (const s of weeklyData) {
      const d = s.startedAt.slice(0, 10);
      dateMap.set(d, (dateMap.get(d) ?? 0) + s.cardsStudied);
    }

    const counts = [...dateMap.values()];
    const maxCount = Math.max(...counts, 1);
    const thresholds = [0, maxCount * 0.25, maxCount * 0.55, maxCount * 0.8];

    const intensity = (n: number) => {
      for (let i = thresholds.length - 1; i >= 0; i--) {
        if (n >= (thresholds[i] ?? 0)) return i;
      }
      return 0;
    };

    const grid: number[][] = Array.from({ length: HEATMAP_WEEKS }, () => Array(7).fill(0));
    const now = new Date();
    const today = now.getDay();

    for (let row = HEATMAP_WEEKS - 1; row >= 0; row--) {
      for (let col = 0; col < 7; col++) {
        const weeksAgo = HEATMAP_WEEKS - 1 - row;
        const daysOffset = today - col;
        const daysAgo = weeksAgo * 7 + daysOffset;
        const d = new Date(now);
        d.setDate(now.getDate() - daysAgo);
        const key = d.toISOString().slice(0, 10);
        const rowArr = grid[row];
        if (rowArr) rowArr[col] = intensity(dateMap.get(key) ?? 0);
      }
    }
    return grid;
  }, [weeklyData]);

  // ── Topic distribution from comprehensive history ────────────
  const topicBreakdownPct = useMemo(() => {
    if (!advancedData?.subjectStrengths) return [];

    const subjects = [...advancedData.subjectStrengths]
      .filter((s) => s.totalCorrect > 0)
      .sort((a, b) => b.totalCorrect - a.totalCorrect)
      .slice(0, 5);

    const breakdown = subjects.map(
      (s, i) => ({
        name: s.subjectName,
        pct: s.totalCorrect,
        color: TOPIC_COLORS[i % TOPIC_COLORS.length]!,
      }),
    );
    const total = breakdown.reduce((acc, t) => acc + t.pct, 0) || 1;
    return breakdown.map((t) => ({
      ...t,
      pct: Math.round((t.pct / total) * 100),
    }));
  }, [advancedData]);

  // ── Chart summary stats ────────────────────────────────────
  const { totalWeekCards, bestDay, avgAccuracy } = useMemo(
    () => ({
      totalWeekCards: cardsChartData.reduce((s, d) => s + d.value, 0),
      bestDay:
        cardsChartData.length > 0
          ? cardsChartData.reduce((best, d) => (d.value > best.value ? d : best), cardsChartData[0]!)
          : null,
      avgAccuracy:
        accuracyChartData.length > 0
          ? Math.round(accuracyChartData.reduce((s, d) => s + d.value, 0) / accuracyChartData.length)
          : null,
    }),
    [cardsChartData, accuracyChartData],
  );

  // ── Weekly comparison (this week vs last week) ─────────────
  const weeklyComparison = useMemo<WeeklyComparison | null>(() => {
    if (!weeklyData || weeklyData.length === 0) return null;

    const now = new Date();
    const startOfWeek = new Date(now);
    // ISO week starts on Monday: (getDay() + 6) % 7 gives Mon=0, ..., Sun=6
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    let thisCards = 0;
    let thisCorrect = 0;
    let lastCards = 0;
    let lastCorrect = 0;

    for (const s of weeklyData) {
      const d = new Date(s.startedAt);
      if (d >= startOfWeek) {
        thisCards += s.cardsStudied;
        thisCorrect += s.correctAnswers;
      } else if (d >= startOfLastWeek) {
        lastCards += s.cardsStudied;
        lastCorrect += s.correctAnswers;
      }
    }

    const thisAcc = thisCards > 0 ? Math.round((thisCorrect / thisCards) * 100) : 0;
    const lastAcc = lastCards > 0 ? Math.round((lastCorrect / lastCards) * 100) : 0;
    const cardsDelta = lastCards > 0 ? Math.round(((thisCards - lastCards) / lastCards) * 100) : 0;

    return { thisCards, thisAcc, lastCards, lastAcc, cardsDelta };
  }, [weeklyData]);

  return {
    accuracyChartData,
    cardsChartData,
    heatmap,
    topicBreakdownPct,
    weeklyComparison,
    totalWeekCards,
    bestDay,
    avgAccuracy,
    levelSummary,
    isWeeklyLoading,
  };
}
