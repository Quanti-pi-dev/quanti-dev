// ─── Subject Selection Screen ────────────────────────────────
// Onboarding step 2: Select subjects/decks to study.
// Enhanced with Select All, staggered animations, subject icons,
// and animated selection states.

import { useState, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { resolveSubjectIcon } from '../../src/constants/subject-icons';
import type { IoniconName } from '../../src/constants/subject-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  LinearTransition,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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

// ─── Subject type (matches API response shape) ──────────────
interface OnboardingSubject {
  id: string;
  name: string;
  description?: string;
  iconName?: string;  // Ionicon name set by admin (e.g. 'leaf-outline')
  accent?: string;    // Hex accent colour set by admin
}

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

// ─── Animated Subject Card ───────────────────────────────────
function SubjectCard({
  subject,
  isSelected,
  onPress,
  index,
}: {
  subject: OnboardingSubject;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { stiffness: 400, damping: 20 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(200 + index * 80).duration(400).springify()}
      layout={LinearTransition.springify()}
      style={animatedStyle}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          borderRadius: radius.xl,
          borderWidth: 1.5,
          borderColor: isSelected ? theme.primary : theme.border,
          gap: spacing.md,
          overflow: 'hidden',
        }}
      >
        {/* Background */}
        {isSelected ? (
          <LinearGradient
            colors={
              isDark
                ? ['rgba(96,165,250,0.15)', 'rgba(99,102,241,0.08)']
                : ['rgba(37,99,235,0.06)', 'rgba(99,102,241,0.03)']
            }
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ) : (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.card }} />
        )}

        {/* Selection indicator with animated checkmark */}
        <Animated.View
          layout={LinearTransition.springify()}
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.full,
            borderWidth: 2,
            borderColor: isSelected ? theme.primary : theme.border,
            backgroundColor: isSelected ? theme.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            ...(isSelected ? {
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 3,
            } : {}),
          }}
        >
          {isSelected && (
            <Animated.View entering={FadeInDown.duration(200).springify()}>
              <Ionicons name="checkmark" size={17} color="#FFFFFF" />
            </Animated.View>
          )}
        </Animated.View>

        {/* Subject icon — uses admin-assigned iconName, falls back to keyword resolver */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.lg,
            backgroundColor: isSelected
              ? (subject.accent ? subject.accent + '22' : theme.primaryMuted)
              : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={(subject.iconName ?? resolveSubjectIcon(subject.name)) as IoniconName}
            size={18}
            color={isSelected ? (subject.accent ?? theme.primary) : theme.textSecondary}
          />
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Typography variant="bodySemiBold" color={theme.text} numberOfLines={1}>
            {subject.name}
          </Typography>
          {subject.description ? (
            <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>
              {subject.description}
            </Typography>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function SubjectSelectionScreen() {
  const router = useRouter();
  const { examIds, totalSteps: totalStepsParam } = useLocalSearchParams<{
    categories: string;
    examIds: string;
    totalSteps: string;
  }>();
  const { theme, isDark } = useTheme();
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

  // Computed: are all subjects selected?
  const allSelected = useMemo(
    () => subjects && subjects.length > 0 && selectedSubjects.length === subjects.length,
    [subjects, selectedSubjects],
  );

  // Check if user needs to provide their email (social login without email)
  const userHasEmail = !!(user?.email && !user.email.includes('@placeholder.'));

  const finishMutation = useMutation({
    mutationFn: async () => {
      // Save preferences but DON'T mark onboarding as completed yet
      await api.put('/users/preferences', {
        selectedExams: examIds?.split(',') ?? [],
        selectedSubjects: selectedSubjects,
      });
    },
    onSuccess: async () => {
      await refreshUser();
      // Route to exam goals screen
      router.push({
        pathname: '/(onboarding)/exam-goals',
        params: {
          examIds: examIds ?? '',
          selectedSubjects: selectedSubjects.join(','),
          totalSteps: String(totalSteps),
        },
      });
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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!userHasEmail) {
      router.push({
        pathname: '/(onboarding)/email-prompt',
        params: {
          examIds: examIds ?? '',
          selectedSubjects: selectedSubjects.join(','),
          totalSteps: String(totalSteps),
          currentStep: String(currentStep + 1),
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

  const handleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (allSelected) {
      setSelectedSubjects([]);
    } else {
      setSelectedSubjects(subjects?.map((s: any) => s.id) ?? []);
    }
  };

  return (
    <ScreenWrapper>
      <Header showBack title="Select your subjects" />

      <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
        {/* Animated step indicator */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <StepProgress currentStep={currentStep} totalSteps={totalSteps} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
            <Typography variant="body" color={theme.textSecondary}>
              {selectedSubjects.length > 0
                ? `${selectedSubjects.length} of ${subjects?.length ?? 0} selected`
                : 'Curated from your exam choices'}
            </Typography>

            {/* Select All toggle */}
            {subjects && subjects.length > 0 && (
              <TouchableOpacity
                onPress={handleSelectAll}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                  borderRadius: radius.full,
                  backgroundColor: allSelected ? theme.primaryMuted : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                  borderWidth: 1,
                  borderColor: allSelected ? theme.primary : theme.border,
                }}
              >
                <Ionicons
                  name={allSelected ? 'checkmark-done' : 'checkmark-done-outline'}
                  size={14}
                  color={allSelected ? theme.primary : theme.textTertiary}
                />
                <Typography
                  variant="caption"
                  color={allSelected ? theme.primary : theme.textTertiary}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Typography>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
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
          {subjects?.map((subject: OnboardingSubject, index: number) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              isSelected={selectedSubjects.includes(subject.id)}
              onPress={() => toggleSubject(subject.id)}
              index={index}
            />
          ))}
        </ScrollView>
      )}

      {/* Footer */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
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
          icon={
            !finishMutation.isPending ? (
              <Ionicons
                name="rocket"
                size={18}
                color={selectedSubjects.length > 0 ? theme.buttonPrimaryText : theme.buttonDisabledText}
              />
            ) : undefined
          }
          iconPosition="right"
        >
          {selectedSubjects.length === 0
            ? 'Select subjects to continue'
            : `Let's Begin`}
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
      </Animated.View>
    </ScreenWrapper>
  );
}
