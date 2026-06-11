// ─── MasteryDeltaToast ────────────────────────────────────────
// Momentary toast that surfaces the student's BKT mastery delta
// after a correct answer during a concept_practice session.
//
// Lifetime: mounts → fades in over 250 ms → holds for 1.6 s →
//           fades out. Parent unmounts it by flipping animationKey.
//
// Visual: floats in the top-right corner of the study view,
// above the FlashCard but below the header.

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

// ─── Types ────────────────────────────────────────────────────

interface MasteryDeltaToastProps {
  /** Unique key — change to re-trigger the animation. */
  animationKey: number;
  /** Current mastery % (0–100). */
  currentMastery: number;
  /** Previous mastery % (0–100). Used to compute the delta label. */
  previousMastery: number;
  /** Human-readable concept name shown as the toast subtitle. */
  conceptName?: string;
}

// ─── Component ────────────────────────────────────────────────

export function MasteryDeltaToast({
  animationKey,
  currentMastery,
  previousMastery,
  conceptName,
}: MasteryDeltaToastProps) {
  const { theme } = useTheme();

  const opacity  = useSharedValue(0);
  const translateY = useSharedValue(-8);

  useEffect(() => {
    // Slide down + fade in, hold, then fade out
    opacity.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 1500 }),
      withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
    );
    translateY.value = withSequence(
      withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 1500 }),
      withTiming(-6, { duration: 300 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey]);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const delta = currentMastery - previousMastery;
  // Always show at least +1 so the toast is never "Mastery +0%"
  const displayDelta = Math.max(1, Math.round(delta));

  const isSignificant = displayDelta >= 5;
  const accentColor = isSignificant ? '#10B981' : '#3B82F6';

  return (
    <Animated.View style={[styles.root, animStyle]} pointerEvents="none">
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.card,
            borderColor: accentColor + '35',
            shadowColor: accentColor,
          },
        ]}
      >
        {/* Icon */}
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: accentColor + '18' },
          ]}
        >
          <Ionicons name="stats-chart" size={14} color={accentColor} />
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <Typography
            variant="captionBold"
            color={accentColor}
            style={styles.headline}
          >
            {`Mastery +${displayDelta}% → ${currentMastery}%`}
          </Typography>
          {conceptName ? (
            <Typography
              variant="caption"
              color={accentColor + 'BB'}
              style={styles.sub}
              numberOfLines={1}
            >
              {conceptName}
            </Typography>
          ) : null}
        </View>

        {/* Spark emoji for significant jumps */}
        {isSignificant && (
          <Typography style={styles.spark}>✨</Typography>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.xl,
    zIndex: 50,
    alignItems: 'flex-end',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flexShrink: 1,
  },
  headline: {
    fontSize: 12,
    lineHeight: 16,
  },
  sub: {
    fontSize: 9,
    lineHeight: 12,
  },
  spark: {
    fontSize: 14,
  },
});
