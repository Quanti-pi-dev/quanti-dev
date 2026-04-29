// ─── Button ──────────────────────────────────────────────────
// Variants: primary, secondary, ghost, danger
// Sizes: sm, md, lg
// Features: animated press feedback, loading spinner, optional icon


import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { radius, spacing, typography } from '../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  children: string;
}

// ─── Size Maps ───────────────────────────────────────────────

const sizeStyles: Record<Size, { paddingVertical: number; paddingHorizontal: number; fontSize: number; borderRadius: number }> = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: typography.sm, borderRadius: radius.md },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontSize: typography.base, borderRadius: radius.lg },
  lg: { paddingVertical: spacing.base, paddingHorizontal: spacing.xl, fontSize: typography.md, borderRadius: radius.xl },
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Component ───────────────────────────────────────────────

export function Button({
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  children,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { stiffness: 400, damping: 20 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  // Resolve colors by variant
  const variantMap: Record<Variant, { bg: string; text: string; border?: string }> = {
    primary: { bg: theme.buttonPrimary, text: theme.buttonPrimaryText },
    secondary: { bg: theme.buttonSecondary, text: theme.buttonSecondaryText, border: theme.border },
    ghost: { bg: 'transparent', text: theme.buttonGhostText },
    danger: { bg: theme.error, text: theme.buttonPrimaryText },
  };

  const colors = disabled ? { bg: theme.buttonDisabled, text: theme.buttonDisabledText } : variantMap[variant];
  const sz = sizeStyles[size];

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        animatedStyle,
        {
          backgroundColor: colors.bg,
          borderRadius: sz.borderRadius,
          paddingVertical: sz.paddingVertical,
          paddingHorizontal: sz.paddingHorizontal,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          borderWidth: colors.border ? 1.5 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.6 : 1,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text
            style={{
              fontWeight: '600',
              fontSize: sz.fontSize,
              color: colors.text,
              letterSpacing: 0.2,
            }}
          >
            {children}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </AnimatedTouchable>
  );
}
