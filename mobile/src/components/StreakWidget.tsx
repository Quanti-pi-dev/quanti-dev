// ─── StreakWidget ─────────────────────────────────────────────
// Flame icon + streak day count. Animated shake on mount.
// Audit fix: replaced raw Text with Typography component.

import { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/tokens';
import { Typography } from './ui/Typography';

interface StreakWidgetProps {
  streak: number;
  freezes?: number;
  animate?: boolean;
  style?: ViewStyle;
}

export function StreakWidget({ streak, freezes, animate = false, style }: StreakWidgetProps) {
  const { theme } = useTheme();
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (animate && streak > 0) {
      rotate.value = withSequence(
        withTiming(-12, { duration: 80 }),
        withTiming(12, { duration: 80 }),
        withTiming(-8, { duration: 70 }),
        withTiming(8, { duration: 70 }),
        withTiming(0, { duration: 60 }),
      );
      scale.value = withSequence(
        withSpring(1.2, { stiffness: 400, damping: 10 }),
        withSpring(1, { stiffness: 300, damping: 15 }),
      );
    }
  }, [animate, streak]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }, { scale: scale.value }],
  }));

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.coinLight,
          borderRadius: radius.xl,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Animated.Text style={[animStyle, { fontSize: 22 }]}>🔥</Animated.Text>
      <View>
        <Typography variant="h4" color={theme.coin}>
          {streak}
        </Typography>
        <Typography variant="caption" color={theme.textTertiary}>
          day streak
        </Typography>
      </View>

      {/* Freeze shield dots: ●●○ = 2/3 */}
      {freezes != null && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 3,
          marginLeft: spacing.sm,
          paddingLeft: spacing.sm,
          borderLeftWidth: 1,
          borderLeftColor: theme.border,
        }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: i < freezes ? theme.primary : theme.border,
              }}
            />
          ))}
          <Typography variant="caption" color={theme.textTertiary} style={{ marginLeft: 2, fontSize: 9 }}>
            🛡
          </Typography>
        </View>
      )}
    </View>
  );
}
