// ─── WeeklyHeatmap ───────────────────────────────────────────
// 7-day strip showing study consistency for the current week.
// Each day is a circle that's filled if the user studied that day.
// Today is highlighted with a ring + pulse if not yet completed.

import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/tokens';
import { Typography } from './ui/Typography';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface WeeklyHeatmapProps {
  /** Array of 7 booleans (Mon–Sun) indicating if user studied that day */
  studiedDays: boolean[];
  /** Current day index (0 = Mon, 6 = Sun) */
  todayIndex: number;
  /** Current streak count */
  streak: number;
}

function TodayDot({ isComplete, color }: { isComplete: boolean; color: string }) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isComplete) {
      pulseScale.value = withDelay(
        500,
        withRepeat(
          withSequence(
            withTiming(1.6, { duration: 1000 }),
            withTiming(1.6, { duration: 0 }),
          ),
          -1,
        ),
      );
      pulseOpacity.value = withDelay(
        500,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 1000 }),
            withTiming(0.4, { duration: 0 }),
          ),
          -1,
        ),
      );
    }
  }, [isComplete]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      {!isComplete && (
        <Animated.View
          style={[
            pulseStyle,
            {
              position: 'absolute',
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: color,
            },
          ]}
          pointerEvents="none"
        />
      )}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: isComplete ? color : 'transparent',
          borderWidth: isComplete ? 0 : 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isComplete && (
          <Typography variant="caption" color="#FFFFFF" style={{ fontSize: 10, fontWeight: '700' }}>
            ✓
          </Typography>
        )}
      </View>
    </View>
  );
}

export function WeeklyHeatmap({ studiedDays, todayIndex, streak }: WeeklyHeatmapProps) {
  const { theme } = useTheme();
  const activeColor = theme.success;

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: radius.xl,
        padding: spacing.base,
        gap: spacing.md,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Typography variant="label" color={theme.text}>This Week</Typography>
        </View>
        {streak > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: theme.coinLight,
              borderRadius: radius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
            }}
          >
            <Typography variant="caption" style={{ fontSize: 12 }}>🔥</Typography>
            <Typography
              variant="captionBold"
              color={theme.coin}
              style={{ fontSize: 11 }}
            >
              {streak}d streak
            </Typography>
          </View>
        )}
      </View>

      {/* Day dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {DAYS.map((day, i) => {
          const isToday = i === todayIndex;
          const studied = studiedDays[i] ?? false;
          const isFuture = i > todayIndex;
          const isPast = i < todayIndex;

          return (
            <View key={`${day}-${i}`} style={{ alignItems: 'center', gap: spacing.xs }}>
              <Typography
                variant="caption"
                color={isToday ? theme.text : theme.textTertiary}
                style={{
                  fontSize: 10,
                  fontWeight: isToday ? '700' : '400',
                }}
              >
                {day}
              </Typography>
              {isToday ? (
                <TodayDot isComplete={studied} color={activeColor} />
              ) : (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: studied
                      ? activeColor
                      : isFuture
                        ? theme.border + '44'
                        : (isPast && !studied)
                          ? theme.error + '20'
                          : theme.border + '44',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {studied && (
                    <Typography variant="caption" color="#FFFFFF" style={{ fontSize: 10, fontWeight: '700' }}>
                      ✓
                    </Typography>
                  )}
                  {isPast && !studied && (
                    <Typography variant="caption" color={theme.error + '66'} style={{ fontSize: 10, fontWeight: '500' }}>
                      ✕
                    </Typography>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
