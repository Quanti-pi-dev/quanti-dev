// ─── Onboarding: Exam Goals ─────────────────────────────────
// Step 3: Set exam date & preferred study time.
// This single screen unlocks countdown widgets, adaptive pacing,
// and notification scheduling across the entire app.

import { useState, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';

// ─── Step Progress (shared across onboarding) ────────────────
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

// ─── Month Picker Wheel ─────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthYear { month: number; year: number }

function MonthYearPicker({
  selected,
  onSelect,
}: {
  selected: MonthYear;
  onSelect: (v: MonthYear) => void;
}) {
  const { theme, isDark } = useTheme();
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Year selector */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {years.map(year => {
          const isActive = selected.year === year;
          return (
            <TouchableOpacity
              key={year}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect({ ...selected, year });
              }}
              style={{
                flex: 1,
                paddingVertical: spacing.sm + 2,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: isActive ? theme.primary : theme.border,
                backgroundColor: isActive
                  ? (isDark ? 'rgba(96,165,250,0.15)' : 'rgba(37,99,235,0.08)')
                  : theme.card,
                alignItems: 'center',
              }}
            >
              <Typography
                variant="bodySemiBold"
                color={isActive ? theme.primary : theme.textSecondary}
              >
                {year}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Month grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {MONTHS.map((month, idx) => {
          const isActive = selected.month === idx && selected.year === selected.year;
          const isPast = selected.year === currentYear && idx < now.getMonth();
          return (
            <TouchableOpacity
              key={month}
              disabled={isPast}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect({ ...selected, month: idx });
              }}
              style={{
                width: '31%',
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: isActive ? theme.primary : 'transparent',
                backgroundColor: isActive
                  ? (isDark ? 'rgba(96,165,250,0.15)' : 'rgba(37,99,235,0.08)')
                  : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
                alignItems: 'center',
                opacity: isPast ? 0.35 : 1,
              }}
            >
              <Typography
                variant="caption"
                color={isActive ? theme.primary : isPast ? theme.textTertiary : theme.text}
              >
                {month.slice(0, 3)}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Study Time Pill ────────────────────────────────────────
const STUDY_TIMES = [
  { key: 'morning' as const,   emoji: '🌅', label: 'Morning',   sub: '6 AM – 12 PM' },
  { key: 'afternoon' as const, emoji: '☀️', label: 'Afternoon', sub: '12 PM – 6 PM' },
  { key: 'evening' as const,   emoji: '🌙', label: 'Evening',   sub: '6 PM – 12 AM' },
];

function StudyTimePicker({
  selected,
  onSelect,
}: {
  selected: 'morning' | 'afternoon' | 'evening' | null;
  onSelect: (v: 'morning' | 'afternoon' | 'evening') => void;
}) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  return (
    <View style={{ gap: spacing.sm }}>
      {STUDY_TIMES.map((time, idx) => {
        const isActive = selected === time.key;
        return (
          <Animated.View
            key={time.key}
            entering={FadeInUp.delay(200 + idx * 80).duration(400).springify()}
            layout={LinearTransition.springify()}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(time.key);
              }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                borderRadius: radius.xl,
                borderWidth: 1.5,
                borderColor: isActive ? theme.primary : theme.border,
                backgroundColor: isActive
                  ? (isDark ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.06)')
                  : theme.card,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  backgroundColor: isActive
                    ? theme.primaryMuted
                    : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body">{time.emoji}</Typography>
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="bodySemiBold" color={isActive ? theme.primary : theme.text}>
                  {time.label}
                </Typography>
                <Typography variant="caption" color={theme.textTertiary}>
                  {time.sub}
                </Typography>
              </View>
              {isActive && (
                <Animated.View entering={FadeInDown.duration(200).springify()}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: radius.full,
                      backgroundColor: theme.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  </View>
                </Animated.View>
              )}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────

export default function ExamGoalsScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { examIds, selectedSubjects, totalSteps: totalStepsParam } =
    useLocalSearchParams<{
      examIds: string;
      selectedSubjects: string;
      totalSteps: string;
    }>();

  const totalSteps = parseInt(totalStepsParam ?? '4', 10);
  const currentStep = 3;

  const now = new Date();
  const [monthYear, setMonthYear] = useState<MonthYear>({
    month: now.getMonth() + 3 > 11 ? (now.getMonth() + 3) % 12 : now.getMonth() + 3,
    year: now.getMonth() + 3 > 11 ? now.getFullYear() + 1 : now.getFullYear(),
  });
  const [studyTime, setStudyTime] = useState<'morning' | 'afternoon' | 'evening' | null>(null);

  // Compute days remaining and daily target
  const examDate = useMemo(() => {
    // Use the 1st of the selected month as the exam date
    const d = new Date(monthYear.year, monthYear.month, 1);
    return d.toISOString().split('T')[0]!;
  }, [monthYear]);

  const daysRemaining = useMemo(() => {
    const exam = new Date(monthYear.year, monthYear.month, 1);
    const diff = Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 1);
  }, [monthYear]);

  // Rough target: assume ~500 total cards across subjects, spread over remaining days
  const dailyTarget = useMemo(() => {
    const subjectCount = selectedSubjects?.split(',').filter(Boolean).length ?? 3;
    const totalCards = subjectCount * 120; // 4 levels × 30 cards
    return Math.max(5, Math.min(Math.ceil(totalCards / daysRemaining), 100));
  }, [daysRemaining, selectedSubjects]);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(onboarding)/complete',
      params: {
        examIds: examIds ?? '',
        selectedSubjects: selectedSubjects ?? '',
        examDate,
        preferredStudyTime: studyTime ?? '',
        dailyCardTarget: String(dailyTarget),
        totalSteps: String(totalSteps),
      },
    });
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(onboarding)/complete',
      params: {
        examIds: examIds ?? '',
        selectedSubjects: selectedSubjects ?? '',
        totalSteps: String(totalSteps),
      },
    });
  };

  return (
    <ScreenWrapper>
      <Header showBack title="Set your goal" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          gap: spacing['2xl'],
          paddingBottom: spacing['4xl'],
        }}
      >
        {/* Step indicator */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <StepProgress currentStep={currentStep} totalSteps={totalSteps} />
        </Animated.View>

        {/* Headline */}
        <Animated.View entering={FadeInDown.delay(100).duration(400).springify()}>
          <Typography variant="h2">
            When is your exam?
          </Typography>
          <Typography variant="body" color={theme.textSecondary} style={{ marginTop: spacing.xs }}>
            We'll build a personalized study plan that gets you ready on time
          </Typography>
        </Animated.View>

        {/* Month/Year Picker */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <MonthYearPicker selected={monthYear} onSelect={setMonthYear} />
        </Animated.View>

        {/* Daily target preview */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View
            style={{
              borderRadius: radius.xl,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
            }}
          >
            <LinearGradient
              colors={isDark
                ? ['rgba(99,102,241,0.12)', 'rgba(96,165,250,0.08)']
                : ['rgba(99,102,241,0.06)', 'rgba(96,165,250,0.04)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: spacing.lg, gap: spacing.sm }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <Typography variant="bodySemiBold" color={theme.primary}>
                  {daysRemaining} days until exam
                </Typography>
              </View>
              <Typography variant="body" color={theme.text}>
                📚 Your daily target: <Typography variant="bodySemiBold" color={theme.primary}>~{dailyTarget} cards/day</Typography>
              </Typography>
              <Typography variant="caption" color={theme.textTertiary}>
                This covers all your subjects with time for revision
              </Typography>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Study time preference */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Typography variant="h3" style={{ marginBottom: spacing.sm }}>
            Best time to study?
          </Typography>
          <Typography variant="body" color={theme.textSecondary} style={{ marginBottom: spacing.md }}>
            We'll send smart reminders at your preferred time
          </Typography>
          <StudyTimePicker selected={studyTime} onSelect={setStudyTime} />
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)}>
          <Button
            fullWidth
            size="lg"
            onPress={handleContinue}
            icon={<Ionicons name="arrow-forward" size={18} color={theme.buttonPrimaryText} />}
            iconPosition="right"
          >
            Set My Goal
          </Button>
          <Button
            fullWidth
            variant="ghost"
            size="sm"
            onPress={handleSkip}
            style={{ marginTop: spacing.xs }}
          >
            Skip for now
          </Button>
        </Animated.View>
      </ScrollView>
    </ScreenWrapper>
  );
}
