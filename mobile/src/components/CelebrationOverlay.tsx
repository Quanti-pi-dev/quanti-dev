// ─── Celebration Cascade Overlay ─────────────────────────────
// Plays the multi-step celebration sequences returned by the API.
// Each step type maps to a distinct animation: confetti burst, coin
// rain, badge reveal, level-up banner, etc.
//
// Psychology: Variable Reward + Positive Reinforcement.
//   The cascade model means users never know exactly how big their
//   next win will be — creating genuine anticipation on every session.
//
// Usage:
//   <CelebrationOverlay />
//   — mount once at the root layout. It self-fetches and auto-plays.
//   Acknowledge button + auto-dismiss after totalDurationMs.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import {
  fetchPendingCelebration,
  acknowledgeCelebration,
  type CelebrationSequence,
  type CelebrationStep,
} from '../services/behavioral-contracts';

// ─── Step Renderers ───────────────────────────────────────────

/** Confetti particle (simple coloured circle) */
function ConfettiParticle({ color, delay, startX }: { color: string; delay: number; startX: number }) {
  const y = useSharedValue(0);
  const x = useSharedValue(startX);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 100 }));
    y.value = withDelay(delay, withTiming(700, { duration: 1400 }));
    x.value = withDelay(delay, withTiming(startX + (Math.random() - 0.5) * 120, { duration: 1400 }));
    rotate.value = withDelay(delay, withRepeat(withTiming(360, { duration: 600 }), 3, false));
    // Fade out near the end
    setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400 });
    }, delay + 1100);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { translateX: x.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          top: -10,
          width: 10,
          height: 10,
          borderRadius: 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}

const CONFETTI_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function ConfettiStep() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    key: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    delay: Math.random() * 400,
    startX: (Math.random() - 0.5) * 300,
  }));

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.key} color={p.color} delay={p.delay} startX={p.startX} />
      ))}
    </View>
  );
}

/** Coin drop animation */
function CoinDropStep({ coins }: { coins: number }) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);

  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 200, damping: 12 });
    opacity.value = withTiming(1, { duration: 250 });
    translateY.value = withSpring(0, { stiffness: 160, damping: 14 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, { alignItems: 'center', gap: spacing.sm }]}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: theme.coinLight,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: theme.coin,
        }}
      >
        <Ionicons name="logo-bitcoin" size={36} color={theme.coin} />
      </View>
      <Typography variant="h2" color={theme.coin} style={{ fontWeight: '800' }}>
        +{coins}
      </Typography>
      <Typography variant="body" color={theme.textSecondary}>
        Coins earned!
      </Typography>
    </Animated.View>
  );
}

/** Badge reveal */
function BadgeRevealStep({ icon, label }: { icon: string; label: string }) {
  const { theme } = useTheme();
  const scale = useSharedValue(0);
  const rotate = useSharedValue(-15);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.2, { stiffness: 280, damping: 10 }),
      withSpring(1, { stiffness: 200, damping: 16 }),
    );
    rotate.value = withSpring(0, { stiffness: 200, damping: 14 });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, { alignItems: 'center', gap: spacing.sm }]}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: theme.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: theme.primary,
        }}
      >
        <Ionicons name={(icon as never) || 'ribbon-outline'} size={44} color={theme.primary} />
      </View>
      <Typography variant="h4" color={theme.text}>
        Badge Unlocked!
      </Typography>
      <Typography variant="label" color={theme.primary}>
        {label}
      </Typography>
    </Animated.View>
  );
}

/** Level up banner */
function LevelUpStep({ level }: { level: string }) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 250, damping: 12 });
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, { alignItems: 'center', gap: spacing.md }]}>
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: '#1D4ED8',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="arrow-up-circle" size={52} color="#60A5FA" />
      </View>
      <Typography variant="h3" style={{ fontWeight: '800' }}>
        Level Up! 🎉
      </Typography>
      <Typography variant="h4" color={theme.primary}>
        {level}
      </Typography>
      <Typography variant="body" color={theme.textSecondary} align="center">
        Your knowledge is growing — keep going!
      </Typography>
    </Animated.View>
  );
}

/** Generic streak milestone */
function StreakStep({ streak }: { streak: number }) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 220, damping: 11 });
    opacity.value = withTiming(1, { duration: 250 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, { alignItems: 'center', gap: spacing.sm }]}>
      <Typography style={{ fontSize: 72 }}>🔥</Typography>
      <Typography variant="h2" style={{ fontWeight: '800', color: '#EF4444' }}>
        {streak} Days
      </Typography>
      <Typography variant="h4" color={theme.text}>
        Streak Milestone!
      </Typography>
      <Typography variant="body" color={theme.textSecondary} align="center">
        Your consistency is building real mastery.
      </Typography>
    </Animated.View>
  );
}

/** Slide-in stat card (used for perfect session, legendary drop, etc.) */
function StatCardStep({ stat, label, message }: { stat: string; label: string; message: string }) {
  const { theme } = useTheme();
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { stiffness: 200, damping: 16 });
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, { alignItems: 'center', gap: spacing.md }]}>
      <Typography
        style={{ fontSize: 72, fontWeight: '900', color: theme.primary }}
      >
        {stat}
      </Typography>
      <Typography variant="overline" color={theme.textSecondary}>
        {label.toUpperCase()}
      </Typography>
      <Typography variant="body" color={theme.textSecondary} align="center">
        {message}
      </Typography>
    </Animated.View>
  );
}

