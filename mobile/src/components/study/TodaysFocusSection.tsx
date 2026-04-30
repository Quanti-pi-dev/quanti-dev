// ─── TodaysFocusSection ──────────────────────────────────────
// Smart daily study dashboard. Combines:
//   1. Streak + daily goal progress ring
//   2. Quick-action buttons for targeted study
//   3. Motivational empty state for new users

import { useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { radius, spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Skeleton } from '../ui/Skeleton';
import { useStudyStreak, useProgressSummary } from '../../hooks/useProgress';
import { useCoinsToday } from '../../hooks/useGamification';

// ─── Constants ────────────────────────────────────────────────
const DAILY_CARD_GOAL = 30; // default daily target

// ─── Animated circular progress ring ─────────────────────────
function GoalRing({
  progress,
  size,
  strokeWidth,
  gradColors,
  trackColor,
  children,
}: {
  progress: number;
  size: number;
  strokeWidth: number;
  gradColors: [string, string];
  trackColor: string;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clampedProgress = Math.min(progress, 1);
  const dashOffset = circumference * (1 - clampedProgress);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={trackColor} strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Fill */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={gradColors[0]} strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center content */}
      <View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

// ─── Streak Flame with pulse animation ────────────────────────
function StreakFlame({ streak }: { streak: number }) {
  const { theme } = useTheme();
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (streak >= 3) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    }
  }, [streak]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const isActive = streak > 0;
  const flameColor = streak >= 7 ? '#EF4444' : streak >= 3 ? '#F59E0B' : '#94A3B8';

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Animated.View style={pulseStyle}>
        <View
          style={{
            width: 44, height: 44, borderRadius: radius.full,
            backgroundColor: flameColor + '18',
            borderWidth: 1.5, borderColor: flameColor + '44',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons
            name={isActive ? 'flame' : 'flame-outline'}
            size={22}
            color={flameColor}
          />
        </View>
      </Animated.View>
      <Typography
        variant="captionBold"
        color={isActive ? flameColor : theme.textTertiary}
        style={{ fontSize: 11 }}
      >
        {streak}d
      </Typography>
    </View>
  );
}

// ─── Quick Action Button ──────────────────────────────────────
function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: color + '0A',
        borderRadius: radius.xl,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderWidth: 1,
        borderColor: color + '22',
      }}
    >
      <View
        style={{
          width: 30, height: 30, borderRadius: radius.full,
          backgroundColor: color + '18',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Typography variant="captionBold" color={theme.text} numberOfLines={1} style={{ fontSize: 11, flex: 1 }}>
        {label}
      </Typography>
      <Ionicons name="chevron-forward" size={12} color={color + 'AA'} />
    </TouchableOpacity>
  );
}

