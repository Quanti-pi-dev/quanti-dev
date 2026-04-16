// ─── Progress / Analytics Screen ─────────────────────────────
// Updated for advanced analytics:
// • All paid tiers now see charts, heatmap, topic distribution
// • Pro+ sees Chronotype + Speed vs Accuracy
// • Master sees Subject Mastery Radar + AI Study Recommendations
// • 4-stat grid (Cards · Accuracy · Streak · Coins)
// • Coin Activity card — today earned / lifetime / daily cap bar
// • Level Progress section — auto-detected from Redis
// • Badge field mapping fixed to use correct UserBadge shape

import { useMemo } from 'react';
import { View, ScrollView, useWindowDimensions, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { BadgeItem } from '../../src/components/BadgeItem';
import { StreakWidget } from '../../src/components/StreakWidget';
import { StudyInsightsCard } from '../../src/components/StudyInsightsCard';
import { LockedFeature } from '../../src/components/subscription/LockedFeature';
import { UpgradeCTABanner } from '../../src/components/subscription/UpgradeCTABanner';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useProgressSummary, useStudyStreak, useAdvancedInsights } from '../../src/hooks/useProgress';
import { useCoinBalance, useCoinsToday, useUserBadges, useLevelProgressSummary } from '../../src/hooks/useGamification';
import { ChronotypeCard } from '../../src/components/analytics/ChronotypeCard';
import { SpeedAccuracyChart } from '../../src/components/analytics/SpeedAccuracyChart';
import { SubjectRadarChart } from '../../src/components/analytics/SubjectRadarChart';
import { api } from '../../src/services/api';
import type { UserBadge } from '@kd/shared';

// ─── Constants ────────────────────────────────────────────────

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SUBJECT_LEVELS = ['Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Expert', 'Master'];
const LEVEL_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#14B8A6'];

// ─── Sub-components ──────────────────────────────────────────

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="h4">{title}</Typography>
      {action ?? (sub ? <Typography variant="label" color={theme.textTertiary}>{sub}</Typography> : null)}
    </View>
  );
}

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const { theme } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: spacing.xs }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
          <Typography variant="caption" color={theme.textTertiary} align="center" style={{ fontSize: 9 }}>{d.value}</Typography>
          <View style={{ width: '100%', height: Math.max(4, (d.value / max) * 65), backgroundColor: color, borderRadius: radius.sm, opacity: i === data.length - 1 ? 1 : 0.55 }} />
          <Typography variant="caption" color={theme.textTertiary} align="center" style={{ fontSize: 9 }}>{d.label}</Typography>
        </View>
      ))}
    </View>
  );
}

function LineChart({ data, chartWidth }: { data: { label: string; value: number }[]; chartWidth: number }) {
  const { theme } = useTheme();
  if (data.length < 2) return null;
  const H = 80; const W = chartWidth;
  const values = data.map((d) => d.value);
  const min = Math.min(...values); const max = Math.max(...values);
  const range = Math.max(max - min, 1); const stepX = W / (data.length - 1);
  const points = data.map((d, i) => ({
    x: i * stepX, y: H - ((d.value - min) / range) * (H - 16) - 8, label: d.label, value: d.value,
  }));
  return (
    <View style={{ height: H + 20 }}>
      {[0, 0.5, 1].map((f, gi) => (
        <View key={gi} style={{ position: 'absolute', left: 0, right: 0, top: f * H, height: 1, backgroundColor: theme.border, opacity: 0.5 }} />
      ))}
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1]!;
        const dx = next.x - p.x; const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return <View key={i} style={{ position: 'absolute', left: p.x, top: p.y, width: len, height: 2, backgroundColor: theme.primary, opacity: 0.75, transformOrigin: 'left center', transform: [{ rotate: `${angle}deg` }] }} />;
      })}
      {points.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.x - 4, top: p.y - 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: theme.primary, borderWidth: 2, borderColor: theme.card }} />
        </View>
      ))}
      {points.map((p, i) => (
        <Typography key={i} variant="caption" color={theme.textTertiary} align="center" style={{ position: 'absolute', left: p.x - 14, top: H + 4, width: 28, fontSize: 9 }}>{p.label}</Typography>
      ))}
    </View>
  );
}

