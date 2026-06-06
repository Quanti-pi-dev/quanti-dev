// ─── Onboarding: Study Personality Quiz ──────────────────────
// Replaces exam-goals with an engaging 4-question personality quiz.
// Captures the same data (study time, exam proximity) plus new
// personality dimensions (session style, motivation type).
// Outputs a "Study Profile Type" label like "Night Owl Sprinter 🦉⚡"
//
// Psychology: IKEA Effect — students who invest effort in defining
// their study identity are more committed to the outcome.

import { useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Quiz Data ──────────────────────────────────────────────

interface QuizOption {
  key: string;
  emoji: string;
  label: string;
  sub: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  subtitle: string;
  options: QuizOption[];
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'studyTime',
    question: 'When do you feel sharpest?',
    subtitle: "We'll send reminders at your peak time",
    options: [
      { key: 'morning',   emoji: '🌅', label: 'Morning bird',  sub: 'Best before noon' },
      { key: 'afternoon', emoji: '☀️', label: 'Afternoon focus', sub: 'Peak after lunch' },
      { key: 'evening',   emoji: '🌙', label: 'Night owl',      sub: 'Alive after dark' },
    ],
  },
  {
    id: 'sessionStyle',
    question: 'How do you like to learn?',
    subtitle: "We'll adapt session lengths to your style",
    options: [
      { key: 'quick', emoji: '⚡', label: 'Quick bursts',   sub: '5-10 min sessions' },
      { key: 'deep',  emoji: '📚', label: 'Deep sessions',  sub: '20-30 min focused' },
      { key: 'mixed', emoji: '🔄', label: 'Mix it up',      sub: 'Variety keeps me going' },
    ],
  },
  {
    id: 'motivation',
    question: 'What motivates you most?',
    subtitle: "We'll tailor your experience around this",
    options: [
      { key: 'competing', emoji: '🏆', label: 'Competing',     sub: 'Leaderboards & battles' },
      { key: 'progress',  emoji: '📈', label: 'Seeing progress', sub: 'Stats & mastery growth' },
      { key: 'goals',     emoji: '🎯', label: 'Daily goals',    sub: 'Streaks & targets' },
    ],
  },
  {
    id: 'examTimeline',
    question: 'How far is your exam?',
    subtitle: "We'll pace your daily cards accordingly",
    options: [
      { key: 'urgent',  emoji: '🔥', label: 'Under 1 month',  sub: 'Crunch mode!' },
      { key: 'medium',  emoji: '📅', label: '1-3 months',     sub: 'Good pacing' },
      { key: 'relaxed', emoji: '🌊', label: 'Just exploring', sub: 'No rush, learning for fun' },
    ],
  },
];

// ─── Personality Archetypes ─────────────────────────────────

interface StudyArchetype {
  label: string;
  emoji: string;
  description: string;
  gradient: [string, string];
}

function computeArchetype(answers: Record<string, string>): StudyArchetype {
  const time = answers['studyTime'] ?? 'morning';
  const style = answers['sessionStyle'] ?? 'mixed';
  const motivation = answers['motivation'] ?? 'progress';

  // Time component
  const timeLabel = time === 'morning' ? 'Morning' : time === 'afternoon' ? 'Afternoon' : 'Night Owl';
  const timeEmoji = time === 'morning' ? '🌅' : time === 'afternoon' ? '☀️' : '🦉';

  // Style component
  const styleLabel = style === 'quick' ? 'Sprinter' : style === 'deep' ? 'Deep Diver' : 'Explorer';
  const styleEmoji = style === 'quick' ? '⚡' : style === 'deep' ? '🤿' : '🧭';

  // Motivation influences gradient color
  const gradients: Record<string, [string, string]> = {
    competing: ['#EF4444', '#F97316'],
    progress:  ['#6366F1', '#8B5CF6'],
    goals:     ['#10B981', '#14B8A6'],
  };

  return {
    label: `${timeLabel} ${styleLabel}`,
    emoji: `${timeEmoji}${styleEmoji}`,
    description: motivation === 'competing'
      ? "You thrive on competition — we'll keep the leaderboards front and center."
      : motivation === 'progress'
        ? "You love watching mastery grow — your stats dashboard will be your best friend."
        : "You're goal-driven — daily streaks and targets will keep you locked in.",
    gradient: gradients[motivation] ?? ['#6366F1', '#8B5CF6'],
  };
}

