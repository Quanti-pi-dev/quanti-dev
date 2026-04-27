// ─── Progress / Analytics Screen ─────────────────────────────
// Tiered analytics experience:
// • Free: Streak, insights, stat grid, coin activity, level progress, badges
// • Paid: Charts, heatmap, topic distribution, weekly comparison
// • Pro+: Chronotype + Speed vs Accuracy
// • Master: Subject Mastery Radar + AI Study Recommendations

import { View, ScrollView, useWindowDimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { BadgeItem } from '../../src/components/BadgeItem';
import { StatTile } from '../../src/components/StatTile';
import { StreakWidget } from '../../src/components/StreakWidget';
import { StudyInsightsCard } from '../../src/components/StudyInsightsCard';

import { UpgradeCTABanner } from '../../src/components/subscription/UpgradeCTABanner';
import { SectionHeader, BarChart, LineChart, Heatmap } from '../../src/components/progress';
import { ChronotypeCard } from '../../src/components/analytics/ChronotypeCard';
import { SpeedAccuracyChart } from '../../src/components/analytics/SpeedAccuracyChart';
import { SubjectRadarChart } from '../../src/components/analytics/SubjectRadarChart';

import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useProgressSummary, useStudyStreak, useAdvancedInsights } from '../../src/hooks/useProgress';
import { useCoinBalance, useCoinsToday, useUserBadges } from '../../src/hooks/useGamification';
import { useProgressAnalytics, LEVEL_COLORS, CARDS_PER_SUBJECT } from '../../src/hooks/useProgressAnalytics';
import type { UserBadge } from '@kd/shared';

// ─── Screen ──────────────────────────────────────────────────

