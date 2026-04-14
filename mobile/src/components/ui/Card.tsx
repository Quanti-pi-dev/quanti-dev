// ─── Card ────────────────────────────────────────────────────
// Neumorphic soft-shadow card container.
// Variants: elevated (neumorphic shadow), outlined (border), flat (no decoration)


import {
  View,
  TouchableOpacity,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { radius, spacing, shadows } from '../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────

type CardVariant = 'elevated' | 'outlined' | 'flat';

interface CardProps {
  variant?: CardVariant;
  pressable?: boolean;
  onPress?: () => void;
  padding?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Component ───────────────────────────────────────────────

export function Card({
  variant = 'elevated',
  pressable = false,
  onPress,
  padding = spacing.base,
  style,
  children,
}: CardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => pressable && (scale.value = withSpring(0.975, { stiffness: 400, damping: 20 }));
  const handlePressOut = () => pressable && (scale.value = withSpring(1, { stiffness: 400, damping: 20 }));
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const cardStyle: ViewStyle = {
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding,
    ...(variant === 'elevated' && {
      ...shadows.md,
      shadowColor: theme.shadow,
    }),
    ...(variant === 'outlined' && {
      borderWidth: 1.5,
      borderColor: theme.border,
    }),
  };

  if (pressable) {
    return (
      <AnimatedTouchable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[animStyle, cardStyle, style]}
      >
        {children}
      </AnimatedTouchable>
    );
  }

  return (
    <Animated.View style={[cardStyle, style]}>
      {children}
    </Animated.View>
  );
}
