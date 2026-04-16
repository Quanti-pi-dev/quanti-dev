// ─── ConfettiBurst ───────────────────────────────────────────
// Lightweight confetti animation using Reanimated. Renders ~20
// animated circles that fall from the top with randomized positions,
// colors, rotation, and timing. No external libraries required.
//
// Usage:
//   {isPerfect && <ConfettiBurst />}

import React, { useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

const PARTICLE_COUNT = 22;
const COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];

interface Particle {
  id: number;
  x: number;       // horizontal position (0-1 fraction of screen width)
  size: number;     // 6-14px
  color: string;
  delay: number;    // stagger delay (ms)
  duration: number; // fall duration (ms)
  rotate: number;   // degrees
}

function ConfettiParticle({ particle, screenHeight }: { particle: Particle; screenHeight: number }) {
  const translateY = useSharedValue(-40);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withTiming(screenHeight + 40, {
        duration: particle.duration,
        easing: Easing.in(Easing.quad),
      }),
    );
    rotate.value = withDelay(
      particle.delay,
      withTiming(particle.rotate, { duration: particle.duration }),
    );
    opacity.value = withDelay(
      particle.delay + particle.duration * 0.7,
      withTiming(0, { duration: particle.duration * 0.3 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: 'absolute',
          left: `${particle.x * 100}%`,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.color,
        },
      ]}
    />
  );
}

export function ConfettiBurst() {
  const { height } = useWindowDimensions();

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random(),
      size: 6 + Math.random() * 8,
      color: COLORS[i % COLORS.length] ?? '#6366F1',
      delay: Math.random() * 400,
      duration: 1200 + Math.random() * 800,
      rotate: (Math.random() - 0.5) * 720,
    }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} particle={p} screenHeight={height} />
      ))}
    </View>
  );
}
