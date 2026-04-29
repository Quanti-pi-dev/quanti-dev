// ─── GlassAlert ──────────────────────────────────────────────
// Premium glassmorphic confirmation/alert modal.
// Replaces React Native's system Alert.alert across the entire app.
//
// Features:
//   • BlurView backdrop + frosted glass card
//   • Spring scale-in / fade-in animation
//   • Color-coded icon by alert type
//   • Configurable button set (cancel, default, destructive)
//   • Subtle top glow accent matching the alert type

import React, { useEffect } from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from './Typography';
import { radius, spacing } from '../../theme/tokens';
import type { AlertOptions, AlertType } from '../../contexts/GlobalUIContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - spacing.xl * 2, 360);

// ─── Alert visual config per type ────────────────────────────

const ALERT_CONFIG: Record<
  AlertType,
  { icon: string; accentColor: string; glowColor: string; borderColor: string }
> = {
  info: {
    icon: 'information-circle',
    accentColor: '#60A5FA',
    glowColor: 'rgba(96, 165, 250, 0.18)',
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  error: {
    icon: 'alert-circle',
    accentColor: '#F87171',
    glowColor: 'rgba(248, 113, 113, 0.18)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  warning: {
    icon: 'warning',
    accentColor: '#FBBF24',
    glowColor: 'rgba(251, 191, 36, 0.18)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  destructive: {
    icon: 'trash',
    accentColor: '#F87171',
    glowColor: 'rgba(248, 113, 113, 0.22)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
};

// ─── Button styles per button role ───────────────────────────

interface ButtonStyleDef {
  bg: string;
  text: string;
  border?: string;
}

function resolveButtonStyle(
  style: 'default' | 'cancel' | 'destructive' = 'default',
  accentColor: string,
): ButtonStyleDef {
  switch (style) {
    case 'destructive':
      return { bg: 'rgba(248, 113, 113, 0.22)', text: '#F87171', border: 'rgba(248, 113, 113, 0.4)' };
    case 'cancel':
      return { bg: 'rgba(255,255,255,0.06)', text: 'rgba(240, 237, 232, 0.6)', border: 'rgba(255,255,255,0.1)' };
    default:
      return { bg: `${accentColor}22`, text: accentColor, border: `${accentColor}55` };
  }
}

// ─── Component ───────────────────────────────────────────────

interface GlassAlertModalProps {
  visible: boolean;
  options: AlertOptions;
  onDismiss: () => void;
}

export function GlassAlertModal({ visible, options, onDismiss }: GlassAlertModalProps) {
  const { title, message, type = 'info', buttons } = options;
  const cfg = ALERT_CONFIG[type];

  // Spring animation values
  const cardScale = useSharedValue(0.88);
  const cardOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(
        type === 'destructive' || type === 'error'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
      backdropOpacity.value = withTiming(1, { duration: 240 });
      cardOpacity.value = withTiming(1, { duration: 220 });
      cardScale.value = withSpring(1, { stiffness: 300, damping: 22 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      cardOpacity.value = withTiming(0, { duration: 180 });
      cardScale.value = withTiming(0.92, { duration: 180 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  // Default buttons when none supplied
  const resolvedButtons = buttons?.length
    ? buttons
    : [{ text: 'OK', style: 'default' as const }];

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Blurred backdrop */}
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView
            intensity={28}
            tint="dark"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8, 8, 14, 0.55)' }]}
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Centered card */}
      <View style={styles.centeredContainer} pointerEvents="box-none">
        <Animated.View style={[styles.cardWrapper, cardStyle]}>
          <BlurView
            intensity={60}
            tint="dark"
            style={[
              styles.card,
              { borderColor: cfg.borderColor },
            ]}
          >
            {/* Top glow accent bar */}
            <View style={[styles.topGlow, { backgroundColor: cfg.glowColor }]} />

            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: cfg.glowColor, borderColor: cfg.borderColor }]}>
              <Ionicons name={cfg.icon as never} size={30} color={cfg.accentColor} />
            </View>

            {/* Text */}
            <Typography
              variant="h4"
              align="center"
              color="rgba(240, 237, 232, 0.96)"
              style={styles.title}
            >
              {title}
            </Typography>

            {!!message && (
              <Typography
                variant="body"
                align="center"
                color="rgba(184, 180, 174, 0.85)"
                style={styles.message}
              >
                {message}
              </Typography>
            )}

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: cfg.borderColor }]} />

            {/* Buttons */}
            <View style={[
              styles.buttonRow,
              resolvedButtons.length > 2 && styles.buttonColumn,
            ]}>
              {resolvedButtons.map((btn, idx) => {
                const btnCfg = resolveButtonStyle(btn.style, cfg.accentColor);
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      onDismiss();
                      btn.onPress?.();
                    }}
                    activeOpacity={0.75}
                    style={[
                      styles.button,
                      resolvedButtons.length === 1 && styles.buttonFullWidth,
                      {
                        backgroundColor: btnCfg.bg,
                        borderColor: btnCfg.border ?? 'transparent',
                      },
                    ]}
                  >
                    <Typography
                      variant="label"
                      color={btnCfg.text}
                    >
                      {btn.text}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    // Android elevation
    elevation: 24,
    borderRadius: radius['2xl'],
  },
  card: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: spacing.xl,
    // Deepen the glass effect with a dark overlay tint
    backgroundColor: 'rgba(16, 16, 22, 0.55)',
  },
  topGlow: {
    width: '100%',
    height: 2,
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  message: {
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    width: '100%',
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonFullWidth: {
    flex: undefined,
    width: '100%',
  },
});
