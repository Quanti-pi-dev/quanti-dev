// ─── InsightCard ─────────────────────────────────────────────
// Reusable glassmorphic card for presenting text-based insights
// with gradient backgrounds and animated entrance.

import { useEffect } from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

interface InsightCardProps {
  icon: string;
  title: string;
  body: string;
  accentColor: string;
  action?: { label: string; onPress: () => void };
  delay?: number;
  style?: ViewStyle;
}

export function InsightCard({
  icon,
  title,
  body,
  accentColor,
  action,
  delay = 0,
  style,
}: InsightCardProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withSpring(0, { stiffness: 200, damping: 20 }));
    scale.value = withDelay(delay, withSpring(1, { stiffness: 300, damping: 25 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, style]}>
      <LinearGradient
        colors={[accentColor + '18', accentColor + '08', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radius['2xl'],
          borderWidth: 1,
          borderColor: accentColor + '30',
        }}
      >
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: accentColor + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="bodyLarge" style={{ fontSize: 20 }}>
                {icon}
              </Typography>
            </View>
            <Typography variant="label" color={accentColor} style={{ flex: 1 }}>
              {title}
            </Typography>
          </View>

          {/* Body */}
          <Typography variant="body" color={theme.textSecondary}>
            {body}
          </Typography>

          {/* Action button */}
          {action && (
            <TouchableOpacity
              onPress={action.onPress}
              activeOpacity={0.8}
              style={{
                backgroundColor: accentColor,
                borderRadius: 10,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                alignSelf: 'flex-start',
                marginTop: spacing.xs,
              }}
            >
              <Typography variant="label" color="#FFFFFF">
                {action.label}
              </Typography>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}
