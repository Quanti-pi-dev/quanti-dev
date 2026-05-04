// ─── Exam Countdown Widget ──────────────────────────────────
// Shows days remaining until exam with a radial progress ring,
// pace projection, and quick-start CTA. Only renders when the
// user has set an examDate in their preferences.

import { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Ring Progress ──────────────────────────────────────────
function CountdownRing({
  daysRemaining,
  totalDays,
  size = 80,
}: {
  daysRemaining: number;
  totalDays: number;
  size?: number;
}) {
  const { theme } = useTheme();
  const strokeWidth = 6;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, 1 - daysRemaining / Math.max(totalDays, 1)));

  const animatedProgress = useSharedValue(0);

  // Animate on mount
  useMemo(() => {
    animatedProgress.value = withDelay(
      400,
      withTiming(progress, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  // Urgency color: green → amber → red
  const ringColor =
    daysRemaining > 60
      ? '#10B981'
      : daysRemaining > 30
        ? '#F59E0B'
        : daysRemaining > 14
          ? '#F97316'
          : '#EF4444';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
        {/* Animated progress arc */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center number */}
      <View style={{ alignItems: 'center' }}>
        <Typography
          variant="h2"
          color={ringColor}
          style={{ fontSize: 24, lineHeight: 28, fontWeight: '800' }}
        >
          {daysRemaining}
        </Typography>
        <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
          days
        </Typography>
      </View>
    </View>
  );
}

// ─── Main Widget ────────────────────────────────────────────
interface ExamCountdownProps {
  examDate: string; // YYYY-MM-DD
  examName?: string;
  dailyTarget?: number | null;
  topicsCovered?: number;
  totalTopics?: number;
  onStartStudy?: () => void;
}

export function ExamCountdownWidget({
  examDate,
  examName,
  dailyTarget,
  topicsCovered = 0,
  totalTopics = 0,
  onStartStudy,
}: ExamCountdownProps) {
  const { theme, isDark } = useTheme();

  const { daysRemaining, totalDays, paceLabel, urgencyEmoji } = useMemo(() => {
    const now = new Date();
    const exam = new Date(examDate + 'T00:00:00');
    const diff = Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(diff, 0);

    // Total days = from now back to "6 months before exam" (rough estimate)
    const total = Math.max(remaining + 30, 180);

    let label = '';
    let emoji = '📅';
    if (remaining === 0) {
      label = 'Today is exam day! 🎯';
      emoji = '🔥';
    } else if (remaining <= 7) {
      label = 'Final sprint — every card counts';
      emoji = '🔥';
    } else if (remaining <= 30) {
      label = 'Crunch time — stay focused';
      emoji = '⚡';
    } else if (remaining <= 90) {
      label = 'Building momentum — great pace';
      emoji = '🚀';
    } else {
      label = 'Plenty of time — stay consistent';
      emoji = '📚';
    }

    return { daysRemaining: remaining, totalDays: total, paceLabel: label, urgencyEmoji: emoji };
  }, [examDate]);

  if (daysRemaining < 0) return null;

  // Coverage percentage
  const coveragePercent = totalTopics > 0 ? Math.round((topicsCovered / totalTopics) * 100) : 0;

  return (
    <View
      style={{
        borderRadius: radius['2xl'],
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)',
      }}
    >
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.08)', 'rgba(96,165,250,0.05)', 'rgba(16,185,129,0.04)']
            : ['rgba(99,102,241,0.05)', 'rgba(96,165,250,0.03)', 'rgba(16,185,129,0.02)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.lg }}
      >
        {/* Top row: ring + info */}
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <CountdownRing daysRemaining={daysRemaining} totalDays={totalDays} />

          <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xs }}>
            {/* Exam name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Typography variant="caption" color={theme.textTertiary}>
                {urgencyEmoji}
              </Typography>
              <Typography variant="overline" color={theme.textTertiary}>
                {examName ?? 'YOUR EXAM'}
              </Typography>
            </View>

            {/* Pace message */}
            <Typography variant="bodySemiBold" color={theme.text} numberOfLines={2}>
              {paceLabel}
            </Typography>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 2 }}>
              {dailyTarget && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="flash-outline" size={12} color={theme.primary} />
                  <Typography variant="caption" color={theme.primary}>
                    {dailyTarget}/day
                  </Typography>
                </View>
              )}
              {totalTopics > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="book-outline" size={12} color={theme.textSecondary} />
                  <Typography variant="caption" color={theme.textSecondary}>
                    {topicsCovered}/{totalTopics} topics
                  </Typography>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Coverage progress bar (only if we have topic data) */}
        {totalTopics > 0 && (
          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Typography variant="caption" color={theme.textTertiary}>
                Topic coverage
              </Typography>
              <Typography variant="caption" color={theme.primary}>
                {coveragePercent}%
              </Typography>
            </View>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              <Animated.View
                style={{
                  width: `${coveragePercent}%`,
                  height: '100%',
                  borderRadius: 2,
                }}
              >
                <LinearGradient
                  colors={['#6366F1', '#10B981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, borderRadius: 2 }}
                />
              </Animated.View>
            </View>
          </View>
        )}

        {/* Quick-start CTA */}
        {onStartStudy && (
          <TouchableOpacity
            onPress={onStartStudy}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              marginTop: spacing.md,
              paddingVertical: spacing.sm + 2,
              borderRadius: radius.lg,
              backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)',
            }}
          >
            <Ionicons name="play-circle" size={16} color={theme.primary} />
            <Typography variant="label" color={theme.primary}>
              Start today's session
            </Typography>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}
