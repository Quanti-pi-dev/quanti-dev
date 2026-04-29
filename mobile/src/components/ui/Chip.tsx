// ─── Chip ────────────────────────────────────────────────────
// Selectable filter chip with active/inactive states and animated toggle.


import { Text, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { radius, spacing, typography } from '../../theme/tokens';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function Chip({ label, active = false, onPress, style }: ChipProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => (scale.value = withSpring(0.94, { stiffness: 400, damping: 20 }));
  const handlePressOut = () => (scale.value = withSpring(1, { stiffness: 400, damping: 20 }));

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress?.();
  };

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={[
        animStyle,
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: active ? theme.primary : theme.cardAlt,
          borderWidth: 1.5,
          borderColor: active ? theme.primary : theme.border,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontWeight: '500',
          fontSize: typography.sm,
          color: active ? theme.buttonPrimaryText : theme.textSecondary,
        }}
      >
        {label}
      </Text>
    </AnimatedTouchable>
  );
}
