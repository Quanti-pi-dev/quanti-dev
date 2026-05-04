// ─── Mock Test Screen ────────────────────────────────────────
// Timed, mixed-subject exam simulation. No hints, no AI Deep Dive.
// Timer auto-submits when time expires. Results show score,
// subject breakdown, and time per question.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Header } from '../src/components/layout/Header';
import { Typography } from '../src/components/ui/Typography';
import { Skeleton } from '../src/components/ui/Skeleton';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import {
  fetchMockTest,
  submitMockTestResult,
  type MockTestCard,
} from '../src/services/api-contracts';

// ─── Timer display ───────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function TimerBadge({ seconds, total }: { seconds: number; total: number }) {
  const { theme } = useTheme();
  const pct = total > 0 ? seconds / total : 1;
  const color = pct > 0.5 ? '#10B981' : pct > 0.2 ? '#F59E0B' : '#EF4444';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: color + '18',
        borderWidth: 1,
        borderColor: color + '30',
      }}
    >
      <Ionicons name="timer-outline" size={14} color={color} />
      <Typography variant="label" color={color} style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>
        {formatTime(seconds)}
      </Typography>
    </View>
  );
}

// ─── Answer option ───────────────────────────────────────────

function AnswerOption({
  text,
  index,
  selected,
  correct,
  showResult,
  onPress,
}: {
  text: string;
  index: number;
  selected: boolean;
  correct: boolean;
  showResult: boolean;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  const labels = ['A', 'B', 'C', 'D'];

  const bg = showResult
    ? correct
      ? (isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)')
      : selected
        ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
        : theme.cardAlt
    : selected
      ? (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)')
      : theme.cardAlt;

  const border = showResult
    ? correct ? '#10B981' : selected ? '#EF4444' : theme.border
    : selected ? theme.primary : theme.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={showResult}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor: border + '50',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: selected ? (showResult ? (correct ? '#10B981' : '#EF4444') : theme.primary) + '22' : theme.cardAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="label"
          color={selected ? (showResult ? (correct ? '#10B981' : '#EF4444') : theme.primary) : theme.textTertiary}
          style={{ fontSize: 13 }}
        >
          {labels[index]}
        </Typography>
      </View>
      <Typography variant="body" color={theme.text} style={{ flex: 1, fontSize: 14 }}>
        {text}
      </Typography>
      {showResult && correct && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
      {showResult && selected && !correct && <Ionicons name="close-circle" size={18} color="#EF4444" />}
    </TouchableOpacity>
  );
}

// ─── Results screen ──────────────────────────────────────────

function MockTestResults({
  cards,
  answers,
  timeElapsed,
  timeLimit,
  onRetry,
  onExit,
}: {
  cards: MockTestCard[];
  answers: Map<number, string>;
  timeElapsed: number;
  timeLimit: number;
  onRetry: () => void;
  onExit: () => void;
}) {
  const { theme, isDark } = useTheme();

  const correct = cards.filter((c, i) => answers.get(i) === c.correctAnswerId).length;
  const attempted = answers.size;
  const unattempted = cards.length - attempted;
  const score = cards.length > 0 ? Math.round((correct / cards.length) * 100) : 0;

  // NEET-style marking: +4 correct, -1 wrong, 0 unanswered
  const neetScore = correct * 4 - (attempted - correct) * 1;
  const maxNeetScore = cards.length * 4;

  const getGrade = (pct: number) => {
    if (pct >= 90) return { emoji: '🏆', label: 'Outstanding!', color: '#10B981' };
    if (pct >= 75) return { emoji: '🎯', label: 'Excellent!', color: '#6366F1' };
    if (pct >= 60) return { emoji: '💪', label: 'Good effort!', color: '#F59E0B' };
    if (pct >= 40) return { emoji: '📚', label: 'Keep practicing!', color: '#F97316' };
    return { emoji: '🔄', label: 'Need more practice', color: '#EF4444' };
  };

  const grade = getGrade(score);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
    >
      {/* Score hero */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View
          style={{
            borderRadius: radius['2xl'],
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: grade.color + '25',
          }}
        >
          <LinearGradient
            colors={[grade.color + (isDark ? '18' : '10'), grade.color + '05']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}
          >
            <Typography style={{ fontSize: 48 }}>{grade.emoji}</Typography>
            <Typography variant="h2" color={theme.text}>{score}%</Typography>
            <Typography variant="body" color={grade.color}>{grade.label}</Typography>

            <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md }}>
              <View style={{ alignItems: 'center' }}>
                <Typography variant="h3" color="#10B981">{correct}</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Correct</Typography>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Typography variant="h3" color="#EF4444">{attempted - correct}</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Wrong</Typography>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Typography variant="h3" color={theme.textSecondary}>{unattempted}</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Skipped</Typography>
              </View>
            </View>

            {/* NEET score */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                marginTop: spacing.sm,
              }}
            >
              <Typography variant="label" color={theme.text} align="center">
                NEET Score: {neetScore} / {maxNeetScore}
              </Typography>
              <Typography variant="caption" color={theme.textTertiary} align="center">
                (+4 correct, −1 wrong, 0 skipped)
              </Typography>
            </View>
          </LinearGradient>
        </View>
      </Animated.View>

      {/* Time stats */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)}>
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
          }}
        >
          <View
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: radius.xl,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons name="timer-outline" size={20} color={theme.primary} />
            <Typography variant="h4" color={theme.text}>{formatTime(timeElapsed)}</Typography>
            <Typography variant="caption" color={theme.textTertiary}>Time used</Typography>
          </View>
          <View
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: radius.xl,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons name="hourglass-outline" size={20} color={theme.textSecondary} />
            <Typography variant="h4" color={theme.text}>
              {attempted > 0 ? `${Math.round(timeElapsed / attempted)}s` : '—'}
            </Typography>
            <Typography variant="caption" color={theme.textTertiary}>Avg per Q</Typography>
          </View>
        </View>
      </Animated.View>

      {/* Action buttons */}
      <View style={{ gap: spacing.sm }}>
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: theme.primary,
            borderRadius: radius.xl,
            paddingVertical: spacing.md + 2,
          }}
        >
          <Ionicons name="refresh" size={18} color="#FFFFFF" />
          <Typography variant="label" color="#FFFFFF">Take Another Test</Typography>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onExit}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: theme.cardAlt,
            borderRadius: radius.xl,
            paddingVertical: spacing.md + 2,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Ionicons name="arrow-back" size={18} color={theme.textSecondary} />
          <Typography variant="label" color={theme.textSecondary}>Back to Study</Typography>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function MockTestScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [testKey, setTestKey] = useState(0);
  const resultSubmittedRef = useRef(false);

  const { data: mockTest, isLoading, refetch } = useQuery({
    queryKey: ['mockTest', examId, testKey],
    queryFn: () => fetchMockTest(examId, 30),
    staleTime: 0, // Always fresh for each test
  });

  const cards = mockTest?.cards ?? [];
  const totalTime = (mockTest?.timeLimitMinutes ?? 45) * 60;

  // Timer
  useEffect(() => {
    if (!started || finished) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setFinished(true);
          clearInterval(timerRef.current!);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return 0;
        }
        return prev - 1;
      });
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, finished]);

  const startTest = useCallback(() => {
    setStarted(true);
    setFinished(false);
    setCurrentIdx(0);
    setAnswers(new Map());
    setTimeRemaining(totalTime);
    setTimeElapsed(0);
    resultSubmittedRef.current = false;
  }, [totalTime]);

  // ─── Persist results to server when test finishes ──────────
  useEffect(() => {
    if (!finished || resultSubmittedRef.current || cards.length === 0) return;
    resultSubmittedRef.current = true;

    const answersArray = cards.map((c, i) => {
      const selectedId = answers.get(i) ?? '';
      return {
        cardId: c.cardId,
        selectedAnswerId: selectedId,
        correct: selectedId === c.correctAnswerId,
      };
    }).filter(a => a.selectedAnswerId !== ''); // Only include answered cards

    const correctCount = answersArray.filter(a => a.correct).length;

    void submitMockTestResult({
      examId: examId ?? undefined,
      totalCards: cards.length,
      correctCount,
      timeElapsedSeconds: timeElapsed,
      timeLimitSeconds: totalTime,
      answers: answersArray,
    }).catch(() => {
      // Best-effort — don't block the results screen
    });
  }, [finished, cards, answers, timeElapsed, totalTime, examId]);

  const selectAnswer = useCallback((optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers(prev => {
      const next = new Map(prev);
      next.set(currentIdx, optionId);
      return next;
    });
  }, [currentIdx]);

  const submitTest = useCallback(() => {
    Alert.alert(
      'Submit Test?',
      `You've answered ${answers.size} of ${cards.length} questions.${cards.length - answers.size > 0 ? ` ${cards.length - answers.size} unanswered.` : ''}`,
      [
        { text: 'Continue Test', style: 'cancel' },
        {
          text: 'Submit',
          style: 'destructive',
          onPress: () => {
            setFinished(true);
            if (timerRef.current) clearInterval(timerRef.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  }, [answers, cards]);

  const retryTest = useCallback(() => {
    setTestKey(k => k + 1);
    setStarted(false);
    setFinished(false);
    setCurrentIdx(0);
    setAnswers(new Map());
    resultSubmittedRef.current = false;
  }, []);

  const currentCard = cards[currentIdx];
  const currentAnswer = answers.get(currentIdx);

  // ─── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenWrapper>
        <Header showBack title="Mock Test" />
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <Skeleton height={200} borderRadius={radius['2xl']} />
          <Skeleton height={60} borderRadius={radius.xl} />
          <Skeleton height={60} borderRadius={radius.xl} />
        </View>
      </ScreenWrapper>
    );
  }

  // ─── Results state ─────────────────────────────────────────
  if (finished) {
    return (
      <ScreenWrapper>
        <Header showBack title="Test Results" />
        <MockTestResults
          cards={cards}
          answers={answers}
          timeElapsed={timeElapsed}
          timeLimit={totalTime}
          onRetry={retryTest}
          onExit={() => router.back()}
        />
      </ScreenWrapper>
    );
  }

  // ─── Pre-start state ───────────────────────────────────────
  if (!started) {
    return (
      <ScreenWrapper>
        <Header showBack title="Mock Test" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: spacing.xl,
            gap: spacing.lg,
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', gap: spacing.lg }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="document-text" size={36} color={theme.primary} />
            </View>

            <Typography variant="h2" align="center">Mock Test</Typography>
            <Typography variant="body" color={theme.textSecondary} align="center">
              A timed, mixed-subject exam simulation. No hints, no AI assistance — just like the real thing.
            </Typography>

            {/* Test info */}
            <View
              style={{
                width: '100%',
                borderRadius: radius.xl,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="help-circle-outline" size={18} color={theme.textSecondary} />
                  <Typography variant="body" color={theme.textSecondary}>Questions</Typography>
                </View>
                <Typography variant="label" color={theme.text}>{cards.length}</Typography>
              </View>
              <View style={{ height: 1, backgroundColor: theme.border }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="timer-outline" size={18} color={theme.textSecondary} />
                  <Typography variant="body" color={theme.textSecondary}>Time Limit</Typography>
                </View>
                <Typography variant="label" color={theme.text}>{mockTest?.timeLimitMinutes ?? 45} min</Typography>
              </View>
              <View style={{ height: 1, backgroundColor: theme.border }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="calculator-outline" size={18} color={theme.textSecondary} />
                  <Typography variant="body" color={theme.textSecondary}>Marking</Typography>
                </View>
                <Typography variant="label" color={theme.text}>+4 / −1 / 0</Typography>
              </View>
            </View>

            {/* Rules */}
            <View style={{ gap: spacing.xs, width: '100%' }}>
              {[
                'Questions are randomly sampled across all your subjects',
                'Timer auto-submits when time expires',
                'No going back to change answers (exam mode)',
                'Results show NEET-style scoring breakdown',
              ].map((rule, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
                  <Typography variant="caption" color={theme.textTertiary}>•</Typography>
                  <Typography variant="caption" color={theme.textTertiary} style={{ flex: 1 }}>
                    {rule}
                  </Typography>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={startTest}
              activeOpacity={0.8}
              disabled={cards.length === 0}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: cards.length > 0 ? theme.primary : theme.border,
                borderRadius: radius.xl,
                paddingVertical: spacing.md + 4,
                width: '100%',
              }}
            >
              <Ionicons name="play-circle" size={20} color="#FFFFFF" />
              <Typography variant="label" color="#FFFFFF">
                {cards.length > 0 ? 'Start Test' : 'No cards available'}
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // ─── Active test state ─────────────────────────────────────
  return (
    <ScreenWrapper>
      {/* Header with timer */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Typography variant="label" color={theme.text}>
          Q {currentIdx + 1}/{cards.length}
        </Typography>
        <TimerBadge seconds={timeRemaining} total={totalTime} />
        <TouchableOpacity
          onPress={submitTest}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radius.full,
            backgroundColor: '#EF444418',
          }}
        >
          <Typography variant="caption" color="#EF4444">Submit</Typography>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <ProgressBar progress={cards.length > 0 ? (currentIdx + 1) / cards.length : 0} height={3} />

      {/* Question */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
      >
        {currentCard && (
          <Animated.View entering={FadeIn.duration(200)} key={currentIdx}>
            {/* Topic chip */}
            {currentCard.topicName ? (
              <View
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                  borderRadius: radius.full,
                  backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)',
                  marginBottom: spacing.xs,
                }}
              >
                <Typography variant="caption" color={theme.primary} style={{ fontSize: 11 }}>
                  {currentCard.topicName}
                </Typography>
              </View>
            ) : null}

            <Typography variant="h4" color={theme.text} style={{ lineHeight: 26 }}>
              {currentCard.question}
            </Typography>

            {/* Answer options */}
            <View style={{ gap: spacing.sm }}>
              {currentCard.answers.map((ans, i) => (
                <AnswerOption
                  key={ans.id}
                  text={ans.text}
                  index={i}
                  selected={currentAnswer === ans.id}
                  correct={ans.id === currentCard.correctAnswerId}
                  showResult={false}
                  onPress={() => selectAnswer(ans.id)}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {/* Navigation */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {currentIdx > 0 && (
            <TouchableOpacity
              onPress={() => setCurrentIdx(i => i - 1)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                paddingVertical: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: theme.cardAlt,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
              <Typography variant="label" color={theme.textSecondary}>Previous</Typography>
            </TouchableOpacity>
          )}
          {currentIdx < cards.length - 1 ? (
            <TouchableOpacity
              onPress={() => setCurrentIdx(i => i + 1)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                paddingVertical: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: theme.primary,
              }}
            >
              <Typography variant="label" color="#FFFFFF">
                {currentAnswer ? 'Next' : 'Skip'}
              </Typography>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={submitTest}
              activeOpacity={0.7}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                paddingVertical: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: '#10B981',
              }}
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Typography variant="label" color="#FFFFFF">Submit Test</Typography>
            </TouchableOpacity>
          )}
        </View>

        {/* Question navigator grid */}
        <View style={{ gap: spacing.sm }}>
          <Typography variant="caption" color={theme.textTertiary}>Questions:</Typography>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {cards.map((_, i) => {
              const isAnswered = answers.has(i);
              const isCurrent = i === currentIdx;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setCurrentIdx(i)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCurrent
                      ? theme.primary
                      : isAnswered
                        ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)')
                        : theme.cardAlt,
                    borderWidth: isCurrent ? 0 : 1,
                    borderColor: isAnswered ? '#10B98130' : theme.border,
                  }}
                >
                  <Typography
                    variant="caption"
                    color={isCurrent ? '#FFFFFF' : isAnswered ? '#10B981' : theme.textTertiary}
                    style={{ fontSize: 11 }}
                  >
                    {i + 1}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
