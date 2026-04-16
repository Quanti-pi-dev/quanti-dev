// ─── PurchaseSuccessSheet ─────────────────────────────────────
// Animated bottom sheet shown after a successful shop purchase.
// Scale-in + confetti particle burst. Auto-dismisses or tap to close.

import { useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  FadeIn,
  FadeOut,
  SlideInDown,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { spacing } from '../theme/tokens';
import { Typography } from './ui/Typography';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W } = Dimensions.get('window');
const PARTICLE_COUNT = 12;
const PARTICLE_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'];

interface PurchaseSuccessSheetProps {
  visible: boolean;
  icon?: string;          // Emoji like ✅ 🛡️ 💎
  title: string;          // "Unlocked!" or "Coins Added!"
  subtitle?: string;      // Item name or coin count
  coinsSpent?: number;
  newBalance?: number;
  onDismiss: () => void;
}

function ConfettiParticle({ index }: { index: number }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
    const distance = 60 + Math.random() * 80;
    translateX.value = withSpring(Math.cos(angle) * distance, { stiffness: 200, damping: 15 });
    translateY.value = withSpring(Math.sin(angle) * distance - 30, { stiffness: 200, damping: 15 });
    rotate.value = withTiming(360 + Math.random() * 180, { duration: 800 });
    opacity.value = withDelay(600, withTiming(0, { duration: 400 }));
  }, [index]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[style, {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 2,
        backgroundColor: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
      }]}
    />
  );
}

export function PurchaseSuccessSheet({
  visible,
  icon = '✅',
  title,
  subtitle,
  coinsSpent,
  newBalance,
  onDismiss,
}: PurchaseSuccessSheetProps) {
  const { theme } = useTheme();
  const iconScale = useSharedValue(0.3);

  useEffect(() => {
    if (visible) {
      iconScale.value = withSpring(1, { stiffness: 300, damping: 12 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto-dismiss after 3s
      const timer = setTimeout(() => onDismiss(), 3000);
      return () => clearTimeout(timer);
    } else {
      iconScale.value = 0.3;
    }
  }, [visible]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', zIndex: 999 }]}
    >
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleDismiss}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
      />

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.springify().stiffness(300).damping(22)}
        style={{
          backgroundColor: theme.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: spacing.xl,
          paddingBottom: spacing['4xl'],
          alignItems: 'center',
          gap: spacing.lg,
        }}
      >
        {/* Confetti burst */}
        <View style={{ position: 'absolute', top: 80, left: SCREEN_W / 2 - 20 }}>
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </View>

        {/* Animated icon */}
        <Animated.View style={[iconAnimStyle, {
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: theme.primary + '18',
          alignItems: 'center', justifyContent: 'center',
        }]}>
          <Typography variant="h1" style={{ fontSize: 40 }}>{icon}</Typography>
        </Animated.View>

        {/* Title */}
        <Typography variant="h3" align="center">{title}</Typography>

        {/* Subtitle */}
        {subtitle && (
          <Typography variant="body" color={theme.textSecondary} align="center">
            {subtitle}
          </Typography>
        )}

        {/* Stats row */}
        {(coinsSpent != null || newBalance != null) && (
          <View style={{
            flexDirection: 'row', gap: spacing.xl,
            backgroundColor: theme.cardAlt, borderRadius: 14,
            padding: spacing.md,
          }}>
            {coinsSpent != null && (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Typography variant="caption" color={theme.textTertiary}>Spent</Typography>
                <Typography variant="label" color={theme.error}>-{coinsSpent} 🪙</Typography>
              </View>
            )}
            {newBalance != null && (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Typography variant="caption" color={theme.textTertiary}>Balance</Typography>
                <Typography variant="label" color={theme.coin ?? theme.primary}>{newBalance} 🪙</Typography>
              </View>
            )}
          </View>
        )}

        {/* Dismiss hint */}
        <Typography variant="caption" color={theme.textTertiary}>
          Tap anywhere to dismiss
        </Typography>
      </Animated.View>
    </Animated.View>
  );
}
