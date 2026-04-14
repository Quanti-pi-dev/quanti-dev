// ─── Onboarding: Welcome Screen ──────────────────────────────
// Step 0: A professional, precise welcome that names the user and sets
// expectations. Auto-advances after 2.0s; user can tap "Let's Go" to skip.

import { useEffect, useRef } from 'react';
import { View, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';

export default function OnboardingWelcomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const displayName = user?.displayName?.split(' ')[0] ?? 'there';

  const handleAdvance = () => {
    clearTimeout(timerRef.current);
    router.replace('/(onboarding)/' as never);
  };

  // Auto-advance after 2 seconds
  useEffect(() => {
    timerRef.current = setTimeout(handleAdvance, 2000);
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
        {/* Logo */}
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            overflow: 'hidden',
          }}
        >
          <Image
            source={require('../../assets/adaptive-icon.png')}
            style={{ width: '100%', height: '100%', borderRadius: 28 }}
            resizeMode="cover"
          />
        </View>

        {/* Greeting */}
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <Typography variant="h2" align="center">
            Welcome, {displayName}.
          </Typography>
          <Typography variant="body" align="center" color={theme.textSecondary}>
            Your personalised study programme is ready to be configured.
          </Typography>
        </View>

        {/* CTA */}
        <Button
          fullWidth
          size="lg"
          onPress={handleAdvance}
          style={{ marginTop: spacing.xl }}
        >
          Let's Go →
        </Button>
      </Animated.View>
    </ScreenWrapper>
  );
}
