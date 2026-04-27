// ─── GlassToast ──────────────────────────────────────────────
// Premium glassmorphic toast notification.
// Slides in from the top with a spring bounce; auto-dismisses after 3.5s.
// Uses expo-blur for the frosted glass background.

import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from './Typography';
import { radius, spacing } from '../../theme/tokens';
import type { ToastItem, ToastType } from '../../contexts/GlobalUIContext';

// ─── Config ──────────────────────────────────────────────────

const TOAST_DURATION = 3500;

const TOAST_CONFIG: Record<
  ToastType,
  { icon: string; accentColor: string; borderColor: string }
> = {
  success: {
    icon: 'checkmark-circle',
    accentColor: '#34D399',
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  error: {
    icon: 'alert-circle',
    accentColor: '#F87171',
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  info: {
    icon: 'information-circle',
    accentColor: '#60A5FA',
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  warning: {
    icon: 'warning',
    accentColor: '#FBBF24',
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
};

// ─── Single Toast ─────────────────────────────────────────────

interface GlassToastProps {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}

export function GlassToast({ toast, onDismiss }: GlassToastProps) {
  const cfg = TOAST_CONFIG[toast.type];

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-16);
  const scale = useSharedValue(0.96);

  const dismiss = () => onDismiss(toast.id);

  const animateOut = () => {
    opacity.value = withTiming(0, { duration: 280 });
    translateY.value = withTiming(-16, { duration: 280 });
    scale.value = withTiming(0.96, { duration: 280 }, (finished) => {
      if (finished) runOnJS(dismiss)();
    });
  };

  useEffect(() => {
    // Animate in with spring bounce
    opacity.value = withTiming(1, { duration: 220 });
    translateY.value = withSpring(0, { stiffness: 320, damping: 22 });
    scale.value = withSpring(1, { stiffness: 320, damping: 22 });

    const timer = setTimeout(animateOut, TOAST_DURATION);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.toast, animatedStyle]}>
      <BlurView
        intensity={55}
        tint="dark"
        style={[styles.blurContainer, { borderColor: cfg.borderColor }]}
      >
        {/* Subtle inner glow strip */}
        <View style={[styles.accentStrip, { backgroundColor: cfg.accentColor }]} />

        <View style={styles.iconWrapper}>
          <Ionicons name={cfg.icon as never} size={20} color={cfg.accentColor} />
        </View>

        <Typography
          variant="label"
          color="rgba(240, 237, 232, 0.95)"
          style={styles.message}
          numberOfLines={2}
        >
          {toast.message}
        </Typography>

        <TouchableOpacity
          onPress={animateOut}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={15} color="rgba(240, 237, 232, 0.55)" />
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
  );
}

// ─── Toast Stack ──────────────────────────────────────────────

interface GlassToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function GlassToastStack({ toasts, onDismiss }: GlassToastStackProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.stack, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <GlassToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
    zIndex: 9999,
  },
  toast: {
    borderRadius: radius['2xl'],
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    // Android elevation
    elevation: 12,
    overflow: 'visible',
  },
  blurContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    // Extra dark overlay to deepen the glass
    backgroundColor: 'rgba(20, 20, 28, 0.5)',
  },
  accentStrip: {
    width: 3,
    alignSelf: 'stretch',
    opacity: 0.85,
  },
  iconWrapper: {
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.md,
  },
  message: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  closeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