export default function ProgressScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { canUseFeature } = useSubscriptionGate();
  const hasAdvancedAnalytics = canUseFeature('advanced_analytics');
  const hasDeepInsights = canUseFeature('deep_insights');
  const hasMasteryRadar = canUseFeature('mastery_radar');

  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CHART_W = SCREEN_WIDTH - spacing.xl * 2 - spacing.base * 2;

  // ── Data hooks ──────────────────────────────────────────────
  const { data: progressData } = useProgressSummary();
  const { data: streakData } = useStudyStreak();
  const { data: userBadges } = useUserBadges();
  const { data: coinData } = useCoinBalance();
  const { data: coinsTodayData } = useCoinsToday();
  const { data: advancedData } = useAdvancedInsights(hasAdvancedAnalytics);

  const {
    accuracyChartData,
    cardsChartData,
    heatmap,
    topicBreakdownPct,
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
  const coins = coinData?.balance ?? 0;
  const earnedToday = coinsTodayData?.earnedToday ?? 0;
  const dailyCap = coinsTodayData?.dailyCap ?? 500;
  const lifetimeEarned = coinData?.lifetimeEarned ?? 0;
  const longestStreak = streakData?.longestStreak ?? 0;
  const freezes = streakData?.streakFreezes ?? 0;
  const isPersonalBestStreak = streak > 1 && streak >= longestStreak;

  // ── Badges ─────────────────────────────────────────────────
  const badgeList = ((userBadges ?? []) as UserBadge[]).map((b) => ({
    id: b.badgeId,
    name: b.badge?.name ?? 'Badge',
    icon: (b.badge?.iconUrl ?? 'ribbon-outline') as React.ComponentProps<
      typeof import('@expo/vector-icons').Ionicons
    >['name'],
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

        {/* ── 4-stat grid ── */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile value={String(totalCards)} label="Cards Solved" color="#6366F1" />
          <StatTile value={accuracy} label="Accuracy" color="#10B981" />
          <StatTile value={`${streak}d`} label="Streak" color="#EF4444" />
          <StatTile value={String(coins)} label="Coins" color={theme.coin ?? '#F59E0B'} />
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

        {/* ── Weekly Comparison (free for all) ── */}
        {weeklyComparison && (weeklyComparison.thisCards > 0 || weeklyComparison.lastCards > 0) && (
          <Card>
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="📊 Weekly Comparison" />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {/* This week */}
                <View
                  style={{
                    flex: 1,
                    backgroundColor: theme.primary + '12',
                    borderRadius: 12,
                    padding: spacing.md,
                    gap: spacing.xs,
                  }}
                >
                  <Typography variant="caption" color={theme.textTertiary}>
                    This Week
                  </Typography>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                    <Typography variant="h3" color={theme.text}>
                      {weeklyComparison.thisCards}
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary}>
                      cards
                    </Typography>
                    {weeklyComparison.cardsDelta !== 0 && (
                      <Typography
                        variant="caption"
                        color={weeklyComparison.cardsDelta > 0 ? '#10B981' : '#EF4444'}
                        style={{ fontWeight: '700' }}
                      >
                        {weeklyComparison.cardsDelta > 0 ? '↑' : '↓'}{' '}
                        {Math.abs(weeklyComparison.cardsDelta)}%
                      </Typography>
                    )}
                  </View>
                  <Typography variant="caption" color={theme.textSecondary}>
                    {weeklyComparison.thisAcc}% accuracy
                  </Typography>
                </View>
                {/* Last week */}
                <View
                  style={{
                    flex: 1,
                    backgroundColor: theme.cardAlt,
                    borderRadius: 12,
                    padding: spacing.md,
                    gap: spacing.xs,
                  }}
                >
                  <Typography variant="caption" color={theme.textTertiary}>
                    Last Week
                  </Typography>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                    <Typography variant="h3" color={theme.textSecondary}>
                      {weeklyComparison.lastCards}
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary}>
                      cards
                    </Typography>
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
                <TouchableOpacity
                  onPress={() => router.push('/coins-history')}
                  accessibilityLabel="View coin history"
                  accessibilityRole="button"
                >
                  <Typography variant="label" color={theme.primary}>
                    View History →
                  </Typography>
                </TouchableOpacity>
              }
            />
            {/* Today's earning progress */}
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="caption" color={theme.textSecondary}>
                  Earned today
                </Typography>
                <Typography variant="label" color={theme.coin ?? theme.primary}>
                  {earnedToday} / {dailyCap}
                </Typography>
              </View>
              <ProgressBar
                progress={dailyCap > 0 ? earnedToday / dailyCap : 0}
                height={8}
                color={theme.coin ?? theme.primary}
              />
            </View>
            {/* Lifetime stat */}
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Typography variant="caption" color={theme.textTertiary}>
                Lifetime earned
              </Typography>
              <Typography variant="label" color={theme.textSecondary}>
                {lifetimeEarned} coins
              </Typography>
            </View>
          </View>
        </Card>

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

            {/* ── Topic Distribution ── */}
            <Card>
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Topic Distribution" sub="By correct answers" />
                <View style={{ gap: spacing.sm }}>
                  {(topicBreakdownPct.length > 0
                    ? topicBreakdownPct
                    : [
                        { name: 'Subject A', pct: 0, color: '#6366F1' },
                        { name: 'Subject B', pct: 0, color: '#10B981' },
                        { name: 'Subject C', pct: 0, color: '#F59E0B' },
                      ]
                  ).map((t, i) => (
                    <View key={i} style={{ gap: spacing.xs, opacity: topicBreakdownPct.length === 0 ? 0.35 : 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color={theme.textSecondary}>
                          {t.name}
                        </Typography>
                        <Typography variant="caption" color={t.color}>
                          {t.pct}%
                        </Typography>
                      </View>
                      <ProgressBar progress={t.pct / 100} height={6} color={t.color} />
                    </View>
                  ))}
                </View>
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
              component: advancedData?.chronotype
                ? <ChronotypeCard key="chronotype" data={advancedData.chronotype} />
                : null,
            },
            {
              key: 'speed_accuracy',
              icon: 'speedometer-outline' as const,
              label: 'Speed vs. Accuracy',
              desc: 'Visualise your recall performance',
              tier: 'Pro' as const,
              unlocked: hasDeepInsights,
              component: advancedData?.speedAccuracy
                ? <SpeedAccuracyChart key="speed_accuracy" data={advancedData.speedAccuracy} />
                : null,
            },
            {
              key: 'mastery_radar',
              icon: 'radio-outline' as const,
              label: 'Subject Mastery Radar',
              desc: 'Radar chart across all subjects',
              tier: 'Master' as const,
              unlocked: hasMasteryRadar,
              component: advancedData?.subjectStrengths
                ? <SubjectRadarChart key="mastery_radar" data={advancedData.subjectStrengths} />
                : null,
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
                      : `Unlock ${lockedFeatures.length} more features. Upgrade to ${upgradeTier}.`
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
                        {`${upgradeTier} plan — upgrade to access`}
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
                        {`Upgrade to ${upgradeTier} →`}
                      </Typography>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </>
          );
        })()}

        {/* ── Level Mastery — overall knowledge depth per subject (free for all) ── */}
        {levelSummary.length > 0 && (
          <Card>
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="Subject Mastery" sub="Overall knowledge depth" />
              <Typography variant="caption" color={theme.textTertiary}>
                Track how many cards you've mastered across all levels for each subject
              </Typography>
              {levelSummary.map((s: any, i: number) => (
                <ProgressBar
                  key={`${s.examId}-${s.subjectId}-mastery`}
                  progress={Math.min(s.correctAnswers / CARDS_PER_SUBJECT, 1)}
                  label={`${s.subjectName} · ${s.correctAnswers}/${CARDS_PER_SUBJECT}`}
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
            sub={
              badgeList.length > 0
                ? `${badgeList.filter((b) => b.earned).length}/${badgeList.length} earned`
                : undefined
            }
          />
          {badgeList.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
              {badgeList.map((b) => (
                <BadgeItem
                  key={b.id}
                  name={b.name}
                  icon={b.icon}
                  earned={b.earned}
                  accent={b.accent}
                />
              ))}
            </View>
          ) : (
            <View
              style={{
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.xl,
                backgroundColor: theme.cardAlt,
                borderRadius: 16,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: '#F59E0B18',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="ribbon-outline" size={24} color="#F59E0B" />
              </View>
              <Typography variant="label" align="center">
                No Badges Yet
              </Typography>
              <Typography variant="caption" color={theme.textTertiary} align="center">
                Complete study milestones to earn your first badge
              </Typography>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/study')}
                accessibilityLabel="Start studying to earn badges"
                accessibilityRole="button"
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 10,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}
              >
                <Typography variant="label" color="#FFFFFF">
                  Start Studying
                </Typography>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