// Map quiz answers to exam date + daily target
function computeGoals(answers: Record<string, string>, subjectCount: number) {
  const timeline = answers['examTimeline'] ?? 'medium';
  const now = new Date();

  let daysUntilExam: number;
  switch (timeline) {
    case 'urgent':  daysUntilExam = 25; break;
    case 'medium':  daysUntilExam = 75; break;
    case 'relaxed': daysUntilExam = 180; break;
    default:        daysUntilExam = 75;
  }

  const examDate = new Date(now.getTime() + daysUntilExam * 86400000);
  const examDateStr = examDate.toISOString().split('T')[0]!;
  const totalCards = Math.max(subjectCount, 3) * 120;
  const dailyTarget = Math.max(5, Math.min(Math.ceil(totalCards / daysUntilExam), 100));

  return { examDate: examDateStr, dailyTarget, daysUntilExam };
}

// ─── Quiz Option Card ───────────────────────────────────────

function OptionCard({
  option,
  isSelected,
  onPress,
  index,
}: {
  option: QuizOption;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(200 + index * 100).duration(400).springify()}
      style={[animStyle]}
    >
      <TouchableOpacity
        onPress={() => {
          scale.value = withSequence(
            withTiming(0.95, { duration: 80 }),
            withSpring(1, { stiffness: 400, damping: 15 }),
          );
          onPress();
        }}
        activeOpacity={1}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          borderRadius: radius.xl,
          borderWidth: 2,
          borderColor: isSelected ? theme.primary : theme.border,
          backgroundColor: isSelected
            ? (isDark ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.06)')
            : theme.card,
          gap: spacing.md,
        }}
      >
        {/* Emoji circle */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.full,
            backgroundColor: isSelected
              ? theme.primaryMuted
              : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography style={{ fontSize: 22 }}>{option.emoji}</Typography>
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Typography variant="bodySemiBold" color={isSelected ? theme.primary : theme.text}>
            {option.label}
          </Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            {option.sub}
          </Typography>
        </View>

        {/* Checkmark */}
        {isSelected && (
          <Animated.View entering={FadeIn.duration(200)}>
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
}

// ─── Profile Reveal Card ────────────────────────────────────

function ProfileReveal({
  archetype,
  onContinue,
}: {
  archetype: StudyArchetype;
  onContinue: () => void;
}) {
  const { theme, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing['2xl'],
      }}
    >
      {/* Archetype badge */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(500).springify()}
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: archetype.gradient[0],
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 24,
          elevation: 16,
        }}
      >
        <LinearGradient
          colors={archetype.gradient}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Typography style={{ fontSize: 48 }}>{archetype.emoji}</Typography>
      </Animated.View>

      {/* Title */}
      <View style={{ gap: spacing.sm, alignItems: 'center' }}>
        <Animated.View entering={FadeInDown.delay(500).duration(500).springify()}>
          <Typography variant="h2" align="center">
            You're a
          </Typography>
          <Typography variant="h1" align="center" color={archetype.gradient[0]} style={{ fontSize: 28 }}>
            {archetype.label}
          </Typography>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(800).duration(400)}>
          <Typography variant="body" align="center" color={theme.textSecondary} style={{ maxWidth: 280 }}>
            {archetype.description}
          </Typography>
        </Animated.View>
      </View>

      {/* CTA */}
      <Animated.View entering={FadeInUp.delay(1200).duration(400)} style={{ width: '100%' }}>
        <Button
          fullWidth
          size="lg"
          onPress={onContinue}
          icon={<Ionicons name="arrow-forward" size={18} color={theme.buttonPrimaryText} />}
          iconPosition="right"
        >
          Continue
        </Button>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Progress Dots ──────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === current ? theme.primary : theme.border,
          }}
          layout={undefined}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────

