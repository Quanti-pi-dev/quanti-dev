// ─── TodaysFocusSection ──────────────────────────────────────
// Smart daily study dashboard. Combines:
//   1. Streak + adaptive daily goal progress ring
//   2. Quick-action buttons for targeted study
//   3. Motivational empty state for new users
//
// Goal source priority (highest → lowest):
//   1. studyPlan.sessions sum (personalised by the HLR/BKT intelligence engine)
//   2. Server-side progressData.weeklyActivity card count (validated)
//   3. AsyncStorage local progress (optimistic, reflects mid-session state instantly)
//
// The ring always shows the *maximum* of server + local counts so it
// never regresses during a session.

import { useEffect, useMemo } from 'react';
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
import { useLearningProfile } from '../../hooks/useLearningProfile';
import { useDailyPlanProgress } from '../../hooks/useDailyPlanProgress';
import { getLocalDateString } from '../../utils/time';
import type { PlannedStudySession } from '@kd/shared';

// ─── Fallback goal (used only when the study plan hasn't loaded yet) ───────
const FALLBACK_DAILY_GOAL = 20;

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

// ─── ML difficulty config ─────────────────────────────────────
const DIFFICULTY_CONFIG = {
  challenging: { color: '#EF4444', label: 'Challenging', icon: 'flash' as const },
  moderate:    { color: '#F59E0B', label: 'Moderate',    icon: 'trending-up' as const },
  easy_review: { color: '#10B981', label: 'Review',      icon: 'checkmark-circle' as const },
} as const;

const MODEL_CONFIG = {
  dkt:  { label: 'DKT', color: '#6366F1' },
  sakt: { label: 'SAKT', color: '#8B5CF6' },
  bkt:  { label: 'BKT', color: '#64748B' },
} as const;

const REASON_CONFIG = {
  overdue:       { icon: 'alert-circle' as const,  color: '#EF4444', label: 'Overdue' },
  declining:     { icon: 'trending-down' as const,  color: '#F59E0B', label: 'Fading' },
  new_topic:     { icon: 'sparkles' as const,       color: '#8B5CF6', label: 'New' },
  reinforcement: { icon: 'refresh-circle' as const, color: '#10B981', label: 'Reinforce' },
} as const;

