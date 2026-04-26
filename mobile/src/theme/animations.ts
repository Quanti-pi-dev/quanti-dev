// ─── Animation Constants ─────────────────────────────────────
// Central animation configuration for Quanti-pi.
// All interactive components import from here so that spring feel,
// timing curves, and entry animations are consistent app-wide.

import {
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useCallback, useEffect } from 'react';

// ─── Spring Presets ──────────────────────────────────────────

/** Premium tactile press feel — tight and responsive */
export const SPRING_PRESS = { stiffness: 400, damping: 22, mass: 0.8 } as const;

/** Smooth entry spring — slightly looser for a more fluid feel */
export const SPRING_ENTRY = { stiffness: 280, damping: 24, mass: 1 } as const;

/** Gentle bounce for modals and cards */
export const SPRING_BOUNCE = { stiffness: 200, damping: 16, mass: 1 } as const;

// ─── Timing Presets ──────────────────────────────────────────

/** Standard UI transition: 220ms cubic ease-out */
export const TIMING_STANDARD = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
} as const;

/** Slower reveal for cards entering the viewport */
export const TIMING_REVEAL = {
  duration: 340,
  easing: Easing.out(Easing.exp),
} as const;

/** Card flip (3D) */
export const TIMING_FLIP = {
  duration: 480,
  easing: Easing.out(Easing.cubic),
} as const;

// ─── Press Scale Values ───────────────────────────────────────

export const SCALE_PRESSED = 0.95;
export const SCALE_NORMAL = 1;

// ─── useScalePress ───────────────────────────────────────────
// Unified press-scale animation for any touchable element.
// Usage:
//   const { animStyle, handlers } = useScalePress();
//   <AnimatedTouchable style={animStyle} {...handlers} onPress={...} />

export function useScalePress(
  pressedScale = SCALE_PRESSED,
  onPressCallback?: () => void,
) {
  const scale = useSharedValue(SCALE_NORMAL);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressedScale, SPRING_PRESS);
  }, [scale, pressedScale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(SCALE_NORMAL, SPRING_PRESS);
  }, [scale]);

  const handlePress = useCallback(() => {
    onPressCallback?.();
  }, [onPressCallback]);

  return {
    animStyle,
    handlers: {
      onPressIn: handlePressIn,
      onPressOut: handlePressOut,
      ...(onPressCallback ? { onPress: handlePress } : {}),
    },
  };
}

// ─── useFadeInUp ─────────────────────────────────────────────
// Staggerable fade-in-up entry animation for list items.
// Usage:
//   const { animStyle } = useFadeInUp({ delay: index * 60 });
//   <Animated.View style={animStyle}>...</Animated.View>

export function useFadeInUp({ delay = 0 }: { delay?: number } = {}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  // Trigger on mount only — not on every re-render (FIX H2)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, TIMING_REVEAL));
    translateY.value = withDelay(delay, withSpring(0, SPRING_ENTRY));

  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return { animStyle };
}

// ─── useGlowPulse ────────────────────────────────────────────
// Glow pulse sequence for flashcard result feedback.

export function useGlowPulse() {
  const glowOpacity = useSharedValue(0);

  const pulse = useCallback(() => {
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 260 }),
      withTiming(0.6, { duration: 160 }),
      withTiming(1, { duration: 160 }),
      withTiming(0, { duration: 360 }),
    );
  }, [glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return { glowStyle, pulse };
}

// Re-export Reanimated helpers so consumers don't need to import twice
export {
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Easing,
  runOnJS,
};
