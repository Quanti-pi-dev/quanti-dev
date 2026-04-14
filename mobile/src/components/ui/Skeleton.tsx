// ─── Skeleton ─────────────────────────────────────────────────
// Animated shimmer placeholder for async content.
// Uses expo-linear-gradient with a sliding shine effect via Reanimated.
// Usage:
//   <Skeleton width={200} height={20} />
//   <Skeleton width="100%" height={140} borderRadius={16} />

import { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { radius as defaultRadius } from '../../theme/tokens';

interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height, borderRadius = defaultRadius.md, style }: SkeletonProps) {
  const { theme, isDark } = useTheme();

  const shimmerX = useSharedValue(-1);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      false,
    );
  }, [shimmerX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * (typeof width === 'number' ? width : 300) }],
  }));

  const baseColor = isDark ? theme.surfaceElevated : theme.cardAlt;
  const shineColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)';

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '200%' }, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', shineColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
