// ─── Onboarding: Email Prompt ─────────────────────────────────
// Collects email from social login users who don't have one.
// Only shown when the Firebase profile lacks an email address.

import { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
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

export default function EmailPromptScreen() {
  const { theme } = useTheme();
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

  // Auto-skip if user already has a real email (not a placeholder from social login)
  useEffect(() => {
    if (user?.email && !user.email.includes('@placeholder.')) {
      router.replace('/(tabs)');
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
      router.push({ pathname: '/subscription', params: { fromOnboarding: 'true' } } as never);
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
        {/* Step indicator */}
        <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: spacing.xs }}>
          Step {currentStep} of {totalSteps}
        </Typography>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                backgroundColor: i < currentStep ? theme.primary : theme.border,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ padding: spacing.xl, gap: spacing['2xl'], flex: 1 }}>
        {/* ─── Icon ─── */}
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: radius.full,
              backgroundColor: theme.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="mail-outline" size={40} color={theme.primary} />
          </View>
        </View>

        {/* ─── Copy ─── */}
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
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
        </View>

        {/* ─── Input ─── */}
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

        {/* ─── Action ─── */}
        <View style={{ gap: spacing.sm }}>
          <Button
            fullWidth
            size="lg"
            loading={submitMutation.isPending}
            onPress={handleSubmit}
          >
            Continue
          </Button>

          <Typography
            variant="bodySmall"
            align="center"
            color={theme.textTertiary}
          >
            We'll never share your email with third parties.
          </Typography>
        </View>
      </View>
    </ScreenWrapper>
  );
}