/** Social share prompt card */
function SocialCardStep({ message }: { message: string }) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 180, damping: 14 });
    opacity.value = withTiming(1, { duration: 280 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, { alignItems: 'center', gap: spacing.md }]}>
      <Typography style={{ fontSize: 52 }}>🎉</Typography>
      <Typography variant="h4" color={theme.text} align="center">
        Share the win!
      </Typography>
      <Typography variant="body" color={theme.textSecondary} align="center">
        {message}
      </Typography>
    </Animated.View>
  );
}

// ─── Step Renderer ────────────────────────────────────────────

function renderStep(step: CelebrationStep) {
  switch (step.type) {
    case 'confetti':
      return <ConfettiStep />;
    case 'coin_drop':
    case 'coin_shower':    // backend alias — normalised by API layer but handled here too
      return <CoinDropStep coins={(step.payload['coins'] as number) ?? (step.payload['coinCount'] as number) ?? 0} />;
    case 'badge_reveal':
      return (
        <BadgeRevealStep
          icon={(step.payload['icon'] as string) ?? (step.payload['badgeIcon'] as string) ?? 'ribbon-outline'}
          label={(step.payload['label'] as string) ?? (step.payload['badgeName'] as string) ?? 'Achievement'}
        />
      );
    case 'level_up':
      return <LevelUpStep level={(step.payload['level'] as string) ?? (step.payload['levelName'] as string) ?? 'Proficient'} />;
    case 'streak_milestone':
    case 'streak_fire':    // backend alias — normalised by API layer but handled here too
      return <StreakStep streak={(step.payload['streak'] as number) ?? (step.payload['streakDays'] as number) ?? 7} />;
    case 'pact_complete':
      return (
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Typography style={{ fontSize: 60 }}>🤝</Typography>
          <Typography variant="h4">Pact Complete!</Typography>
        </View>
      );
    case 'stat_card':
      return (
        <StatCardStep
          stat={(step.payload['stat'] as string) ?? ''}
          label={(step.payload['label'] as string) ?? ''}
          message={(step.payload['message'] as string) ?? ''}
        />
      );
    case 'social_card':
      return (
        <SocialCardStep
          message={(step.payload['message'] as string) ?? 'Share this achievement!'}
        />
      );
    case 'sound_effect':
      // Audio-only step — no visual; the overlay stays open for durationMs
      // then advances. Native sound playback is a future enhancement.
      return null;
    default:
      return null;
  }
}

// ─── Main Component ───────────────────────────────────────────

export function CelebrationOverlay() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [sequence, setSequence] = useState<CelebrationSequence | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal background opacity — declared unconditionally (Rules of Hooks)
  const bgOpacity = useSharedValue(0);

  const { data } = useQuery({
    queryKey: ['pending-celebration'],
    queryFn: fetchPendingCelebration,
    refetchInterval: 30_000,       // poll — no WebSocket yet
    staleTime: 10_000,
  });

  useEffect(() => {
    if (data && data.steps.length > 0) {
      setSequence(data);
      setStepIndex(0);
      setVisible(true);
    }
  }, [data]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    setSequence(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await acknowledgeCelebration();
      await queryClient.invalidateQueries({ queryKey: ['pending-celebration'] });
    } catch {
      // non-critical
    }
  }, [queryClient]);

  // Advance steps automatically
  useEffect(() => {
    if (!visible || !sequence) return;
    const step = sequence.steps[stepIndex];
    if (!step) {
      timerRef.current = setTimeout(() => void dismiss(), 400);
      return;
    }
    timerRef.current = setTimeout(() => {
      const nextIndex = stepIndex + 1;
      if (nextIndex < sequence.steps.length) {
        setStepIndex(nextIndex);
      } else {
        void dismiss();
      }
    }, step.durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, sequence, stepIndex, dismiss]);

  // Reset background opacity each time the overlay becomes visible
  useEffect(() => {
    if (visible) {
      bgOpacity.value = withTiming(1, { duration: 250 });
    } else {
      bgOpacity.value = 0;
    }
  }, [visible, bgOpacity]);
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  if (!visible || !sequence) return null;

  const currentStep = sequence.steps[stepIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => void dismiss()}
    >
      <Animated.View
        style={[
          bgStyle,
          {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.72)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
          },
        ]}
      >
        {/* Confetti renders full-screen behind the card */}
        {currentStep?.type === 'confetti' && <ConfettiStep />}

        {/* Card */}
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: radius['2xl'],
            padding: spacing['2xl'],
            alignItems: 'center',
            gap: spacing.xl,
            width: '100%',
            maxWidth: 340,
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24 },
              android: { elevation: 12 },
            }),
          }}
        >
          {currentStep && renderStep(currentStep)}

          {/* Step dots */}
          {sequence.steps.length > 1 && (
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {sequence.steps.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === stepIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === stepIndex ? theme.primary : theme.border,
                  }}
                />
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={() => void dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close celebration"
            style={{
              backgroundColor: theme.primary,
              borderRadius: radius.full,
              paddingHorizontal: spacing['2xl'],
              paddingVertical: spacing.md,
            }}
          >
            <Typography variant="label" color="#FFFFFF">
              {stepIndex < sequence.steps.length - 1 ? 'Next ›' : 'Awesome!'}
            </Typography>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}
