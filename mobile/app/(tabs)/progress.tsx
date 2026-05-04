// ─── Progress / Analytics Screen ─────────────────────────────
// Redesigned analytics with Learning Intelligence at the top:
// • All users: Study Plan, Knowledge Health, Exam Readiness, Velocity
// • Free: Streak, insights, stat grid, coin activity, level progress, badges
// • Paid: Charts, heatmap, topic distribution
// • Pro+: Chronotype + Speed vs Accuracy
// • Master: Subject Mastery Radar + AI Study Recommendations

import { useState, useCallback } from 'react';
import { View, ScrollView, useWindowDimensions, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { StatTile } from '../../src/components/StatTile';
import { StudyInsightsCard } from '../../src/components/StudyInsightsCard';

import { UpgradeCTABanner } from '../../src/components/subscription/UpgradeCTABanner';
import { SectionHeader, BarChart, LineChart, Heatmap } from '../../src/components/progress';
import { ChronotypeCard } from '../../src/components/analytics/ChronotypeCard';
import { SpeedAccuracyChart } from '../../src/components/analytics/SpeedAccuracyChart';
import { SubjectRadarChart } from '../../src/components/analytics/SubjectRadarChart';
import { TopicSunburstChart } from '../../src/components/analytics/TopicSunburstChart';
import { AIInsightsCard } from '../../src/components/analytics/AIInsightsCard';
import { TodaysStudyPlan } from '../../src/components/analytics/TodaysStudyPlan';
import { WeeklyReportCard } from '../../src/components/analytics/WeeklyReportCard';
import { KnowledgeHealthMap } from '../../src/components/analytics/KnowledgeHealthMap';
import { ExamReadinessScore } from '../../src/components/analytics/ExamReadinessScore';
import { LearningVelocityCard } from '../../src/components/analytics/LearningVelocityCard';

import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useProgressSummary, useStudyStreak, useAdvancedInsights } from '../../src/hooks/useProgress';
import { useAuth } from '../../src/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/services/api';
import { progressKeys } from '../../src/hooks/useProgress';
import { useProgressAnalytics, LEVEL_COLORS, CARDS_PER_SUBJECT } from '../../src/hooks/useProgressAnalytics';
import { useLearningProfile } from '../../src/hooks/useLearningProfile';

// ─── Screen ──────────────────────────────────────────────────

