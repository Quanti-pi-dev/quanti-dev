// ─── Input ───────────────────────────────────────────────────
// Text input with validation states: default, focused, error, success
// Supports left/right icon slots and animated border glow

import {  useState  } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { radius, spacing, typography } from '../../theme/tokens';

// ─── Types ────────────────────────────────────────────────────

type InputState = 'default' | 'focused' | 'error' | 'success';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

// ─── Component ───────────────────────────────────────────────

export function Input({
  label,
  hint,
  error,
  success,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  onFocus,
  onBlur,
  ...textInputProps
}: InputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const borderOpacity = useSharedValue(0);

  const state: InputState = error ? 'error' : success ? 'success' : isFocused ? 'focused' : 'default';

  const borderColors: Record<InputState, string> = {
    default: theme.inputBorder,
    focused: theme.inputFocus,
    error: theme.error,
    success: theme.success,
  };

  const glowColors: Record<InputState, string> = {
    default: 'transparent',
    focused: theme.primaryMuted,
    error: theme.errorMuted,
    success: theme.successMuted,
  };

  const animatedGlow = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  const handleFocus = (e: any) => {
    setIsFocused(true);
    borderOpacity.value = withTiming(1, { duration: 200 });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (!error && !success) borderOpacity.value = withTiming(0, { duration: 200 });
    onBlur?.(e);
  };

  const messageText = error || success || hint;
  const messageColor = error ? theme.error : success ? theme.success : theme.textTertiary;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label && (
        <Text
          style={{
            fontWeight: '600',
            fontSize: typography.sm,
            color: theme.textSecondary,
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
      )}

      {/* Glow ring */}
      <View style={{ position: 'relative' }}>
        <Animated.View
          style={[
            animatedGlow,
            {
              position: 'absolute',
              inset: -3,
              borderRadius: radius.lg + 3,
              backgroundColor: glowColors[state],
            },
          ]}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.inputBackground,
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderColor: borderColors[state],
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            gap: spacing.sm,
          }}
        >
          {leftIcon && <View style={{ opacity: isFocused ? 1 : 0.6 }}>{leftIcon}</View>}

          <TextInput
            {...textInputProps}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={theme.textPlaceholder}
            style={{
              flex: 1,
              fontWeight: '400',
              fontSize: typography.base,
              color: theme.text,
              padding: 0,
            }}
          />

          {rightIcon && (
            <TouchableOpacity onPress={onRightIconPress} hitSlop={8}>
              <View style={{ opacity: 0.7 }}>{rightIcon}</View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {messageText && (
        <Text
          style={{
            fontWeight: '400',
            fontSize: typography.xs,
            color: messageColor,
            marginTop: 2,
          }}
        >
          {messageText}
        </Text>
      )}
    </View>
  );
}
