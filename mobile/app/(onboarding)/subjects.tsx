// ─── Subject Selection Screen ────────────────────────────────
// Onboarding step 2: Select subjects/decks to study.
// Rewritten to use ScreenWrapper, Header, Typography, Button from
// the design system (FIX B4 + P4).

import { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Skeleton } from '../../src/components/ui/Skeleton';

export default function SubjectSelectionScreen() {
  const router = useRouter();
  const { examIds, totalSteps: totalStepsParam } = useLocalSearchParams<{
    categories: string;
    examIds: string;
    totalSteps: string;
  }>();
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const { refreshUser, user } = useAuth();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Dynamic step count passed from exam selection screen
  const totalSteps = parseInt(totalStepsParam ?? '3', 10);
  const currentStep = 2; // This is step 2 (0-indexed: 1)

  const examIdArray = examIds?.split(',') ?? [];

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['onboarding-subjects', examIds],
    queryFn: async () => {
      if (!examIds) return [];
      const requests = examIdArray.map(id => api.get(`/exams/${id}/subjects`));
      const responses = await Promise.all(requests);
      
      const subjectMap = new Map();
      for (const res of responses) {
        if (res.data?.success && res.data.data) {
          for (const subject of res.data.data) {
            subjectMap.set(subject.id, subject);
          }
        }
      }
      return Array.from(subjectMap.values());
    },
    enabled: examIdArray.length > 0,
  });

  // Check if user needs to provide their email (social login without email)
  const userHasEmail = !!(user?.email && !user.email.includes('@placeholder.'));

  const finishMutation = useMutation({
    mutationFn: async () => {
      // Save preferences but DON'T mark onboarding as completed yet —
      // the completion screen will do that after the subscription prompt
      await api.put('/users/preferences', {
        selectedExams: examIds?.split(',') ?? [],
        selectedSubjects: selectedSubjects,
      });
    },
    onSuccess: async () => {
      await refreshUser();
      // Route to subscription prompt with onboarding context
      router.push({ pathname: '/subscription', params: { fromOnboarding: 'true' } });
    },
    onError: () => {
      showAlert({
        title: 'Setup Failed',
        message: 'Could not save your preferences. Would you like to skip for now?',
        type: 'info',
        buttons: [
          { text: 'Try Again', style: 'cancel' },
          {
            text: 'Skip for Now',
            onPress: () => void handleSkipOnboarding(),
          },
        ],
      });
    },
  });

  // Escape hatch: skip onboarding entirely (FIX 4.1)
  const handleSkipOnboarding = async () => {
    try {
      await api.put('/users/preferences', { onboardingCompleted: true });
      await refreshUser();
      router.replace('/(tabs)' as never);
    } catch {
      showToast('Please check your connection and restart the app.', 'error');
    }
  };

  const handleFinish = () => {
    if (selectedSubjects.length === 0) return;

    if (!userHasEmail) {
      router.push({
        pathname: '/(onboarding)/email-prompt',
        params: {
          examIds: examIds ?? '',
          selectedSubjects: selectedSubjects.join(','),
          totalSteps: String(totalSteps),
          currentStep: String(currentStep + 1), // email-prompt is the next step
        },
      });
      return;
    }

    finishMutation.mutate();
  };

  const toggleSubject = (deckId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSubjects(prev =>
      prev.includes(deckId) ? prev.filter(id => id !== deckId) : [...prev, deckId],
    );
  };

  return (
    <ScreenWrapper>
      <Header showBack title="Select your subjects" />

      <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
        {/* Step indicator */}
        <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: spacing.xs }}>
          Step {currentStep} of {totalSteps}
        </Typography>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
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
        <Typography variant="body" color={theme.textSecondary}>
          Curated from your exam choices. We'll start testing your baseline.
        </Typography>
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, flex: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={72} borderRadius={radius.xl} />
          ))}
        </View>
      ) : !subjects || subjects.length === 0 ? (
        /* ─── Empty state (P1.4) ─── */
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.lg }}>
          <Ionicons name="book-outline" size={52} color={theme.textTertiary} />
          <Typography variant="h3" align="center">No subjects found</Typography>
          <Typography variant="body" align="center" color={theme.textSecondary}>
            We couldn't find subjects for your selected exams. You can skip for now and explore all content.
          </Typography>
          <Button fullWidth size="lg" onPress={handleSkipOnboarding}>
            Continue to App
          </Button>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing['4xl'] }}
          showsVerticalScrollIndicator={false}
        >
          {subjects?.map((subject: any) => {
            const selected = selectedSubjects.includes(subject.id);
            return (
              <TouchableOpacity
                key={subject.id}
                onPress={() => toggleSubject(subject.id)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: selected ? theme.primaryMuted : theme.card,
                  padding: spacing.lg,
                  borderRadius: radius.xl,
                  borderWidth: 1.5,
                  borderColor: selected ? theme.primary : theme.border,
                  gap: spacing.md,
                }}
              >
                {/* Selection indicator */}
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.full,
                    borderWidth: 2,
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected && (
                    <Ionicons name="checkmark" size={16} color={theme.buttonPrimaryText} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Typography variant="label">{subject.name}</Typography>
                  {subject.description ? (
                    <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>
                      {subject.description}
                    </Typography>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Footer */}
      <View
        style={{
          padding: spacing.xl,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          gap: spacing.sm,
        }}
      >
        <Button
          fullWidth
          size="lg"
          disabled={selectedSubjects.length === 0 || finishMutation.isPending}
          loading={finishMutation.isPending}
          onPress={handleFinish}
        >
          Start Learning
        </Button>

        <Button
          fullWidth
          variant="ghost"
          size="sm"
          disabled={finishMutation.isPending}
          onPress={handleSkipOnboarding}
        >
          Skip for now
        </Button>
      </View>
    </ScreenWrapper>
  );
}