// ─── ML-aware session card ────────────────────────────────────
function SessionCard({
  session,
  localAnswered,
  isComplete,
  onPress,
}: {
  session: PlannedStudySession;
  localAnswered: number;
  isComplete: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const diff   = DIFFICULTY_CONFIG[session.difficulty];
  const reason = REASON_CONFIG[session.reason];
  const model  = session.mlMeta ? MODEL_CONFIG[session.mlMeta.model] : null;
  const dropoutHigh = (session.mlMeta?.dropoutRisk ?? 0) >= 0.55;
  const segFill = Math.min(localAnswered / session.cardCount, 1);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Study ${session.topicName}`}
      style={{
        borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isComplete ? '#10B98130' : theme.border + '55',
        backgroundColor: isComplete ? '#10B98108' : theme.background,
      }}
    >
      {/* Coloured left-edge accent */}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 3, backgroundColor: isComplete ? '#10B981' : diff.color, borderRadius: 2 }} />

        <View style={{ flex: 1, padding: spacing.md, gap: spacing.xs }}>
          {/* Row 1: topic + chevron */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{
              width: 28, height: 28, borderRadius: radius.md,
              backgroundColor: (isComplete ? '#10B981' : diff.color) + '18',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons
                name={isComplete ? 'checkmark-circle' : diff.icon}
                size={14}
                color={isComplete ? '#10B981' : diff.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="captionBold" color={theme.text} numberOfLines={1} style={{ fontSize: 12 }}>
                {session.topicName}
              </Typography>
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                {session.subjectName}
              </Typography>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
          </View>

          {/* Row 2: meta pills */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {/* Difficulty */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              backgroundColor: diff.color + '15', borderRadius: radius.full,
              paddingHorizontal: 7, paddingVertical: 2,
            }}>
              <Typography variant="caption" color={diff.color} style={{ fontSize: 9, fontWeight: '700' }}>
                {diff.label}
              </Typography>
            </View>

            {/* Reason */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              backgroundColor: reason.color + '12', borderRadius: radius.full,
              paddingHorizontal: 7, paddingVertical: 2,
            }}>
              <Ionicons name={reason.icon} size={9} color={reason.color} />
              <Typography variant="caption" color={reason.color} style={{ fontSize: 9, fontWeight: '600' }}>
                {reason.label}
              </Typography>
            </View>

            {/* Card count + time */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="layers-outline" size={10} color={theme.textTertiary} />
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                {session.cardCount} cards · ~{session.estimatedMinutes}m
              </Typography>
            </View>

            {/* Adjusted badge */}
            {session.mlMeta?.cardCountAdjusted && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: '#F59E0B18', borderRadius: radius.full,
                paddingHorizontal: 7, paddingVertical: 2,
              }}>
                <Ionicons name="shield-checkmark-outline" size={9} color="#F59E0B" />
                <Typography variant="caption" color="#F59E0B" style={{ fontSize: 9, fontWeight: '600' }}>
                  Optimised
                </Typography>
              </View>
            )}
          </View>

          {/* Row 3: dropout nudge (only when high risk + not yet started) */}
          {dropoutHigh && localAnswered === 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: '#F59E0B0A', borderRadius: radius.md,
              paddingHorizontal: spacing.sm, paddingVertical: 4,
              borderWidth: 1, borderColor: '#F59E0B20',
            }}>
              <Ionicons name="bulb-outline" size={11} color="#F59E0B" />
              <Typography variant="caption" color="#F59E0B" style={{ fontSize: 10, flex: 1 }}>
                Tip: short, focused session — aim for {Math.min(session.cardCount, 10)} cards to build momentum.
              </Typography>
            </View>
          )}

          {/* Row 4: per-session progress bar */}
          {localAnswered > 0 && (
            <View style={{ height: 3, borderRadius: 2, backgroundColor: theme.border + '44', overflow: 'hidden' }}>
              <View style={{
                width: `${segFill * 100}%`, height: '100%',
                backgroundColor: isComplete ? '#10B981' : '#6366F1',
                borderRadius: 2,
              }} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
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
      <View style={{
        width: 30, height: 30, borderRadius: radius.full,
        backgroundColor: color + '18',
        alignItems: 'center', justifyContent: 'center',
      }}>
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

  // ── Data hooks ────────────────────────────────────────────
  const { data: streakData, isLoading: isStreakLoading } = useStudyStreak();
  const { data: progressData, isLoading: isProgressLoading } = useProgressSummary();
  const { data: coinsTodayData } = useCoinsToday();
  const { data: profile, isLoading: isProfileLoading } = useLearningProfile();
  const { progress: localProgress } = useDailyPlanProgress();

  // ── Streak & stats ────────────────────────────────────────
  const streak       = streakData?.currentStreak ?? 0;
  const longestStreak = streakData?.longestStreak ?? 0;
  const freezes      = streakData?.streakFreezes ?? 0;
  const totalCards   = progressData?.totalCardsCompleted ?? 0;
  const overallAccuracy = progressData?.overallAccuracy ?? 0;
  const coinsToday   = coinsTodayData?.earnedToday ?? 0;
  const coinsCap     = coinsTodayData?.dailyCap ?? 500;
  const hasStudied   = totalCards > 0;

  // ── Adaptive daily goal ───────────────────────────────────
  // Sum of cardCount across all planned sessions for today.
  // Falls back to FALLBACK_DAILY_GOAL if the profile hasn't loaded yet.
  const dailyGoal = useMemo(() => {
    const sessions = profile?.studyPlan?.sessions ?? [];
    if (sessions.length === 0) return FALLBACK_DAILY_GOAL;
    return sessions.reduce((sum, s) => sum + s.cardCount, 0);
  }, [profile?.studyPlan?.sessions]);

  // ── Today's card count (server + local max) ──────────────
  // Server count: from weeklyActivity for today's date
  const serverCards = progressData?.weeklyActivity?.find(
    (d) => d.date === getLocalDateString(),
  )?.cardsStudied ?? 0;

  // Local count: sum answered across all in-progress sessions in AsyncStorage.
  // Gives instant feedback before the server-side cache re-validates.
  const localCards = useMemo(() => {
    return Object.values(localProgress).reduce((sum, s) => sum + s.answered, 0);
  }, [localProgress]);

  // Always show the higher of the two to prevent visible regression
  const todayCards = Math.max(serverCards, localCards);

  // ── Ring state ────────────────────────────────────────────
  const goalProgress = Math.min(todayCards / dailyGoal, 1);
  const goalComplete = todayCards >= dailyGoal;
  const remaining   = Math.max(0, dailyGoal - todayCards);

  const isLoading = isStreakLoading || isProgressLoading || isProfileLoading;

  // ── Entrance animation ────────────────────────────────────
  const sectionOpacity    = useSharedValue(0);
  const sectionTranslateY = useSharedValue(16);
  useEffect(() => {
    sectionOpacity.value    = withTiming(1, { duration: 400 });
    sectionTranslateY.value = withSpring(0, { stiffness: 140, damping: 20 });
  }, []);

  const sectionAnimStyle = useAnimatedStyle(() => ({
    opacity: sectionOpacity.value,
    transform: [{ translateY: sectionTranslateY.value }],
  }));

  // ── Navigation helpers ────────────────────────────────────
  function handleExploreExams() {
    router.push('/explore-exams');
  }

  function handleViewProgress() {
    router.push('/(tabs)/progress');
  }

  // Bug #5: difficulty → level mapping for topic-review fetchLevelCards
  const DIFFICULTY_TO_LEVEL: Record<string, string> = {
    challenging: 'Advanced',
    moderate:    'Proficient',
    easy_review: 'Emerging',
  };

  function handleSessionPress(session: PlannedStudySession) {
    // Encode mlMeta as string params — Expo Router only accepts string/number values.
    // topic-review.tsx decodes these back into a SessionMlMeta object for FocusQualityScore.
    const mlParams = session.mlMeta ? {
      mlPDifficult:  String((session.mlMeta.pDifficult  ?? 0).toFixed(3)),
      mlDropoutRisk: String((session.mlMeta.dropoutRisk ?? 0).toFixed(3)),
      mlModel:       session.mlMeta.model,
    } : {};

    router.push({
      pathname: '/topic-review',
      params: {
        topicSlug:   session.topicSlug,
        topicName:   session.topicName,
        subjectName: session.subjectName,
        subjectId:   session.subjectId,
        examId:      session.examId ?? '',
        mode:        'daily_plan',
        cardCount:   String(session.cardCount),
        level:       DIFFICULTY_TO_LEVEL[session.difficulty] ?? 'Emerging',
        ...mlParams,
      },
    });
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

  // For brand-new users, skip the dashboard ring and show only the onboarding CTA.
  if (!hasStudied) {
    return (
      <Animated.View style={sectionAnimStyle}>
        <View style={{ gap: spacing.md }}>
          {/* Welcome / onboarding CTA */}
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
                    Begin your learning journey
                  </Typography>
                  <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11 }}>
                    Pick an exam and complete your first session to unlock your personalised mastery profile.
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6366F1AA" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Quick actions still available to new users */}
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
        </View>
      </Animated.View>
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
            {/* Top gradient strip — green when goal met, indigo otherwise */}
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
                      {goalComplete ? 'Done!' : `/${dailyGoal}`}
                    </Typography>
                  </View>
                </GoalRing>

                {/* Stats column */}
                <View style={{ flex: 1, gap: spacing.sm }}>
                  {/* Title + subtitle */}
                  <View>
                    <Typography variant="label" style={{ fontSize: 14 }}>
                      {goalComplete
                        ? '🎉 Daily mastery goal achieved!'
                        : todayCards > 0
                          ? 'Building your knowledge...'
                          : 'Start building mastery'}
                    </Typography>
                    <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11 }}>
                      {goalComplete
                        ? `${todayCards} cards reviewed — your retention is strengthening`
                        : `${remaining} card${remaining !== 1 ? 's' : ''} to strengthen today's retention`}
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

              {/* Row 3: compact progress summary bar */}
              {(profile?.studyPlan?.sessions ?? []).length > 0 && (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 10 }}>
                        Today's plan
                      </Typography>
                      {/* Knowledge engine badge */}
                      {profile?.studyPlan?.sessions[0]?.mlMeta && (
                        <View style={{
                          backgroundColor: MODEL_CONFIG[profile.studyPlan.sessions[0].mlMeta.model].color + '18',
                          borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1,
                        }}>
                          <Typography
                            variant="caption"
                            color={MODEL_CONFIG[profile.studyPlan.sessions[0].mlMeta.model].color}
                            style={{ fontSize: 8, fontWeight: '700', letterSpacing: 0.4 }}
                          >
                            {MODEL_CONFIG[profile.studyPlan.sessions[0].mlMeta.model].label} powered
                          </Typography>
                        </View>
                      )}
                    </View>
                    <Typography variant="captionBold" color={theme.textTertiary} style={{ fontSize: 10 }}>
                      {todayCards}/{dailyGoal} cards
                    </Typography>
                  </View>
                  {/* Segmented bar */}
                  <View style={{ flexDirection: 'row', gap: 3, height: 3 }}>
                    {profile!.studyPlan!.sessions.map((session, idx) => {
                      const sl = localProgress[session.topicSlug];
                      const done = sl?.isComplete ? session.cardCount : (sl?.answered ?? 0);
                      const fill = Math.min(done / session.cardCount, 1);
                      return (
                        <View key={session.topicSlug + idx} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: theme.border + '44', overflow: 'hidden' }}>
                          <View style={{ width: `${fill * 100}%`, height: '100%', backgroundColor: fill >= 1 ? '#10B981' : '#6366F1', borderRadius: 2 }} />
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── ML session cards ───────────────────────────── */}
        {(profile?.studyPlan?.sessions ?? []).length > 0 && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
            <Typography variant="captionBold" color={theme.textSecondary} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Today's Sessions
            </Typography>
            {profile!.studyPlan!.sessions.map((session) => {
              const sl = localProgress[session.topicSlug];
              const answered = sl?.isComplete ? session.cardCount : (sl?.answered ?? 0);
              const complete = (sl?.isComplete ?? false) || answered >= session.cardCount;
              return (
                <SessionCard
                  key={session.topicSlug}
                  session={session}
                  localAnswered={answered}
                  isComplete={complete}
                  onPress={() => handleSessionPress(session)}
                />
              );
            })}
          </View>
        )}

        {/* ── Quick actions row ──────────────────────────── */}
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
      </View>
    </Animated.View>
  );
}
