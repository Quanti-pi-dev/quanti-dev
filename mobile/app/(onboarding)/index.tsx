// ─── Onboarding: Exam Selection ──────────────────────────────
// Step 1: Pick exams to personalize the study experience.
// Enhanced with staggered animations, animated progress, and premium card design.

import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  LinearTransition,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Ionicons } from '@expo/vector-icons';


interface Exam { id: string; title: string; category: string; }

// ─── Exam Category Icons ─────────────────────────────────────
const EXAM_ICONS: Record<string, string> = {
  quantitative: '🧮',
  verbal: '🔤',
  data: '📊',
  reasoning: '🧠',
  general: '📚',
};

function getExamIcon(category: string): string {
  return EXAM_ICONS[category.toLowerCase()] ?? '📝';
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
                style={{
                  flex: 1,
                  borderRadius: 2,
                }}
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

// ─── Animated Exam Card ──────────────────────────────────────
function ExamCard({
  exam,
  isSelected,
  onPress,
  index,
}: {
  exam: Exam;
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
    scale.value = withSpring(0.95, { stiffness: 400, damping: 20 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(200 + index * 100).duration(400).springify()}
      layout={LinearTransition.springify()}
      style={[animatedStyle, { width: '47%' }]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={{
          aspectRatio: 1.1,
          borderRadius: radius['2xl'],
          borderWidth: 2,
          borderColor: isSelected ? theme.primary : theme.border,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.md,
          gap: spacing.sm,
          overflow: 'hidden',
        }}
      >
        {/* Background gradient for selected state */}
        {isSelected && (
          <LinearGradient
            colors={
              isDark
                ? ['rgba(96,165,250,0.18)', 'rgba(99,102,241,0.12)']
                : ['rgba(37,99,235,0.08)', 'rgba(99,102,241,0.05)']
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
        )}
        {!isSelected && (
          <View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: theme.card,
            }}
          />
        )}

        {/* Checkmark badge */}
        {isSelected && (
          <Animated.View
            entering={FadeInDown.duration(200).springify()}
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              width: 24,
              height: 24,
              borderRadius: radius.full,
              backgroundColor: theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <Ionicons name="checkmark" size={15} color="#FFFFFF" />
          </Animated.View>
        )}

        {/* Emoji icon */}
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: isSelected ? theme.primaryMuted : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="h2" align="center">
            {getExamIcon(exam.category)}
          </Typography>
        </View>

        {/* Title */}
        <Typography
          variant="label"
          align="center"
          color={isSelected ? theme.primary : theme.text}
        >
          {exam.title}
        </Typography>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function OnboardingExamSelectionScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Exam[]>([]);

  // Determine total steps — if user lacks email, there's an extra email-prompt step
  const userHasEmail = !!(user?.email && !user.email.includes('@placeholder.'));
  const totalSteps = userHasEmail ? 3 : 4;

  const { data: exams, isLoading } = useQuery<Exam[]>({
    queryKey: ['onboarding-exams'],
    queryFn: async () => {
      const res = await api.get('/exams?pageSize=50');
      return res.data.data;
    },
  });

  const toggle = (exam: Exam) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) =>
      prev.find((e) => e.id === exam.id)
        ? prev.filter((e) => e.id !== exam.id)
        : [...prev, exam]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const categories = selected.map((e) => e.category).join(',');
    const examIds = selected.map((e) => e.id).join(',');
    router.push({
      pathname: '/(onboarding)/subjects',
      params: { categories, examIds, totalSteps: String(totalSteps) },
    });
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={{ padding: spacing.xl, paddingBottom: spacing.md }}>
          <Skeleton height={32} width={200} borderRadius={radius.md} />
          <Skeleton height={16} width={260} borderRadius={radius.sm} style={{ marginTop: spacing.sm }} />
        </View>
        <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton
              key={i}
              height={130}
              borderRadius={radius['2xl']}
              style={{ width: '47%' }}
            />
          ))}
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={{ padding: spacing.xl, paddingBottom: spacing.md }}>
        {/* Animated step indicator */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <StepProgress currentStep={1} totalSteps={totalSteps} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400).springify()}>
          <Typography variant="h2" style={{ marginTop: spacing.lg }}>
            What are you{'\n'}studying for?
          </Typography>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Typography variant="body" color={theme.textSecondary} style={{ marginTop: spacing.sm }}>
            Pick your target exam — we'll customize everything for you
          </Typography>
        </Animated.View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing['4xl'],
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.md,
        }}
      >
        {exams?.map((exam, index) => (
          <ExamCard
            key={exam.id}
            exam={exam}
            isSelected={!!selected.find((e) => e.id === exam.id)}
            onPress={() => toggle(exam)}
            index={index}
          />
        ))}
      </ScrollView>

      {/* Footer with animated button */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        style={{
          padding: spacing.xl,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}
      >
        <Button
          fullWidth
          size="lg"
          disabled={selected.length === 0}
          onPress={handleContinue}
          icon={<Ionicons name="arrow-forward" size={18} color={selected.length > 0 ? theme.buttonPrimaryText : theme.buttonDisabledText} />}
          iconPosition="right"
        >
          {selected.length === 0
            ? 'Select an exam to continue'
            : `Continue with ${selected.length} exam${selected.length > 1 ? 's' : ''}`}
        </Button>
      </Animated.View>
    </ScreenWrapper>
  );
}
