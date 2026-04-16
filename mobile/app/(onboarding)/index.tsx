// ─── Onboarding: Exam Selection ──────────────────────────────
// Pick exams to personalize the study experience.

import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
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
        {/* Step indicator */}
        <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: spacing.xs }}>
          Step 1 of {totalSteps}
        </Typography>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                backgroundColor: i === 0 ? theme.primary : theme.border,
              }}
            />
          ))}
        </View>
        <Typography variant="h2">What are you{'\n'}studying for?</Typography>
        <Typography variant="body" color={theme.textSecondary} style={{ marginTop: spacing.sm }}>
          Select exams to personalize your experience
        </Typography>
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
        {exams?.map((exam) => {
          const isSelected = !!selected.find((e) => e.id === exam.id);
          return (
            <TouchableOpacity
              key={exam.id}
              onPress={() => toggle(exam)}
              activeOpacity={0.8}
              style={{
                width: '47%',
                aspectRatio: 1.1,
                backgroundColor: isSelected ? theme.primaryMuted : theme.card,
                borderRadius: radius['2xl'],
                borderWidth: 2,
                borderColor: isSelected ? theme.primary : theme.border,
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              {isSelected && (
                <View style={{
                  position: 'absolute', top: spacing.sm, right: spacing.sm,
                  width: 22, height: 22, borderRadius: radius.full,
                  backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
              )}
              <Typography variant="h3" align="center">
                {getExamIcon(exam.category)}
              </Typography>
              <Typography variant="label" align="center" color={isSelected ? theme.primary : theme.text}>
                {exam.title}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ padding: spacing.xl, borderTopWidth: 1, borderTopColor: theme.border }}>
        <Button
          fullWidth
          size="lg"
          disabled={selected.length === 0}
          onPress={handleContinue}
        >
          {`Continue (${selected.length} selected)`}
        </Button>
      </View>
    </ScreenWrapper>
  );
}
