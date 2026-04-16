// ─── Onboarding: Completion Screen ───────────────────────────
// Final step: A brief celebratory moment before the user enters the main app.
// Auto-navigates to /(tabs) after 3 seconds. Shows user's display name.

import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';
import { spacing } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';

export default function OnboardingCompleteScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const displayName = user?.displayName?.split(' ')[0] ?? 'there';

  // Animated checkmark scale pulse
  const checkScale = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSequence(
      withTiming(1.2, { duration: 400 }),
      withTiming(1, { duration: 200 }),
    );
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Mark onboarding as completed
  useEffect(() => {
    (async () => {
      try {
        const { api } = await import('../../src/services/api');
        await api.put('/users/preferences', { onboardingCompleted: true });
        await refreshUser();
      } catch {
        // Non-critical — onboarding layout guard will handle on next launch
      }
    })();
  }, []);

  const handleContinue = () => {
    clearTimeout(timerRef.current);
    router.replace('/(tabs)' as never);
  };

  // Auto-navigate after 3 seconds
  useEffect(() => {
    timerRef.current = setTimeout(handleContinue, 3000);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <ScreenWrapper>
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
        {/* Animated checkmark */}
        <Animated.View
          style={[
            checkStyle,
            {
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Ionicons name="checkmark" size={64} color="#FFFFFF" />
        </Animated.View>

        {/* Success message */}
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <Typography variant="h2" align="center">
            You're all set, {displayName}! 🎉
          </Typography>
          <Typography variant="body" align="center" color={theme.textSecondary}>
            Your personalized study plan is ready. Let's start building your streak.
          </Typography>
        </View>

        {/* CTA */}
        <Button
          fullWidth
          size="lg"
          onPress={handleContinue}
          style={{ marginTop: spacing.lg }}
        >
          Let's Go!
        </Button>
      </Animated.View>
    </ScreenWrapper>
  );
}
