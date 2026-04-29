// ─── ProgressBar ─────────────────────────────────────────────
// Animated horizontal fill bar using Reanimated withTiming.

import {  useEffect  } from 'react';
import { View, Text, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { radius, spacing, typography } from '../../theme/tokens';

interface ProgressBarProps {
  /** 0–1 */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  showLabel?: boolean;
  label?: string;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  height = 8,
  color,
  trackColor,
  showLabel = false,
  label,
  style,
}: ProgressBarProps) {
  const { theme } = useTheme();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <View style={[{ gap: spacing.xs }, style]}>
      {(showLabel || label) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {label && (
            <Text style={{ fontWeight: '400', fontSize: typography.xs, color: theme.textTertiary }}>
              {label}
            </Text>
          )}
          {showLabel && (
            <Text style={{ fontWeight: '600', fontSize: typography.xs, color: theme.textSecondary }}>
              {pct}%
            </Text>
          )}
        </View>
      )}
      <View
        style={{
          height,
          backgroundColor: trackColor ?? theme.border,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            animStyle,
            {
              height,
              backgroundColor: color ?? theme.primary,
              borderRadius: radius.full,
            },
          ]}
        />
      </View>
    </View>
  );
}
