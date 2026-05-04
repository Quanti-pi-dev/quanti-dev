// ─── Onboarding: Completion Screen ───────────────────────────
// Final step: A celebratory moment with confetti particles and
// stats preview before the user enters the main app.
// Auto-navigates to /(tabs) after 4 seconds. Shows user's display name.

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
// FIX B8: Use static import instead of dynamic import
import { api } from '../../src/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Confetti Particle ──────────────────────────────────────
const CONFETTI_COLORS = ['#60A5FA', '#F59E0B', '#34D399', '#F87171', '#A78BFA', '#FB923C'];

function ConfettiParticle({ delay, color, startX, startY }: { delay: number; color: string; startX: number; startY: number }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Fade in
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1800, withTiming(0, { duration: 600 })),
    ));
    // Scale up
    scale.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.back(2)) }),
      withDelay(1500, withTiming(0, { duration: 500 })),
    ));
    // Fall down
    translateY.value = withDelay(delay,
      withTiming(200 + Math.random() * 150, { duration: 2500, easing: Easing.in(Easing.quad) }),
    );
    // Drift sideways
    translateX.value = withDelay(delay,
      withTiming((Math.random() - 0.5) * 120, { duration: 2500, easing: Easing.out(Easing.ease) }),
    );
    // Spin
    rotate.value = withDelay(delay,
      withRepeat(
        withTiming(360, { duration: 1000 + Math.random() * 1000 }),
        3,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: 'absolute',
          left: startX,
          top: startY,
          width: 8,
          height: 8,
          borderRadius: Math.random() > 0.5 ? 4 : 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}

// ─── Stat Pill ──────────────────────────────────────────────
function StatPill({ icon, label, delay }: { icon: string; label: string; delay: number }) {
  const { theme, isDark } = useTheme();
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400).springify()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <Typography variant="caption">{icon}</Typography>
      <Typography variant="caption" color={theme.textSecondary}>{label}</Typography>
    </Animated.View>
  );
}

export default function OnboardingCompleteScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { user, refreshUser, preferences } = useAuth();
  const { examDate, preferredStudyTime, dailyCardTarget } =
    useLocalSearchParams<{
      examDate?: string;
      preferredStudyTime?: string;
      dailyCardTarget?: string;
    }>();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const displayName = user?.displayName?.split(' ')[0] ?? 'there';

  // Count selected exams and subjects
  const examCount = preferences?.selectedExams?.length ?? 0;
  const subjectCount = preferences?.selectedSubjects?.length ?? 0;

  // Animated checkmark scale pulse
  const checkScale = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSequence(
      withTiming(1.3, { duration: 400, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 300 }),
    );
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Generate confetti particles
  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        delay: 300 + i * 80,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#60A5FA',
        startX: (SCREEN_WIDTH * 0.1) + (Math.random() * SCREEN_WIDTH * 0.8),
        startY: SCREEN_HEIGHT * 0.15 + Math.random() * 60,
      })),
    [],
  );

  // Mark onboarding as completed + save exam goal data
  useEffect(() => {
    (async () => {
      try {
        const goalData: Record<string, unknown> = { onboardingCompleted: true };
        if (examDate) goalData.examDate = examDate;
        if (preferredStudyTime) goalData.preferredStudyTime = preferredStudyTime;
        if (dailyCardTarget) goalData.dailyCardTarget = parseInt(dailyCardTarget, 10);
        await api.put('/users/preferences', goalData);
        await refreshUser();
      } catch {
        // Non-critical — onboarding layout guard will handle on next launch
      }
    })();
  }, []);

  // FIX B9: Wrap in useCallback so auto-navigate timer uses latest reference
  const handleContinue = useCallback(() => {
    clearTimeout(timerRef.current);
    router.replace('/(tabs)' as never);
  }, [router]);

  // Auto-navigate after 4 seconds
  useEffect(() => {
    timerRef.current = setTimeout(handleContinue, 4000);
    return () => clearTimeout(timerRef.current);
  }, [handleContinue]);

  return (
    <ScreenWrapper>
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Subtle gradient background */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(52,211,153,0.06)', 'transparent', 'rgba(96,165,250,0.06)']
              : ['rgba(16,185,129,0.04)', 'transparent', 'rgba(37,99,235,0.03)']
          }
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Confetti burst */}
        {confetti.map((c) => (
          <ConfettiParticle
            key={c.id}
            delay={c.delay}
            color={c.color}
            startX={c.startX}
            startY={c.startY}
          />
        ))}

        <Animated.View
          entering={FadeIn.duration(400)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
            gap: spacing['2xl'],
          }}
        >
          {/* Animated checkmark with glow */}
          <Animated.View
            style={[
              checkStyle,
              {
                width: 120,
                height: 120,
                borderRadius: 60,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: theme.success,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 24,
                elevation: 16,
                overflow: 'hidden',
              },
            ]}
          >
            <LinearGradient
              colors={[theme.success, '#10B981', '#059669']}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="checkmark" size={64} color="#FFFFFF" />
          </Animated.View>

          {/* Success message */}
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <Animated.View entering={FadeInDown.delay(500).duration(500).springify()}>
              <Typography variant="h2" align="center">
                You're all set, {displayName}! 🎉
              </Typography>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(700).duration(400)}>
              <Typography variant="body" align="center" color={theme.textSecondary}>
                Your personalized study plan is ready. Let's start building your streak.
              </Typography>
            </Animated.View>
          </View>

          {/* Stats pills */}
          <Animated.View
            entering={FadeInDown.delay(900).duration(400)}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            {examCount > 0 && (
              <StatPill
                icon="📝"
                label={`${examCount} exam${examCount > 1 ? 's' : ''}`}
                delay={1000}
              />
            )}
            {subjectCount > 0 && (
              <StatPill
                icon="📚"
                label={`${subjectCount} subject${subjectCount > 1 ? 's' : ''}`}
                delay={1100}
              />
            )}
            <StatPill
              icon="🚀"
              label="Ready to go"
              delay={1200}
            />
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInUp.delay(1300).duration(400)} style={{ width: '100%' }}>
            <Button
              fullWidth
              size="lg"
              onPress={handleContinue}
              style={{ marginTop: spacing.md }}
              icon={<Ionicons name="arrow-forward" size={18} color={theme.buttonPrimaryText} />}
              iconPosition="right"
            >
              Start Studying
            </Button>
          </Animated.View>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}
