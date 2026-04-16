// ─── Home Dashboard ──────────────────────────────────────────
// Personalized greeting, stats grid, resume CTA, explore section, recent activity.
// Feature gates: Resume CTA (tier 1+), Exams 4+ (tier 1+)

import { useEffect } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Divider } from '../../src/components/ui/Divider';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { StatCard } from '../../src/components/StatCard';
import { ExamCard } from '../../src/components/ExamCard';
import { ActivityItem } from '../../src/components/ActivityItem';
import { StreakWidget } from '../../src/components/StreakWidget';
import { CoinDisplay } from '../../src/components/CoinDisplay';
import { StudyInsightsCard } from '../../src/components/StudyInsightsCard';
import { LockedFeature } from '../../src/components/subscription/LockedFeature';

import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useSubscription } from '../../src/contexts/SubscriptionContext';
import { useProgressSummary, useStudyStreak } from '../../src/hooks/useProgress';
import { useCoinBalance } from '../../src/hooks/useGamification';
import { useExams } from '../../src/hooks/useExams';
import { useQuery } from '@tanstack/react-query';
import { fetchRecentSessions } from '../../src/services/api-contracts';
import { formatRelativeTime } from '../../src/utils/time';

const FREE_EXAM_PREVIEW = 3;

function getGreeting(name: string, streakDays?: number) {
  const first = name.split(' ')[0];
  if (streakDays && streakDays >= 7) return `🔥 ${streakDays}-day streak, ${first}!`;
  if (streakDays && streakDays >= 3) return `Keep it up, ${first}! ${streakDays} days strong 💪`;
  const hour = new Date().getHours();
  const time = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${time}, ${first} 👋`;
}

function UpgradePill({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  // Subtle shimmer: a white overlay pulses every 3 seconds
  const shimmerOpacity = useSharedValue(0);

  useEffect(() => {
    shimmerOpacity.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(0, { duration: 600 }),
          withTiming(0, { duration: 1800 }), // pause between pulses
        ),
        -1, // infinite
      ),
    );
  }, [shimmerOpacity]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: theme.primaryMuted, borderWidth: 1, borderColor: theme.primary + '33',
        overflow: 'hidden',
      }}
      activeOpacity={0.8}
    >
      {/* Shimmer overlay */}
      <Animated.View
        style={[
          shimmerStyle,
          {
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.35)',
            borderRadius: radius.full,
          },
        ]}
        pointerEvents="none"
      />
      <Ionicons name="rocket-outline" size={13} color={theme.primary} />
      <Typography variant="captionBold" color={theme.primary}>Upgrade</Typography>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { isSubscribed, goToUpgrade } = useSubscriptionGate();
  const { subscription } = useSubscription();

  // Detect recently expired trial for the upgrade prompt
  const trialExpired =
    subscription != null &&
    !subscription.isActive &&
    (subscription.status === 'expired' || subscription.status === 'canceled');

  const displayName = user?.displayName ?? 'Learner';

  // ─── Real data hooks ─────────────────────────────────
  const { data: coinData } = useCoinBalance();
  const { data: streakData } = useStudyStreak();
  const { data: progressData } = useProgressSummary();
  // Reuses the shared exam cache from useExams — no double-fetch with Study tab
  const { data: examsPages, isLoading: examsLoading } = useExams(10);
  const exams = examsPages?.pages?.flatMap((p) => p.data) ?? [];
  const { data: activityData } = useQuery({
    queryKey: ['progress-history-home'],
    queryFn: () => fetchRecentSessions(5),
    staleTime: 60_000, // 1 min — prevents refetch on tab switch
  });

  const coins = coinData?.balance ?? 0;
  const streak = streakData?.currentStreak ?? 0;
  const solved = progressData?.totalCardsCompleted ?? 0;
  const accuracy = progressData?.overallAccuracy != null ? `${Math.round(progressData.overallAccuracy)}%` : '—';

  // Last session for resume CTA
  const lastSession = activityData?.[0];

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ─── Top bar ─── */}
        <View
          style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: spacing.xl, paddingTop: spacing.base, paddingBottom: spacing.sm,
          }}
        >
          <View>
            <Typography variant="h3">{getGreeting(displayName, streak)}</Typography>
            <Typography variant="caption" color={theme.textTertiary}>Ready to study today?</Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {!isSubscribed && <UpgradePill onPress={goToUpgrade} />}
            <CoinDisplay coins={coins} />
            <TouchableOpacity
              onPress={() => router.push('/shop')}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={{
                width: 44, height: 44, borderRadius: radius.full,
                backgroundColor: theme.cardAlt, borderWidth: 1.5, borderColor: theme.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="cart-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl, paddingBottom: spacing['3xl'] }}>

          {/* ─── Trial Expiry Banner ─── */}
          {trialExpired && (
            <TouchableOpacity
              onPress={goToUpgrade}
              activeOpacity={0.85}
              style={{
                backgroundColor: theme.primaryMuted,
                borderRadius: radius['2xl'],
                borderWidth: 1.5,
                borderColor: theme.primary + '44',
                padding: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <Ionicons name="rocket-outline" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Typography variant="label" color={theme.primary}>
                  Your free trial ended
                </Typography>
                <Typography variant="caption" color={theme.textSecondary}>
                  Keep learning — upgrade to continue your progress
                </Typography>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </TouchableOpacity>
          )}
          {/* ─── Streak ─── */}
          <StreakWidget streak={streak} freezes={streakData?.streakFreezes} />

          {/* ─── Study Insights ─── */}
          <StudyInsightsCard data={{
            streak,
            freezes: streakData?.streakFreezes ?? 0,
            accuracy: progressData?.overallAccuracy ?? null,
            studiedToday: streakData?.lastStudyDate === new Date().toISOString().split('T')[0],
          }} />

          {/* ─── Stats Grid ─── */}
          <View style={{ gap: spacing.sm }}>
            <Typography variant="label" color={theme.textTertiary}>Your stats</Typography>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatCard icon="flash-outline" label="Solved" value={String(solved)} accent={theme.statSolved} />
              <StatCard icon="checkmark-circle-outline" label="Accuracy" value={accuracy} accent={theme.statAccuracy} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatCard icon="ellipse-outline" label="Coins" value={coins.toLocaleString()} accent={theme.statCoins} />
              <StatCard icon="flame-outline" label="Streak" value={`${streak}d`} accent={theme.statStreak} />
            </View>
          </View>

          {/* ─── Resume CTA — gated to tier 1+ ─── */}
          {lastSession && (
            <LockedFeature minTier={1} label="Resume studying — Available on Basic and above">
              <View
                style={{
                  backgroundColor: theme.primary, borderRadius: radius['2xl'],
                  padding: spacing.xl, gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ gap: spacing.xs, flex: 1 }}>
                    <Typography variant="overline" color="rgba(255,255,255,0.7)">Continue where you left off</Typography>
                    <Typography variant="h4" color={theme.buttonPrimaryText}>{lastSession.deckTitle}</Typography>
                    <Typography variant="caption" color="rgba(255,255,255,0.7)">
                      {lastSession.cardsStudied} cards · {Math.round((lastSession.correctAnswers / Math.max(lastSession.cardsStudied, 1)) * 100)}% correct
                    </Typography>
                  </View>
                  <View
                    style={{
                      width: 52, height: 52, borderRadius: radius.full,
                      backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="play" size={22} color={theme.buttonPrimaryText} />
                  </View>
                </View>
                <Button
                  variant="ghost" size="sm"
                  onPress={() => router.push(`/flashcards/${lastSession.deckId}`)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start' }}
                >
                  Resume Study
                </Button>
              </View>
            </LockedFeature>
          )}

          {/* ─── Explore Exams ─── */}
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h4">Explore Exams</Typography>
              <TouchableOpacity onPress={() => router.push('/(tabs)/study')}>
                <Typography variant="label" color={theme.primary}>See all</Typography>
              </TouchableOpacity>
            </View>
            {examsLoading ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }}>
                <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl }}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width={180} height={140} borderRadius={radius.xl} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }}>
                <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl }}>
                  {(exams ?? []).map((exam, idx) => {
                    const isLocked = !isSubscribed && idx >= FREE_EXAM_PREVIEW;
                    if (isLocked) {
                      return (
                        <LockedFeature key={exam.id} minTier={1} label="Upgrade to access more exams">
                          <ExamCard
                            name={exam.title}
                            count={exam.questionCount ?? 0}
                            progress={0}
                            icon="library-outline"
                            accent={theme.statSolved}
                            onPress={() => {}}
                            style={{ width: 180 }}
                          />
                        </LockedFeature>
                      );
                    }
                    return (
                      <ExamCard
                        key={exam.id}
                        name={exam.title}
                        count={exam.questionCount ?? 0}
                        progress={0}
                        icon="library-outline"
                        accent={theme.statSolved}
                        onPress={() => router.push({
                          pathname: '/exams/[examId]/subjects' as const,
                          params: { examId: exam.id, title: exam.title },
                        })}
                        style={{ width: 180 }}
                      />
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>

          {/* ─── Recent Activity ─── */}
          {activityData && activityData.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <Typography variant="h4">Recent Activity</Typography>
              <View style={{ gap: 0 }}>
                {activityData.map((item, idx) => (
                  <View key={`${item.deckId}-${idx}`}>
                    <ActivityItem
                      examName={item.deckTitle}
                      cardsStudied={item.cardsStudied}
                      accuracy={Math.round((item.correctAnswers / Math.max(item.cardsStudied, 1)) * 100)}
                      timeAgo={formatRelativeTime(item.endedAt)}
                      icon="library-outline"
                    />
                    {idx < activityData.length - 1 && <Divider style={{ marginVertical: 0 }} />}
                  </View>
                ))}
              </View>
            </View>
          ) : solved === 0 ? (
            /* ── Empty state for new users (FIX U5) ── */
            <View
              style={{
                alignItems: 'center', gap: spacing.lg,
                padding: spacing['2xl'],
                backgroundColor: theme.cardAlt, borderRadius: radius['2xl'],
              }}
            >
              <View
                style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: theme.primaryMuted,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="book-outline" size={28} color={theme.primary} />
              </View>
              <View style={{ alignItems: 'center', gap: spacing.xs }}>
                <Typography variant="h4" align="center">Start your journey</Typography>
                <Typography variant="body" color={theme.textSecondary} align="center">
                  Pick an exam above and complete your first study session to see your progress here.
                </Typography>
              </View>
              <Button onPress={() => router.push('/(tabs)/study')} variant="primary" size="sm">
                Browse Exams
              </Button>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