function Heatmap({ heatmap }: { heatmap: number[][] }) {
  const { theme } = useTheme();
  const intensityColors = [theme.border, theme.primary + '40', theme.primary + '80', theme.primary];
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', gap: spacing.xs, paddingLeft: 24 }}>
        {DAY_LABELS.map((d, i) => <Typography key={i} variant="caption" color={theme.textTertiary} style={{ width: 18, fontSize: 9, textAlign: 'center' }}>{d}</Typography>)}
      </View>
      {heatmap.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Typography variant="caption" color={theme.textTertiary} style={{ width: 20, fontSize: 9 }}>W{wi + 1}</Typography>
          {week.map((intensity, di) => (
            <View key={di} style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: intensityColors[Math.min(intensity, 3)] ?? theme.border }} />
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs, justifyContent: 'flex-end' }}>
        <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>Less</Typography>
        {intensityColors.map((c, i) => <View key={i} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />)}
        <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>More</Typography>
      </View>
    </View>
  );
}

function StatTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color + '18', borderRadius: radius.xl, padding: spacing.md, alignItems: 'center', gap: spacing.xs }}>
      <Typography variant="h3" color={color} style={{ fontSize: 22 }}>{value}</Typography>
      <Typography variant="caption" color={color + 'AA'} align="center">{label}</Typography>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────