export default function ProgressScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { canUseFeature, planTier } = useSubscriptionGate();
  const hasAdvancedAnalytics = canUseFeature('advanced_analytics');
  const hasDeepInsights = canUseFeature('deep_insights');
  const hasMasteryRadar = canUseFeature('mastery_radar');

  // PERF: Lazy-render heavy below-fold sections (charts, heatmap, radar)
  const [belowFoldReady, setBelowFoldReady] = useState(false);
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!belowFoldReady && e.nativeEvent.contentOffset.y > 500) {
      setBelowFoldReady(true);
    }
  }, [belowFoldReady]);

  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CHART_W = SCREEN_WIDTH - spacing.xl * 2 - spacing.base * 2;

  // ── Data hooks ──────────────────────────────────────────────
  const { preferences } = useAuth();
  const { data: progressData } = useProgressSummary();
  const { data: streakData } = useStudyStreak();
  const { data: advancedData } = useAdvancedInsights(hasAdvancedAnalytics);
  const { data: learningProfile } = useLearningProfile();

  // Weekly session history for the report card (always fetched — free tier)
  // PERF: Uses same query key as useProgressAnalytics ('weekly-history') so
  // React Query deduplicates if both are mounted simultaneously.
  const { data: weeklySessions = [] } = useQuery({
    queryKey: [...progressKeys.all, 'weekly-history'],
    queryFn: async () => {
      const { data } = await api.get('/progress/history', { params: { page: 1, pageSize: 35 } });
      return (data.data ?? []) as { cardsStudied: number; correctAnswers: number; startedAt: string }[];
    },
    staleTime: 60_000,
  });

  const {
    accuracyChartData,
    cardsChartData,
    heatmap,
    weeklyComparison,
    totalWeekCards,
    bestDay,
    avgAccuracy,
    levelSummary,
  } = useProgressAnalytics(hasAdvancedAnalytics);

  // ── Derived values ─────────────────────────────────────────
  const streak = streakData?.currentStreak ?? 0;
  const totalCards = progressData?.totalCardsCompleted ?? 0;
  const accuracy =
    progressData?.overallAccuracy != null ? `${Math.round(progressData.overallAccuracy)}%` : '—';
  const longestStreak = streakData?.longestStreak ?? 0;
  const freezes = streakData?.streakFreezes ?? 0;
  const isPersonalBestStreak = streak > 1 && streak >= longestStreak;



  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        <Typography variant="h3">Your Learning Profile</Typography>

        {/* ══════════════════════════════════════════════════════════
            LEARNING INTELLIGENCE — Available to ALL users (free)
            Study Plan, Knowledge Health, Exam Readiness, Velocity
            ══════════════════════════════════════════════════════════ */}

        {/* ── Today's Study Plan (Hero) ── */}
        {learningProfile?.studyPlan && (
          <TodaysStudyPlan
            plan={learningProfile.studyPlan}
            chronotypePeakHour={advancedData?.chronotype?.peakHour}
          />
        )}

        {/* ── Knowledge Health Map ── */}
        {learningProfile && (
          <KnowledgeHealthMap
            data={learningProfile.knowledgeHealth}
            totalOverdue={learningProfile.totalOverdueCards}
            totalDueSoon={learningProfile.knowledgeHealth.reduce((s, sub) => s + sub.totalDueSoon, 0)}
          />
        )}

        {/* ── Exam Readiness Score ── */}
        {learningProfile?.examReadiness && (
          <ExamReadinessScore data={learningProfile.examReadiness} />
        )}

        {/* ── Learning Velocity ── */}
        {learningProfile?.velocity && (
          <LearningVelocityCard data={learningProfile.velocity} />
        )}

        {/* ━━━ Weekly Report Card (free for all) ━━━ */}
        <WeeklyReportCard
          sessions={weeklySessions}
          streak={streak}
          preferences={preferences}
          onViewDetails={() => router.push('/(tabs)/progress')}
        />

        {/* ═══════════ Section Divider: Study Patterns ═══════════ */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          <Typography variant="caption" color={theme.textTertiary} style={{ letterSpacing: 1, textTransform: 'uppercase', fontSize: 10 }}>
            Study Patterns
          </Typography>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
        </View>

        {/* ── Study Insights ── */}
        <StudyInsightsCard
          data={{
            streak,
            freezes,
            accuracy: progressData?.overallAccuracy ?? null,
            studiedToday: streakData?.lastStudyDate === new Date().toISOString().split('T')[0],
            weakestSubject:
                  levelSummary.length > 0
                ? levelSummary.reduce(
                    (w: any, s: any) =>
                      s.correctAnswers < w.correctAnswers ? s : w,
                    levelSummary[0]!,
                  )?.subjectName
                : undefined,
          }}
        />

        {/* ── Error Journal Quick Link ── */}
        <TouchableOpacity
          onPress={() => router.push('/error-journal')}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.xl,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              backgroundColor: '#EF444412',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="journal-outline" size={20} color="#EF4444" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="label">Error Journal</Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              Review mistakes and learn from them
            </Typography>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>

        {/* ── Review Queue Quick Link ── */}
        <TouchableOpacity
          onPress={() => router.push('/review-queue')}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.xl,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              backgroundColor: '#6366F112',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="refresh-circle-outline" size={20} color="#6366F1" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Typography variant="label">Review Queue</Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              Spaced repetition cards due for review
            </Typography>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>

        {/* ── 4-stat grid ── */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile value={String(totalCards)} label="Cards Solved" color="#6366F1" />
          <StatTile value={accuracy} label="Accuracy" color="#10B981" />
          <StatTile value={`${streak}d`} label="Streak" color="#EF4444" />
        </View>

        {/* ── Personal Best chips ── */}
        {isPersonalBestStreak && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: '#EF444418',
              borderRadius: 12,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              alignSelf: 'flex-start',
            }}
          >
            <Typography variant="bodySmall" color="#EF4444">
              🏆 Personal Best Streak! {streak} days — your longest ever
            </Typography>
          </View>
        )}

        {/* ── Level Progress — current level per subject (free for all) ── */}
        {levelSummary.length > 0 && (
          <Card>
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="Level Progress" sub={`${levelSummary.length} subjects`} />
              {levelSummary.map((s: any) => {
                const levelFraction = (s.levelIndex + 1) / 6;
                const color = LEVEL_COLORS[s.levelIndex] ?? theme.primary;
                return (
                  <View key={`${s.examId}-${s.subjectId}`} style={{ gap: spacing.xs }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Typography variant="label" numberOfLines={1}>
                          {s.subjectName}
                        </Typography>
                        <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>
                          {s.examName}
                        </Typography>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 2,
                          borderRadius: radius.full,
                          backgroundColor: color + '22',
                          marginLeft: spacing.sm,
                        }}
                      >
                        <Typography variant="caption" color={color}>
                          {s.highestLevel}
                        </Typography>
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
            title="Unlock Deep Analytics"
            subtitle="Charts, heatmaps & detailed pattern insights — subscribe to access"
          />
        )}

        {/* ═══════════ Section Divider: Deep Analytics ═══════════ */}
        {hasAdvancedAnalytics && belowFoldReady && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <Typography variant="caption" color={theme.textTertiary} style={{ letterSpacing: 1, textTransform: 'uppercase', fontSize: 10 }}>
              Deep Analytics
            </Typography>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            ADVANCED ANALYTICS — Available to all paid tiers
            ══════════════════════════════════════════════════════════ */}

        {hasAdvancedAnalytics && belowFoldReady && (
          <>
            {/* ── Accuracy Trend ── */}
            <Card>
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Accuracy Trend" sub="Last 7 sessions" />
                <LineChart
                  data={
                    accuracyChartData.length >= 2
                      ? accuracyChartData
                      : [
                          { label: 'S1', value: 0 },
                          { label: 'S2', value: 0 },
                          { label: 'S3', value: 0 },
                          { label: 'S4', value: 0 },
                          { label: 'S5', value: 0 },
                        ]
                  }
                  chartWidth={CHART_W}
                  empty={accuracyChartData.length < 2}
                />
                {avgAccuracy != null && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="caption" color={theme.textTertiary}>
                      Avg: {avgAccuracy}%
                    </Typography>
                    {accuracyChartData.length > 0 &&
                      accuracyChartData[accuracyChartData.length - 1]!.value > avgAccuracy && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#10B98118',
                            borderRadius: 8,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                          }}
                        >
                          <Typography variant="caption" color="#10B981">
                            📈 Above Average!
                          </Typography>
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
                <BarChart
                  data={
                    cardsChartData.length > 0
                      ? cardsChartData
                      : [
                          { label: 'S1', value: 0 },
                          { label: 'S2', value: 0 },
                          { label: 'S3', value: 0 },
                          { label: 'S4', value: 0 },
                          { label: 'S5', value: 0 },
                        ]
                  }
                  color="#6366F1"
                  empty={cardsChartData.length === 0}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color={theme.textTertiary}>
                    Total: {totalWeekCards} cards
                  </Typography>
                  {bestDay && (
                    <Typography variant="label" color={theme.primary}>
                      Best: {bestDay.value} on {bestDay.label}
                    </Typography>
                  )}
                </View>
              </View>
            </Card>

            {/* ── Topic Distribution (Sunburst) ── */}
            <TopicSunburstChart data={advancedData?.topicDistribution ?? []} />

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
            PREMIUM FEATURES GATE — data-driven, subscription-aware
            Builds a list of only the features the user does NOT yet
            have, renders unlocked features normally, and disappears
            entirely once everything is unlocked.
            ══════════════════════════════════════════════════════════ */}

        {(() => {
          // ── 1. Define every premium feature with its unlock condition ──
          const ALL_FEATURES = [
            {
              key: 'chronotype',
              icon: 'time-outline' as const,
              label: 'Study Chronotype',
              desc: 'Discover your peak learning hours',
              tier: 'Pro' as const,
              unlocked: hasDeepInsights,
              component: <ChronotypeCard key="chronotype" data={advancedData?.chronotype ?? {
                chronotype: 'day_scholar',
                peakHour: 10,
                peakAccuracy: 0,
                hourlyAccuracy: []
              }} />
            },
            {
              key: 'speed_accuracy',
              icon: 'speedometer-outline' as const,
              label: 'Speed vs. Accuracy',
              desc: 'Visualise your recall performance',
              tier: 'Pro' as const,
              unlocked: hasDeepInsights,
              component: <SpeedAccuracyChart key="speed_accuracy" data={advancedData?.speedAccuracy ?? []} />
            },
            {
              key: 'mastery_radar',
              icon: 'radio-outline' as const,
              label: 'Subject Mastery Radar',
              desc: 'Radar chart across all subjects',
              tier: 'Master' as const,
              unlocked: hasMasteryRadar,
              component: <SubjectRadarChart key="mastery_radar" data={advancedData?.subjectStrengths ?? []} />
            },
            {
              key: 'ai_insights',
              icon: 'sparkles-outline' as const,
              label: 'Gemini AI Insights',
              desc: 'Personalised AI study plan & narrative',
              tier: 'Master' as const,
              unlocked: hasMasteryRadar,
              component: <AIInsightsCard key="ai_insights" enabled={hasMasteryRadar} />
            },
          ];

          const unlockedFeatures = ALL_FEATURES.filter((f) => f.unlocked);
          const lockedFeatures   = ALL_FEATURES.filter((f) => !f.unlocked);

          // Next tier the user needs to upgrade to
          const needsMaster = lockedFeatures.some((f) => f.tier === 'Master') &&
                              lockedFeatures.every((f) => f.tier === 'Master');
          const upgradeTier = needsMaster ? 'Master' : 'Pro';
          const upgradeColor = needsMaster ? '#F59E0B' : theme.primary;
          const upgradeColorMuted = needsMaster ? '#F59E0B18' : theme.primaryMuted;
          const upgradeBorderColor = needsMaster ? '#F59E0B40' : theme.primary + '40';

          return (
            <>
              {/* Render all already-unlocked feature components */}
              {unlockedFeatures.map((f) => f.component)}

              {/* Single gate card — only shown when there's something left to unlock */}
              {lockedFeatures.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push('/subscription')}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={
                    lockedFeatures.length === 1
                      ? `Unlock ${lockedFeatures[0]!.label}. Upgrade to ${upgradeTier}.`
                      : `Unlock ${lockedFeatures.length} more features. View upgrade options.`
                  }
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: radius['2xl'],
                    borderWidth: 1.5,
                    borderColor: upgradeBorderColor,
                    overflow: 'hidden',
                  }}
                >
                  {/* Header strip */}
                  <View
                    style={{
                      backgroundColor: upgradeColor + '18',
                      paddingHorizontal: spacing.xl,
                      paddingVertical: spacing.lg,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: upgradeColor + '25',
                    }}
                  >
                    <View
                      style={{
                        width: 40, height: 40, borderRadius: radius.full,
                        backgroundColor: upgradeColor + '25',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={needsMaster ? 'diamond-outline' : 'rocket-outline'}
                        size={20}
                        color={upgradeColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Typography variant="label" color={upgradeColor}>
                        {lockedFeatures.length === 1
                          ? `Unlock ${lockedFeatures[0]!.label}`
                          : `Unlock ${lockedFeatures.length} More Features`}
                      </Typography>
                      <Typography variant="caption" color={theme.textSecondary}>
                        {planTier < 2 ? 'Pro plan — upgrade to access' : 'Master plan — upgrade to access'}
                      </Typography>
                    </View>
                  </View>

                  {/* Locked feature rows */}
                  <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md }}>
                    {lockedFeatures.map((f) => (
                      <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                        <View
                          style={{
                            width: 36, height: 36, borderRadius: radius.lg,
                            backgroundColor: theme.cardAlt,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons name={f.icon} size={17} color={theme.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Typography variant="label">{f.label}</Typography>
                          <Typography variant="caption" color={theme.textTertiary}>{f.desc}</Typography>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: spacing.sm, paddingVertical: 2,
                            borderRadius: radius.full,
                            backgroundColor: f.tier === 'Master' ? '#F59E0B18' : upgradeColorMuted,
                          }}
                        >
                          <Typography variant="caption" color={f.tier === 'Master' ? '#F59E0B' : upgradeColor}>
                            {f.tier}
                          </Typography>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* CTA */}
                  <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
                    <View
                      style={{
                        backgroundColor: upgradeColor,
                        borderRadius: radius.full,
                        paddingVertical: spacing.md,
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="label" color="#FFFFFF">
                        {planTier < 2 ? 'Upgrade to Pro →' : 'Upgrade to Master →'}
                      </Typography>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </>
          );
        })()}

      </ScrollView>
    </ScreenWrapper>
  );
}
