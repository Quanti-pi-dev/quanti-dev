// ─── StudyProgressHeader ────────────────────────────────────
// Contextual study signals instead of a raw "Card X of Y" counter.
// Psychology: replaces a meaningless position-in-shuffled-deck number
// with streak momentum (Goal Gradient), correct count, and encouragement.

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { SPRING_ENTRY } from '../../theme/animations';

interface StudyProgressHeaderProps {
  currentIdx: number;
  total: number;
  correctCount: number;
  currentStreak: number;
}

export const StudyProgressHeader = React.memo(function StudyProgressHeader({
  currentIdx,
  total,
  correctCount,
  currentStreak,
}: StudyProgressHeaderProps) {
  const { theme } = useTheme();
  const rawProgress = total > 0 ? (currentIdx + 1) / total : 0;
  const incorrectCount = currentIdx + 1 - correctCount - (rawProgress < 1 ? 1 : 0);
  const safeIncorrect = Math.max(0, incorrectCount);

  // Animated progress bar width
  const progressValue = useSharedValue(0);
  useEffect(() => {
    progressValue.value = withSpring(rawProgress, { ...SPRING_ENTRY, stiffness: 180 });
  }, [rawProgress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%` as unknown as number,
  }));

  // ─── Contextual label based on momentum ────────────────────
  // Streak ≥ 3: hot streak (amber, bold)
  // Streak 1–2:  positive progress (green, calm)
  // Streak 0 with answers: encouragement
  // Nothing answered yet: empty (first card, no context)
  const streakLabel = currentStreak >= 3
    ? `🔥 ${currentStreak} in a row!`
    : currentStreak >= 1
      ? `🎯 ${correctCount} correct`
      : correctCount > 0
        ? 'Keep going!'
        : '';

  const streakColor = currentStreak >= 3
    ? '#F59E0B'
    : currentStreak >= 1
      ? theme.success
      : theme.textTertiary;

  // Progress bar color follows the streak state
  const barColor = currentStreak >= 3
    ? '#F59E0B'
    : correctCount > 0
      ? theme.success
      : theme.primary;

  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, gap: spacing.sm }}>
      {/* Contextual label + score pills */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography
          variant="caption"
          color={streakColor}
          style={currentStreak >= 3 ? { fontWeight: '700' } : undefined}
        >
          {streakLabel}
        </Typography>

        {/* Score pills */}
        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
          {/* Correct */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              backgroundColor: theme.successMuted,
              borderRadius: radius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
            }}
          >
            <Ionicons name="checkmark-circle" size={12} color={theme.success} />
            <Typography variant="caption" color={theme.success} style={{ fontWeight: '700', fontSize: 11 }}>
              {correctCount}
            </Typography>
          </View>

          {/* Incorrect */}
          {safeIncorrect > 0 && (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: theme.errorMuted,
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}
            >
              <Ionicons name="close-circle" size={12} color={theme.error} />
              <Typography variant="caption" color={theme.error} style={{ fontWeight: '700', fontSize: 11 }}>
                {safeIncorrect}
              </Typography>
            </View>
          )}
        </View>
      </View>

      {/* Animated progress bar */}
      <View
        style={{
          height: 6,
          borderRadius: radius.full,
          backgroundColor: theme.border,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            barStyle,
            {
              height: '100%',
              borderRadius: radius.full,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
});
