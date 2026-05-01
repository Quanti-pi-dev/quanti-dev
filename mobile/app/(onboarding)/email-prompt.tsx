// ─── Onboarding: Email Prompt ─────────────────────────────────
// Collects email from social login users who don't have one.
// Only shown when the Firebase profile lacks an email address.
// Enhanced with better visual hierarchy and animations.

import { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { isValidEmail } from '../../src/utils/validation';

// ─── Animated Step Progress Bar ─────────────────────────────
function StepProgress({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Typography variant="caption" color={theme.textTertiary}>
        Step {currentStep} of {totalSteps}
      </Typography>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.border,
              overflow: 'hidden',
            }}
          >
            {i < currentStep && (
              <Animated.View
                entering={FadeInDown.delay(i * 100).duration(400)}
                style={{ flex: 1, borderRadius: 2 }}
              >
                <LinearGradient
                  colors={[theme.primary, '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, borderRadius: 2 }}
                />
              </Animated.View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function EmailPromptScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { examIds, selectedSubjects, totalSteps: totalStepsParam, currentStep: currentStepParam } =
    useLocalSearchParams<{
      examIds: string;
      selectedSubjects: string;
      totalSteps: string;
      currentStep: string;
    }>();

  // Dynamic step count
  const totalSteps = parseInt(totalStepsParam ?? '4', 10);
  const currentStep = parseInt(currentStepParam ?? '3', 10);

  // Auto-skip if user already has a real email (not a placeholder from social login).
  // FIX B3: Route through the subscription prompt, not directly to /(tabs),
  // to preserve the full onboarding flow.
  useEffect(() => {
    if (user?.email && !user.email.includes('@placeholder.')) {
      router.replace({ pathname: '/subscription', params: { fromOnboarding: 'true' } });
    }
  }, [user, router]);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      // 1. Update the user's email via Firebase-synced endpoint
      await api.put('/auth/update-email', { email });

      // 2. Save preferences without marking onboarding as completed —
      // the completion screen will do that after the subscription prompt
      await api.put('/users/preferences', {
        selectedExams: examIds?.split(',').filter(Boolean) ?? [],
        selectedSubjects: selectedSubjects?.split(',').filter(Boolean) ?? [],
      });
    },
    onSuccess: async () => {
      await refreshUser();
      // Route to subscription prompt with onboarding context
      router.push({ pathname: '/subscription', params: { fromOnboarding: 'true' } });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not save your email. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    submitMutation.mutate();
  };

  return (
    <ScreenWrapper keyboardAvoiding>
      <Header showBack title="One more step" />

      <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
        {/* Animated step indicator */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <StepProgress currentStep={currentStep} totalSteps={totalSteps} />
        </Animated.View>
      </View>

      <View style={{ padding: spacing.xl, gap: spacing['2xl'], flex: 1 }}>
        {/* ─── Animated Icon ─── */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500).springify()}
          style={{ alignItems: 'center', marginTop: spacing.lg }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(96,165,250,0.2)', 'rgba(99,102,241,0.15)']
                  : ['rgba(37,99,235,0.1)', 'rgba(99,102,241,0.08)']
              }
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
            <Ionicons name="mail-outline" size={42} color={theme.primary} />
          </View>
        </Animated.View>

        {/* ─── Copy ─── */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(400)}
          style={{ gap: spacing.sm, alignItems: 'center' }}
        >
          <Typography variant="h3" align="center">
            One more thing!
          </Typography>
          <Typography
            variant="body"
            align="center"
            color={theme.textSecondary}
          >
            We need your email for important updates like payment receipts,
            study reminders, and password recovery.
          </Typography>
        </Animated.View>

        {/* ─── Input ─── */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <Input
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={
              <Ionicons name="mail-outline" size={18} color={theme.textTertiary} />
            }
            error={error}
          />
        </Animated.View>

        {/* ─── Action ─── */}
        <Animated.View entering={FadeInUp.delay(800).duration(400)} style={{ gap: spacing.sm }}>
          <Button
            fullWidth
            size="lg"
            loading={submitMutation.isPending}
            onPress={handleSubmit}
            icon={
              !submitMutation.isPending ? (
                <Ionicons name="arrow-forward" size={18} color={theme.buttonPrimaryText} />
              ) : undefined
            }
            iconPosition="right"
          >
            Continue
          </Button>

          <Typography
            variant="bodySmall"
            align="center"
            color={theme.textTertiary}
          >
            🔒 We'll never share your email with third parties.
          </Typography>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}
