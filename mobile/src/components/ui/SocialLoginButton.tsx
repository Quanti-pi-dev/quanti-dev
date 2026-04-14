// ─── Social Login Button ─────────────────────────────────────
// Renders a provider-branded OAuth button.
// Supports two variants:
//   - 'full' (default): Full-width button with icon + text label
//   - 'icon': Compact 48×48 circular icon-only button
// Dumb component — calls onPress(provider) and manages its own loading state.

import { TouchableOpacity, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { spacing, typography, radius } from '../../theme/tokens';

// ─── Types ───────────────────────────────────────────────────

export type SocialProvider = 'google' | 'github' | 'microsoft' | 'facebook' | 'linkedin';

interface SocialLoginButtonProps {
  provider: SocialProvider;
  onPress: (provider: SocialProvider) => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'full' | 'icon';
}

// ─── Provider Config ─────────────────────────────────────────

const PROVIDER_CONFIG: Record<
  SocialProvider,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; bg: string; text: string; border: string }
> = {
  google: {
    label: 'Continue with Google',
    icon: 'logo-google',
    bg: '#FFFFFF',
    text: '#3C4043',
    border: '#DADCE0',
  },
  github: {
    label: 'Continue with GitHub',
    icon: 'logo-github',
    bg: '#24292F',
    text: '#FFFFFF',
    border: '#24292F',
  },
  microsoft: {
    label: 'Continue with Microsoft',
    icon: 'logo-windows',
    bg: '#FFFFFF',
    text: '#3C4043',
    border: '#8C8C8C',
  },
  facebook: {
    label: 'Continue with Facebook',
    icon: 'logo-facebook',
    bg: '#1877F2',
    text: '#FFFFFF',
    border: '#1877F2',
  },
  linkedin: {
    label: 'Continue with LinkedIn',
    icon: 'logo-linkedin',
    bg: '#0A66C2',
    text: '#FFFFFF',
    border: '#0A66C2',
  },
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Component ───────────────────────────────────────────────

export function SocialLoginButton({ provider, onPress, loading = false, disabled = false, variant = 'full' }: SocialLoginButtonProps) {
  const cfg = PROVIDER_CONFIG[provider];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { stiffness: 400, damping: 20 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(provider);
  };

  // ─── Icon-only variant ───────────────────────────────
  if (variant === 'icon') {
    return (
      <AnimatedTouchable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled || loading}
        style={[
          animatedStyle,
          {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: cfg.bg,
            borderWidth: 1.5,
            borderColor: cfg.border,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={cfg.text} />
        ) : (
          <Ionicons name={cfg.icon} size={22} color={cfg.text} />
        )}
      </AnimatedTouchable>
    );
  }

  // ─── Full-width variant (default) ────────────────────
  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={disabled || loading}
      style={[
        animatedStyle,
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: cfg.bg,
          borderRadius: radius.xl,
          borderWidth: 1.5,
          borderColor: cfg.border,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={cfg.text} />
      ) : (
        <>
          <Ionicons name={cfg.icon} size={20} color={cfg.text} />
          <Text
            style={{
              fontFamily: typography.bodySemiBold,
              fontSize: typography.sm,
              color: cfg.text,
              letterSpacing: 0.1,
            }}
          >
            {cfg.label}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}