export default function ProgressScreen() {
  const { theme } = useTheme();
  const { canUseFeature } = useSubscriptionGate();
  const hasAdvancedAnalytics = canUseFeature('advanced_analytics');
  const hasDeepInsights = canUseFeature('deep_insights');
  const hasMasteryRadar = canUseFeature('mastery_radar');
  const router = useRouter();

  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CHART_W = SCREEN_WIDTH - spacing.xl * 2 - spacing.base * 2;

  // ── Data hooks ──────────────────────────────────────────────
  const { data: progressData } = useProgressSummary();
  const { data: streakData } = useStudyStreak();
  const { data: userBadges } = useUserBadges();
  const { data: coinData } = useCoinBalance();
  const { data: coinsTodayData } = useCoinsToday();
  const { data: levelSummary = [] } = useLevelProgressSummary();
  const { data: advancedData } = useAdvancedInsights(hasAdvancedAnalytics);

  const { data: weeklyData } = useQuery({
    queryKey: ['progress-weekly'],
    queryFn: async () => {
      const { data } = await api.get('/progress/history', { params: { page: 1, pageSize: 35 } });
      return data.data as Array<{ cardsStudied: number; correctAnswers: number; startedAt: string; endedAt: string }>;
    },
    enabled: hasAdvancedAnalytics,
  });

  // ── Derived values ─────────────────────────────────────────
  const streak = streakData?.currentStreak ?? 0;
  const totalCards = progressData?.totalCardsCompleted ?? 0;
  const accuracy = progressData?.overallAccuracy != null
    ? `${Math.round(progressData.overallAccuracy)}%` : '—';
  const coins = coinData?.balance ?? 0;
  const earnedToday = coinsTodayData?.earnedToday ?? 0;
  const dailyCap = coinsTodayData?.dailyCap ?? 500;
  const lifetimeEarned = coinData?.lifetimeEarned ?? 0;
  const longestStreak = streakData?.longestStreak ?? 0;
  const freezes = streakData?.streakFreezes ?? 0;
  const isPersonalBestStreak = streak > 0 && streak >= longestStreak;

  // Accuracy trend: last 7 unique session days (memoized)
  const accuracyChartData = useMemo(() => {
    const last7 = (weeklyData ?? []).slice(0, 7);
    return last7.map((d) => ({
      label: new Date(d.endedAt).toLocaleDateString('en', { weekday: 'narrow' }),
      value: Math.round((d.correctAnswers / Math.max(d.cardsStudied, 1)) * 100),
    })).reverse();
  }, [weeklyData]);

  const cardsChartData = useMemo(() => {
    const last7 = (weeklyData ?? []).slice(0, 7);
    return last7.map((d) => ({
      label: new Date(d.endedAt).toLocaleDateString('en', { weekday: 'narrow' }),
      value: d.cardsStudied,
    })).reverse();
  }, [weeklyData]);

  // Heatmap: last 5 weeks from real history
  const heatmap = useMemo<number[][]>(() => {
    if (!weeklyData || weeklyData.length === 0) return Array.from({ length: 5 }, () => Array(7).fill(0));
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
        if (n >= thresholds[i]!) return i;
      }
      return 0;
    };
    const grid: number[][] = Array.from({ length: 5 }, () => Array(7).fill(0));
    const now = new Date();
    const today = now.getDay(); // 0 = Sunday, 6 = Saturday
    for (let row = 4; row >= 0; row--) {
      for (let col = 0; col < 7; col++) {
        // Calculate days-ago: row 4 is the current week, col matches day-of-week
        const weeksAgo = 4 - row;
        const daysOffset = today - col;
        const daysAgo = weeksAgo * 7 + daysOffset;
        const d = new Date(now);
        d.setDate(now.getDate() - daysAgo);
        const key = d.toISOString().slice(0, 10);
        grid[row]![col] = intensity(dateMap.get(key) ?? 0);
      }
    }
    return grid;
  }, [weeklyData]);

  // Topic distribution from level summary
  const TOPIC_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6', '#14B8A6'];
  const { topicBreakdownPct } = useMemo(() => {
    const breakdown = levelSummary.slice(0, 5).map((s: { subjectName: string; correctAnswers: number }, i: number) => ({
      name: s.subjectName,
      pct: Math.max(1, s.correctAnswers),
      color: TOPIC_COLORS[i % TOPIC_COLORS.length]!,
    }));
    const total = breakdown.reduce((acc: number, t: { pct: number }) => acc + t.pct, 0) || 1;
    return {
      topicBreakdownPct: breakdown.map((t: { name: string; pct: number; color: string }) => ({ ...t, pct: Math.round((t.pct / total) * 100) })),
    };
  }, [levelSummary]);

  // Chart extras (memoized)
  const { totalWeekCards, bestDay, avgAccuracy } = useMemo(() => ({
    totalWeekCards: cardsChartData.reduce((s, d) => s + d.value, 0),
    bestDay: cardsChartData.length > 0
      ? cardsChartData.reduce((best, d) => d.value > best.value ? d : best, cardsChartData[0]!)
      : null,
    avgAccuracy: accuracyChartData.length > 0
      ? Math.round(accuracyChartData.reduce((s, d) => s + d.value, 0) / accuracyChartData.length)
      : null,
  }), [cardsChartData, accuracyChartData]);

  // Weekly comparison: this week vs last week
  const weeklyComparison = useMemo(() => {
    if (!weeklyData || weeklyData.length === 0) return null;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    let thisCards = 0, thisCorrect = 0, thisTotal = 0;
    let lastCards = 0, lastCorrect = 0, lastTotal = 0;

    for (const s of weeklyData) {
      const d = new Date(s.startedAt);
      if (d >= startOfWeek) {
        thisCards += s.cardsStudied; thisCorrect += s.correctAnswers; thisTotal += s.cardsStudied;
      } else if (d >= startOfLastWeek) {
        lastCards += s.cardsStudied; lastCorrect += s.correctAnswers; lastTotal += s.cardsStudied;
      }
    }

    const thisAcc = thisTotal > 0 ? Math.round((thisCorrect / thisTotal) * 100) : 0;
    const lastAcc = lastTotal > 0 ? Math.round((lastCorrect / lastTotal) * 100) : 0;
    const cardsDelta = lastCards > 0 ? Math.round(((thisCards - lastCards) / lastCards) * 100) : 0;

    return { thisCards, thisAcc, lastCards, lastAcc, cardsDelta };
  }, [weeklyData]);

  // Badges
  const badgeList = ((userBadges ?? []) as UserBadge[]).map((b) => ({
    id: b.badgeId,
    name: b.badge?.name ?? 'Badge',
    icon: (b.badge?.iconUrl ?? 'ribbon-outline') as React.ComponentProps<typeof import('@expo/vector-icons').Ionicons>['name'],
    earned: b.earnedAt != null,
    accent: '#F59E0B',
  }));

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
      >
        <Typography variant="h3">Analytics</Typography>

        {/* ── Streak ── */}
        <StreakWidget streak={streak} freezes={freezes} />

        {/* ── Study Insights ── */}
        <StudyInsightsCard data={{
          streak,
          freezes,
          accuracy: progressData?.overallAccuracy ?? null,
          studiedToday: streakData?.lastStudyDate === new Date().toISOString().split('T')[0],
          weakestSubject: levelSummary.length > 0
            ? levelSummary.reduce((w, s) => s.correctAnswers < w.correctAnswers ? s : w, levelSummary[0]!)?.subjectName
            : undefined,
        }} />

        {/* ── 4-stat grid ── */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile value={String(totalCards)} label="Cards Solved" color="#6366F1" />
          <StatTile value={accuracy} label="Accuracy" color="#10B981" />
          <StatTile value={`${streak}d`} label="Streak" color="#EF4444" />
          <StatTile value={String(coins)} label="Coins" color={theme.coin ?? '#F59E0B'} />
        </View>

        {/* ── Personal Best chips ── */}
        {isPersonalBestStreak && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: '#EF444418', borderRadius: 12,
            paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
            alignSelf: 'flex-start',
          }}>
            <Typography variant="bodySmall" color="#EF4444">🏆 Personal Best Streak! {streak} days — your longest ever</Typography>
          </View>
        )}

        {/* ── Weekly Comparison (free for all) ── */}
        {weeklyComparison && (weeklyComparison.thisCards > 0 || weeklyComparison.lastCards > 0) && (
          <Card>
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="📊 Weekly Comparison" />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {/* This week */}
                <View style={{
                  flex: 1, backgroundColor: theme.primary + '12',
                  borderRadius: 12, padding: spacing.md, gap: spacing.xs,
                }}>
                  <Typography variant="caption" color={theme.textTertiary}>This Week</Typography>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                    <Typography variant="h3" color={theme.text}>{weeklyComparison.thisCards}</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>cards</Typography>
                    {weeklyComparison.cardsDelta !== 0 && (
                      <Typography
                        variant="caption"
                        color={weeklyComparison.cardsDelta > 0 ? '#10B981' : '#EF4444'}
                        style={{ fontWeight: '700' }}
                      >
                        {weeklyComparison.cardsDelta > 0 ? '↑' : '↓'} {Math.abs(weeklyComparison.cardsDelta)}%
                      </Typography>
                    )}
                  </View>
                  <Typography variant="caption" color={theme.textSecondary}>
                    {weeklyComparison.thisAcc}% accuracy
                  </Typography>
                </View>
                {/* Last week */}
                <View style={{
                  flex: 1, backgroundColor: theme.cardAlt,
                  borderRadius: 12, padding: spacing.md, gap: spacing.xs,
                }}>
                  <Typography variant="caption" color={theme.textTertiary}>Last Week</Typography>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                    <Typography variant="h3" color={theme.textSecondary}>{weeklyComparison.lastCards}</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>cards</Typography>
                  </View>
                  <Typography variant="caption" color={theme.textSecondary}>
                    {weeklyComparison.lastAcc}% accuracy
                  </Typography>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* ── Coin Activity card (free for all) ── */}
        <Card>
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              title="🪙 Coin Activity"
              action={
                <TouchableOpacity onPress={() => router.push('/coins-history' as never)}>
                  <Typography variant="label" color={theme.primary}>View History →</Typography>
                </TouchableOpacity>
              }
            />
            {/* Today's earning progress */}
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="caption" color={theme.textSecondary}>Earned today</Typography>
                <Typography variant="label" color={theme.coin ?? theme.primary}>{earnedToday} / {dailyCap}</Typography>
              </View>
              <ProgressBar
                progress={dailyCap > 0 ? earnedToday / dailyCap : 0}
                height={8}
                color={theme.coin ?? theme.primary}
              />
            </View>
            {/* Lifetime stat */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color={theme.textTertiary}>Lifetime earned</Typography>
              <Typography variant="label" color={theme.textSecondary}>{lifetimeEarned} coins</Typography>
            </View>
          </View>
        </Card>

        {/* ── Level Progress (free for all) ── */}
        {levelSummary.length > 0 && (
          <Card>
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="Level Progress" sub={`${levelSummary.length} subjects`} />
              {levelSummary.map((s, _i) => {
                const levelFraction = (s.levelIndex + 1) / SUBJECT_LEVELS.length;
                const color = LEVEL_COLORS[s.levelIndex] ?? theme.primary;
                return (
                  <View key={`${s.examId}-${s.subjectId}`} style={{ gap: spacing.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Typography variant="label" numberOfLines={1}>{s.subjectName}</Typography>
                        <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>{s.examName}</Typography>
                      </View>
                      <View style={{
                        paddingHorizontal: spacing.sm, paddingVertical: 2,
                        borderRadius: radius.full, backgroundColor: color + '22',
                        marginLeft: spacing.sm,
                      }}>
                        <Typography variant="caption" color={color}>{s.highestLevel}</Typography>
                      </View>
                    </View>
                    <ProgressBar progress={levelFraction} height={6} color={color} />
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* ── Upgrade CTA for non-subscribers ── */}
        {!hasAdvancedAnalytics && (
          <UpgradeCTABanner
            icon="analytics-outline"
            title="Unlock Detailed Analytics"
            subtitle="Charts, heatmaps & deep insights — subscribe to access"
          />
        )}

        {/* ══════════════════════════════════════════════════════════
            ADVANCED ANALYTICS — Available to all paid tiers
            ══════════════════════════════════════════════════════════ */}

        {hasAdvancedAnalytics && (
          <>
            {/* ── Accuracy Trend ── */}
            <Card>
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Accuracy Trend" sub="Last 7 sessions" />
                {accuracyChartData.length >= 2 ? (
                  <LineChart data={accuracyChartData} chartWidth={CHART_W} />
                ) : (
                  <Typography variant="body" color={theme.textTertiary} align="center">
                    Study more sessions to see your trend
                  </Typography>
                )}
                {avgAccuracy != null && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color={theme.textTertiary}>Avg: {avgAccuracy}%</Typography>
                    {accuracyChartData.length > 0 && accuracyChartData[accuracyChartData.length - 1]!.value > avgAccuracy && (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        backgroundColor: '#10B98118', borderRadius: 8,
                        paddingHorizontal: spacing.sm, paddingVertical: 2,
                      }}>
                        <Typography variant="caption" color="#10B981">📈 Above Average!</Typography>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Card>

            {/* ── Cards Studied ── */}
            <Card>
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Cards Studied" sub="Per session" />
                {cardsChartData.length > 0 ? (
                  <BarChart data={cardsChartData} color="#6366F1" />
                ) : (
                  <Typography variant="body" color={theme.textTertiary} align="center">No sessions yet</Typography>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color={theme.textTertiary}>Total: {totalWeekCards} cards</Typography>
                  {bestDay && (
                    <Typography variant="label" color={theme.primary}>Best: {bestDay.value} on {bestDay.label}</Typography>
                  )}
                </View>
              </View>
            </Card>

            {/* ── Topic Distribution ── */}
            <Card>
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Topic Distribution" sub="By correct answers" />
                {topicBreakdownPct.length > 0 ? (
                  <View style={{ gap: spacing.sm }}>
                    {topicBreakdownPct.map((t, i) => (
                      <View key={i} style={{ gap: spacing.xs }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color={theme.textSecondary}>{t.name}</Typography>
                          <Typography variant="caption" color={t.color}>{t.pct}%</Typography>
                        </View>
                        <ProgressBar progress={t.pct / 100} height={6} color={t.color} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Typography variant="body" color={theme.textTertiary} align="center">
                    Study some subjects to see distribution
                  </Typography>
                )}
              </View>
            </Card>

            {/* ── Study Activity Heatmap ── */}
            <Card>
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Study Activity" sub="Last 5 weeks" />
                <Heatmap heatmap={heatmap} />
              </View>
            </Card>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            DEEP INSIGHTS — Pro + Master only
            ══════════════════════════════════════════════════════════ */}

        {hasAdvancedAnalytics && !hasDeepInsights && (
          <UpgradeCTABanner
            icon="bulb-outline"
            title="Unlock Deep Insights"
            subtitle="Study chronotype & speed-accuracy matrix — Pro plan and above"
          />
        )}

        <LockedFeature featureKey="deep_insights" label="Study Chronotype — Pro feature">
          {advancedData?.chronotype && (
            <ChronotypeCard data={advancedData.chronotype} />
          )}
        </LockedFeature>

        <LockedFeature featureKey="deep_insights" label="Speed vs. Accuracy — Pro feature">
          {advancedData?.speedAccuracy && (
            <SpeedAccuracyChart data={advancedData.speedAccuracy} />
          )}
        </LockedFeature>

        {/* ══════════════════════════════════════════════════════════
            MASTERY RADAR — Master only
            ══════════════════════════════════════════════════════════ */}

        {hasDeepInsights && !hasMasteryRadar && (
          <UpgradeCTABanner
            icon="diamond-outline"
            title="Unlock Mastery Radar & AI Tips"
            subtitle="Subject radar chart & personalized study tips — Master plan"
          />
        )}

        <LockedFeature featureKey="mastery_radar" label="Subject Mastery Radar — Master feature">
          {advancedData?.subjectStrengths && (
            <SubjectRadarChart data={advancedData.subjectStrengths} />
          )}
        </LockedFeature>

        {/* ── Level Mastery bars (free for all) ── */}
        {levelSummary.length > 0 && (
          <Card>
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="Level Mastery" sub="Cards correct per subject" />
              {levelSummary.map((s, i) => (
                <ProgressBar
                  key={`${s.examId}-${s.subjectId}-mastery`}
                  progress={Math.min(s.correctAnswers / 120, 1)} // 120 = 6 levels × 20 cards
                  label={s.subjectName}
                  showLabel
                  height={8}
                  color={LEVEL_COLORS[i % LEVEL_COLORS.length]}
                />
              ))}
            </View>
          </Card>
        )}

        {/* ── Badges (free for all) ── */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title="Badges"
            sub={badgeList.length > 0 ? `${badgeList.filter((b) => b.earned).length}/${badgeList.length} earned` : undefined}
          />
          {badgeList.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
              {badgeList.map((b) => <BadgeItem key={b.id} name={b.name} icon={b.icon} earned={b.earned} accent={b.accent} />)}
            </View>
          ) : (
            <View style={{
              alignItems: 'center', gap: spacing.md, padding: spacing.xl,
              backgroundColor: theme.cardAlt, borderRadius: 16,
            }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="ribbon-outline" size={24} color="#F59E0B" />
              </View>
              <Typography variant="label" align="center">No Badges Yet</Typography>
              <Typography variant="caption" color={theme.textTertiary} align="center">
                Complete study milestones to earn your first badge
              </Typography>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/study')}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 10, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
                }}
              >
                <Typography variant="label" color="#FFFFFF">Start Studying</Typography>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