// ─── Main Section Component ──────────────────────────────────
export function TodaysFocusSection() {
  const { theme } = useTheme();
  const router = useRouter();

  // ── Data hooks ───────────────────────────────────────────
  const { data: streakData, isLoading: isStreakLoading } = useStudyStreak();
  const { data: progressData, isLoading: isProgressLoading } = useProgressSummary();
  const { data: coinsTodayData } = useCoinsToday();

  const streak = streakData?.currentStreak ?? 0;
  const longestStreak = streakData?.longestStreak ?? 0;
  const freezes = streakData?.streakFreezes ?? 0;
  const todayCards = progressData?.weeklyActivity?.find(
    (d) => d.date === new Date().toISOString().split('T')[0],
  )?.cardsStudied ?? 0;
  const totalCards = progressData?.totalCardsCompleted ?? 0;
  const overallAccuracy = progressData?.overallAccuracy ?? 0;
  const coinsToday = coinsTodayData?.earnedToday ?? 0;
  const coinsCap = coinsTodayData?.dailyCap ?? 500;

  const goalProgress = Math.min(todayCards / DAILY_CARD_GOAL, 1);
  const goalComplete = todayCards >= DAILY_CARD_GOAL;
  const hasStudied = totalCards > 0;

  const isLoading = isStreakLoading || isProgressLoading;

  // ── Entrance animation ────────────────────────────────────
  const sectionOpacity = useSharedValue(0);
  const sectionTranslateY = useSharedValue(16);
  useEffect(() => {
    sectionOpacity.value = withTiming(1, { duration: 400 });
    sectionTranslateY.value = withSpring(0, { stiffness: 140, damping: 20 });
  }, []);

  const sectionAnimStyle = useAnimatedStyle(() => ({
    opacity: sectionOpacity.value,
    transform: [{ translateY: sectionTranslateY.value }],
  }));

  // ── Navigation helpers ────────────────────────────────────
  function handleExploreExams() {
    router.push('/explore-exams' as never);
  }

  function handleViewProgress() {
    router.push('/(tabs)/progress' as never);
  }

  // ── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
        <Skeleton height={180} borderRadius={radius['2xl']} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Skeleton height={48} borderRadius={radius.xl} style={{ flex: 1 }} />
          <Skeleton height={48} borderRadius={radius.xl} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={sectionAnimStyle}>
      <View style={{ gap: spacing.md }}>
        {/* ── Main dashboard card ─────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.xl }}>
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: radius['2xl'],
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: theme.border + '88',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            {/* Top gradient strip */}
            <LinearGradient
              colors={goalComplete ? ['#10B981', '#34D399'] : ['#6366F1', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: 3 }}
            />

            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              {/* Row 1: Goal Ring + Streak + Stats */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                {/* Daily goal ring */}
                <GoalRing
                  progress={goalProgress}
                  size={76}
                  strokeWidth={5}
                  gradColors={goalComplete ? ['#10B981', '#34D399'] : ['#6366F1', '#818CF8']}
                  trackColor={goalComplete ? '#10B98122' : '#6366F122'}
                >
                  <View style={{ alignItems: 'center' }}>
                    {goalComplete ? (
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    ) : (
                      <Typography variant="h3" color={theme.text} style={{ fontSize: 18, fontWeight: '800' }}>
                        {todayCards}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color={theme.textTertiary}
                      style={{ fontSize: 8, marginTop: -1 }}
                    >
                      {goalComplete ? 'Done!' : `/${DAILY_CARD_GOAL}`}
                    </Typography>
                  </View>
                </GoalRing>

                {/* Stats column */}
                <View style={{ flex: 1, gap: spacing.sm }}>
                  {/* Title */}
                  <View>
                    <Typography variant="label" style={{ fontSize: 14 }}>
                      {goalComplete
                        ? '🎉 Daily goal hit!'
                        : todayCards > 0
                          ? 'Keep going!'
                          : 'Start your day'}
                    </Typography>
                    <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11 }}>
                      {goalComplete
                        ? `You studied ${todayCards} cards today`
                        : `${DAILY_CARD_GOAL - todayCards} cards to reach today's goal`}
                    </Typography>
                  </View>

                  {/* Mini stats row */}
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    {/* Streak */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons
                        name={streak > 0 ? 'flame' : 'flame-outline'}
                        size={14}
                        color={streak >= 7 ? '#EF4444' : streak >= 3 ? '#F59E0B' : theme.textTertiary}
                      />
                      <Typography
                        variant="captionBold"
                        color={streak > 0 ? (streak >= 7 ? '#EF4444' : '#F59E0B') : theme.textTertiary}
                        style={{ fontSize: 11 }}
                      >
                        {streak}d streak
                      </Typography>
                    </View>
                    {/* Accuracy */}
                    {hasStudied && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="analytics-outline" size={14} color="#10B981" />
                        <Typography variant="captionBold" color="#10B981" style={{ fontSize: 11 }}>
                          {Math.round(overallAccuracy)}%
                        </Typography>
                      </View>
                    )}
                    {/* Coins today */}
                    {coinsToday > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="wallet-outline" size={14} color="#F59E0B" />
                        <Typography variant="captionBold" color="#F59E0B" style={{ fontSize: 11 }}>
                          {coinsToday}/{coinsCap}
                        </Typography>
                      </View>
                    )}
                  </View>
                </View>

                {/* Streak flame */}
                <StreakFlame streak={streak} />
              </View>

              {/* Row 2: Streak freeze indicator (only if user has freezes) */}
              {freezes > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    backgroundColor: '#3B82F608',
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderColor: '#3B82F618',
                  }}
                >
                  <Ionicons name="snow-outline" size={12} color="#3B82F6" />
                  <Typography variant="caption" color="#3B82F6" style={{ fontSize: 10, flex: 1 }}>
                    {freezes} streak freeze{freezes > 1 ? 's' : ''} available
                  </Typography>
                  {longestStreak > streak && (
                    <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                      Best: {longestStreak}d
                    </Typography>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Quick actions row ───────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', gap: spacing.sm }}>
          <QuickAction
            icon="compass-outline"
            label="Explore Exams"
            color="#6366F1"
            onPress={handleExploreExams}
          />
          <QuickAction
            icon="trending-up-outline"
            label="My Progress"
            color="#10B981"
            onPress={handleViewProgress}
          />
        </View>


        {/* ── New user motivational state ─────────────────── */}
        {!hasStudied && !isLoading && (
          <View style={{ paddingHorizontal: spacing.xl }}>
            <TouchableOpacity
              onPress={handleExploreExams}
              activeOpacity={0.8}
              style={{ borderRadius: radius.xl, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#6366F112', '#8B5CF612']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: '#6366F128',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 50, height: 50, borderRadius: radius.full,
                    backgroundColor: '#6366F118',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="rocket-outline" size={24} color="#6366F1" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Typography variant="label" color="#6366F1">
                    Begin your study journey
                  </Typography>
                  <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11 }}>
                    Pick an exam and complete your first quiz to unlock daily goals, streaks, and insights.
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6366F1AA" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}
