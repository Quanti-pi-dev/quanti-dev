// ─── Onboarding: Welcome Screen ──────────────────────────────
// Step 0: A premium, animated welcome that greets the user by name
// and builds anticipation. Auto-advances after 3.5s; tap to skip.

import { useEffect, useRef, useMemo } from 'react';
import { View, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_SOURCE = require('../../assets/adaptive-icon.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Floating Particle ──────────────────────────────────────
function FloatingParticle({ delay, size, x, y }: { delay: number; size: number; x: number; y: number }) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-40, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.primary,
        },
      ]}
    />
  );
}

export default function OnboardingWelcomeScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const displayName = user?.displayName?.split(' ')[0] ?? 'there';

  // Pulsing glow ring around logo
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  // Generate particle positions deterministically
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        delay: i * 400,
        size: 4 + (i % 3) * 2,
        x: SCREEN_WIDTH * 0.15 + (i * SCREEN_WIDTH * 0.1) % (SCREEN_WIDTH * 0.7),
        y: 120 + (i * 50) % 200,
      })),
    [],
  );

  const handleAdvance = () => {
    clearTimeout(timerRef.current);
    router.replace('/(onboarding)/' as never);
  };

  // Auto-advance after 3.5 seconds — enough to read and feel welcomed
  useEffect(() => {
    timerRef.current = setTimeout(handleAdvance, 3500);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <ScreenWrapper>
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Subtle gradient background */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(96,165,250,0.08)', 'transparent', 'rgba(99,102,241,0.06)']
              : ['rgba(37,99,235,0.04)', 'transparent', 'rgba(99,102,241,0.03)']
          }
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Floating particles */}
        {particles.map((p) => (
          <FloatingParticle key={p.id} delay={p.delay} size={p.size} x={p.x} y={p.y} />
        ))}

        <Animated.View
          entering={FadeIn.duration(500)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
            gap: spacing['2xl'],
          }}
        >
          {/* Logo with pulsing glow ring */}
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={[
                glowStyle,
                {
                  position: 'absolute',
                  width: 160,
                  height: 160,
                  borderRadius: 36,
                  borderWidth: 2,
                  borderColor: theme.primary,
                  backgroundColor: 'transparent',
                },
              ]}
            />
            <Animated.View
              entering={FadeIn.delay(200).duration(600)}
              style={{
                width: 130,
                height: 130,
                borderRadius: 30,
                overflow: 'hidden',
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 12,
              }}
            >
              <Image
                source={LOGO_SOURCE}
                style={{ width: '100%', height: '100%', borderRadius: 30 }}
                resizeMode="cover"
              />
            </Animated.View>
          </View>

          {/* Staggered greeting text */}
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <Animated.View entering={FadeInDown.delay(300).duration(500).springify()}>
              <Typography variant="h2" align="center">
                Welcome, {displayName} 👋
              </Typography>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(600).duration(500).springify()}>
              <Typography variant="body" align="center" color={theme.textSecondary}>
                Let's set up your personalised study plan in under a minute.
              </Typography>
            </Animated.View>
          </View>

          {/* Animated feature pills */}
          <Animated.View
            entering={FadeInDown.delay(900).duration(400)}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            {['📚 Smart Flashcards', '📊 Track Progress', '🏆 Earn Rewards'].map((pill, i) => (
              <Animated.View
                key={pill}
                entering={FadeInDown.delay(1000 + i * 150).duration(400)}
                style={{
                  backgroundColor: theme.primaryMuted,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.xs + 2,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(96,165,250,0.2)' : 'rgba(37,99,235,0.1)',
                }}
              >
                <Typography variant="caption" color={theme.primary}>
                  {pill}
                </Typography>
              </Animated.View>
            ))}
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInDown.delay(1400).duration(400)} style={{ width: '100%' }}>
            <Button
              fullWidth
              size="lg"
              onPress={handleAdvance}
              style={{ marginTop: spacing.md }}
            >
              Let's Go →
            </Button>
          </Animated.View>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}