export default function StudyPersonalityScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { examIds, selectedSubjects, totalSteps: totalStepsParam } =
    useLocalSearchParams<{
      examIds: string;
      selectedSubjects: string;
      totalSteps: string;
    }>();

  const totalSteps = parseInt(totalStepsParam ?? '4', 10);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showReveal, setShowReveal] = useState(false);

  const currentQuestion = QUIZ_QUESTIONS[questionIndex]!;
  const selectedAnswer = answers[currentQuestion.id];
  const isLastQuestion = questionIndex === QUIZ_QUESTIONS.length - 1;

  const subjectCount = (selectedSubjects?.split(',').filter(Boolean).length) ?? 3;

  const archetype = useMemo(() => computeArchetype(answers), [answers]);
  const goals = useMemo(() => computeGoals(answers, subjectCount), [answers, subjectCount]);

  const handleSelect = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: key }));
  }, [currentQuestion.id]);

  const handleNext = useCallback(() => {
    if (!selectedAnswer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isLastQuestion) {
      // Show personality reveal
      setShowReveal(true);
    } else {
      setQuestionIndex(prev => prev + 1);
    }
  }, [selectedAnswer, isLastQuestion]);

  const handleBack = useCallback(() => {
    if (questionIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuestionIndex(prev => prev - 1);
    }
  }, [questionIndex]);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(onboarding)/mini-session',
      params: {
        examIds: examIds ?? '',
        selectedSubjects: selectedSubjects ?? '',
        examDate: goals.examDate,
        preferredStudyTime: answers['studyTime'] ?? '',
        dailyCardTarget: String(goals.dailyTarget),
        totalSteps: String(totalSteps),
        // Phase 3: New personality fields
        studyPersonality: archetype.label,
        motivationType: answers['motivation'] ?? '',
        sessionPreference: answers['sessionStyle'] ?? '',
      },
    });
  }, [router, examIds, selectedSubjects, goals, answers, archetype, totalSteps]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(onboarding)/mini-session',
      params: {
        examIds: examIds ?? '',
        selectedSubjects: selectedSubjects ?? '',
        totalSteps: String(totalSteps),
      },
    });
  }, [router, examIds, selectedSubjects, totalSteps]);

  // ─── Reveal Phase ────────────────────────────────────
  if (showReveal) {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, position: 'relative' }}>
          <LinearGradient
            colors={
              isDark
                ? [`${archetype.gradient[0]}15`, 'transparent', `${archetype.gradient[1]}10`]
                : [`${archetype.gradient[0]}08`, 'transparent', `${archetype.gradient[1]}05`]
            }
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <ProfileReveal archetype={archetype} onContinue={handleContinue} />
        </View>
      </ScreenWrapper>
    );
  }

  // ─── Quiz Phase ──────────────────────────────────────
  return (
    <ScreenWrapper>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.xl }}>
        {/* Header with back + progress */}
        <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {questionIndex > 0 ? (
              <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <ProgressDots current={questionIndex} total={QUIZ_QUESTIONS.length} />
            <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Typography variant="caption" color={theme.textTertiary}>Skip</Typography>
            </TouchableOpacity>
          </View>

          {/* Step indicator text */}
          <Typography variant="caption" color={theme.textTertiary}>
            Step {Math.min(questionIndex + 3, totalSteps)} of {totalSteps}
          </Typography>
        </Animated.View>

        {/* Question */}
        <Animated.View
          key={currentQuestion.id}
          entering={SlideInRight.duration(300).springify()}
          exiting={SlideOutLeft.duration(200)}
          style={{ gap: spacing.sm }}
        >
          <Typography variant="h2">
            {currentQuestion.question}
          </Typography>
          <Typography variant="body" color={theme.textSecondary}>
            {currentQuestion.subtitle}
          </Typography>
        </Animated.View>

        {/* Options */}
        <Animated.View
          key={`opts-${currentQuestion.id}`}
          entering={FadeIn.delay(100).duration(300)}
          style={{ gap: spacing.sm, flex: 1 }}
        >
          {currentQuestion.options.map((opt, i) => (
            <OptionCard
              key={opt.key}
              option={opt}
              isSelected={selectedAnswer === opt.key}
              onPress={() => handleSelect(opt.key)}
              index={i}
            />
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)}>
          <Button
            fullWidth
            size="lg"
            disabled={!selectedAnswer}
            onPress={handleNext}
            icon={
              <Ionicons
                name={isLastQuestion ? 'sparkles' : 'arrow-forward'}
                size={18}
                color={selectedAnswer ? theme.buttonPrimaryText : theme.buttonDisabledText}
              />
            }
            iconPosition="right"
          >
            {isLastQuestion ? 'Reveal My Study Type' : 'Next'}
          </Button>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}
