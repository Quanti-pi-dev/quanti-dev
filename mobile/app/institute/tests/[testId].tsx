// ─── Institute Test-Taking Screen ──────────────────────────────────
// Timed, multiple-choice test. Auto-submits on expiry.
// Shows per-question navigation palette and a timer.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, BackHandler,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../src/theme';
import { spacing, radius } from '../../../src/theme/tokens';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../src/components/ui/Typography';
import { ProgressBar } from '../../../src/components/ui/ProgressBar';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import {
  fetchInstituteTest,
  startInstituteTest,
  submitInstituteTest,
  type InstituteTest,
  type InstituteTestQuestion,
} from '../../../src/services/api-contracts';

// ── Timer badge ─────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function TimerBadge({ seconds, total }: { seconds: number; total: number }) {
  const pct = total > 0 ? seconds / total : 1;
  const color = pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#f59e0b' : '#ef4444';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 20, backgroundColor: `${color}18`,
      borderWidth: 1, borderColor: `${color}40`,
    }}>
      <Ionicons name="timer-outline" size={14} color={color} />
      <Typography variant="label" color={color} style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>
        {formatTime(seconds)}
      </Typography>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────

export default function TakeTestScreen() {
  const { testId, instituteId } = useLocalSearchParams<{ testId: string; instituteId: string }>();
  const { theme } = useTheme();
  const router = useRouter();

  // State
  const [test, setTest]             = useState<InstituteTest | null>(null);
  const [loading, setLoading]       = useState(true);
  const [started, setStarted]       = useState(false);
  const [submissionId, setSubId]    = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers]       = useState<Record<string, string>>({}); // questionId → optionId
  const [timeLeft, setTimeLeft]     = useState(0);
  const [totalTime, setTotalTime]   = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef<number>(0);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load test (without answers)
  useEffect(() => {
    if (!testId || !instituteId) return;
    const load = async () => {
      setLoading(true);
      try {
        const t = await fetchInstituteTest(instituteId, testId);
        setTest(t);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [testId, instituteId]);

  // Back-handler: warn before leaving
  useEffect(() => {
    if (!started) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Leave Test?', 'Your progress will be lost. Are you sure?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => { clearTimer(); router.back(); } },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [started]);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startTest = async () => {
    if (!testId || !instituteId || !test) return;
    try {
      const res = await startInstituteTest(instituteId, testId);
      setSubId(res.submissionId);
      const secs = res.durationMinutes * 60;
      setTimeLeft(secs);
      setTotalTime(secs);
      startedAt.current = Date.now();
      setStarted(true);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearTimer();
            void handleSubmit(true); // auto-submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Could not start test';
      Alert.alert('Error', msg);
    }
  };

  const handleSubmit = useCallback(async (auto = false) => {
    if (!testId || !instituteId || submitting) return;
    if (!auto) {
      const answered = Object.keys(answers).length;
      const total = test?.questions?.length ?? 0;
      if (answered < total) {
        const proceed = await new Promise<boolean>(resolve =>
          Alert.alert(
            `${total - answered} unanswered`,
            'Submit anyway? Unanswered questions will score 0.',
            [
              { text: 'Review', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Submit', style: 'destructive', onPress: () => resolve(true) },
            ],
          ),
        );
        if (!proceed) return;
      }
    }
    clearTimer();
    setSubmitting(true);
    const timeTakenSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    const answerPayload = Object.entries(answers).map(([questionId, selectedOptionId]) => ({
      questionId, selectedOptionId,
    }));
    try {
      await submitInstituteTest(instituteId, testId, answerPayload, timeTakenSeconds);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/institute/tests/${testId}/result?instituteId=${instituteId}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Submission failed';
      Alert.alert('Error', msg);
      setSubmitting(false);
    }
  }, [testId, instituteId, answers, submitting, test]);

  const selectAnswer = (questionId: string, optionId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  if (loading) return (
    <ScreenWrapper>
      <View style={{ padding: spacing.lg }}>
        <Skeleton height={200} style={{ borderRadius: radius.xl, marginBottom: spacing.lg }} />
        <Skeleton height={60} style={{ borderRadius: radius.lg, marginBottom: spacing.md }} />
        <Skeleton height={60} style={{ borderRadius: radius.lg, marginBottom: spacing.md }} />
      </View>
    </ScreenWrapper>
  );

  if (!test) return (
    <ScreenWrapper>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body" color={theme.text.secondary}>Test not found</Typography>
      </View>
    </ScreenWrapper>
  );

  // ── Pre-start overview ───────────────────────────────────────
  if (!started) {
    return (
      <ScreenWrapper>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          <TouchableOpacity onPress={() => router.back()}
            style={{ marginBottom: spacing.lg, alignSelf: 'flex-start' }}>
            <Ionicons name="arrow-back" size={24} color={theme.text.secondary} />
          </TouchableOpacity>

          <Animated.View entering={FadeInDown.springify()}>
            {/* Title */}
            <View style={{
              padding: spacing.lg, borderRadius: radius.xl, marginBottom: spacing.lg,
              backgroundColor: 'rgba(99,102,241,0.1)',
              borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
            }}>
              <Typography variant="h2" color={theme.text.primary} style={{ marginBottom: spacing.sm }}>
                {test.title}
              </Typography>
              {test.description ? (
                <Typography variant="body" color={theme.text.secondary}>{test.description}</Typography>
              ) : null}
            </View>

            {/* Stats grid */}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
              {[
                { icon: 'help-circle-outline', label: 'Questions', value: test.questionCount },
                { icon: 'timer-outline', label: 'Duration', value: `${test.durationMinutes} min` },
                { icon: 'star-outline', label: 'Total Marks', value: test.totalMarks ?? test.questionCount * 4 },
                { icon: 'checkmark-circle-outline', label: 'Passing', value: `${test.settings.passingScore}%` },
              ].map(({ icon, label, value }) => (
                <View key={label} style={{
                  flex: 1, minWidth: '40%', padding: spacing.md,
                  borderRadius: radius.lg, backgroundColor: theme.surface.secondary,
                  borderWidth: 1, borderColor: theme.border.default, alignItems: 'center', gap: 4,
                }}>
                  <Ionicons name={icon as 'timer-outline'} size={20} color="#a5b4fc" />
                  <Typography variant="h3" color={theme.text.primary}>{value}</Typography>
                  <Typography variant="caption" color={theme.text.tertiary}>{label}</Typography>
                </View>
              ))}
            </View>

            {/* Rules */}
            <View style={{
              padding: spacing.lg, borderRadius: radius.xl, marginBottom: spacing.xl,
              backgroundColor: theme.surface.secondary, borderWidth: 1, borderColor: theme.border.default,
              gap: spacing.sm,
            }}>
              <Typography variant="label" color={theme.text.primary} style={{ marginBottom: spacing.xs }}>
                Rules
              </Typography>
              {[
                test.settings.negativeMarking
                  ? `Negative marking: −${test.settings.negativeMarkValue} per wrong answer`
                  : 'No negative marking',
                test.settings.shuffleQuestions ? 'Questions are shuffled' : 'Fixed question order',
                `Results: ${test.settings.showResults === 'immediate' ? 'shown immediately after submission' : test.settings.showResults === 'after_close' ? 'after the test closes' : 'when released by educator'}`,
                'Timer starts when you tap "Start Test"',
                'Auto-submits when time expires',
              ].map(rule => (
                <View key={rule} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                  <Ionicons name="checkmark" size={14} color="#6366f1" style={{ marginTop: 2 }} />
                  <Typography variant="body" color={theme.text.secondary} style={{ flex: 1, fontSize: 13 }}>
                    {rule}
                  </Typography>
                </View>
              ))}
            </View>

            {/* Start button */}
            <TouchableOpacity
              onPress={() => void startTest()}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#6366f1', borderRadius: radius.xl,
                paddingVertical: spacing.md + 2,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: spacing.sm,
              }}
            >
              <Ionicons name="play" size={18} color="white" />
              <Typography variant="button" color="white">Start Test</Typography>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // ── Active test ──────────────────────────────────────────────
  const questions = test.questions ?? [];
  const q = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  if (!q) return null;

  return (
    <ScreenWrapper>
      {/* Fixed header */}
      <View style={{
        paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
        borderBottomWidth: 1, borderBottomColor: theme.border.default,
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      }}>
        <Typography variant="label" color={theme.text.secondary} style={{ flex: 1 }} numberOfLines={1}>
          {test.title}
        </Typography>
        <TimerBadge seconds={timeLeft} total={totalTime} />
      </View>

      {/* Progress */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <ProgressBar progress={answeredCount / questions.length} />
        <Typography variant="caption" color={theme.text.tertiary} style={{ marginTop: 4, textAlign: 'right' }}>
          {answeredCount}/{questions.length} answered
        </Typography>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        {/* Question number */}
        <Animated.View key={currentIdx} entering={FadeIn.duration(200)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
              backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
            }}>
              <Typography variant="caption" color="#a5b4fc" style={{ fontWeight: '700' }}>
                Q{currentIdx + 1} of {questions.length}
              </Typography>
            </View>
            <Typography variant="caption" color={theme.text.tertiary}>{q.marks} marks</Typography>
          </View>

          {/* Question text */}
          <Typography variant="body" color={theme.text.primary}
            style={{ fontSize: 16, lineHeight: 26, marginBottom: spacing.xl }}>
            {q.text}
          </Typography>

          {/* Options */}
          <View style={{ gap: spacing.sm }}>
            {q.options.map((opt, oi) => {
              const selected = answers[q.id] === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => selectAnswer(q.id, opt.id)}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    padding: spacing.md, borderRadius: radius.xl,
                    backgroundColor: selected ? 'rgba(99,102,241,0.15)' : theme.surface.secondary,
                    borderWidth: 2,
                    borderColor: selected ? '#6366f1' : theme.border.default,
                  }}
                >
                  {/* Option letter circle */}
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: selected ? '#6366f1' : theme.surface.primary,
                    borderWidth: 1.5, borderColor: selected ? '#6366f1' : theme.border.default,
                    alignItems: 'center', justifyContent: 'center', shrink: 0,
                  }}>
                    <Typography variant="caption" color={selected ? 'white' : theme.text.secondary}
                      style={{ fontWeight: '700' }}>
                      {String.fromCharCode(65 + oi)}
                    </Typography>
                  </View>
                  <Typography variant="body" color={selected ? '#a5b4fc' : theme.text.primary}
                    style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
                    {opt.text}
                  </Typography>
                  {selected && <Ionicons name="checkmark-circle" size={18} color="#6366f1" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Question palette */}
        <View style={{
          marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.xl,
          backgroundColor: theme.surface.secondary, borderWidth: 1, borderColor: theme.border.default,
        }}>
          <Typography variant="caption" color={theme.text.tertiary} style={{ marginBottom: spacing.sm }}>
            Question palette
          </Typography>
          <FlatList
            data={questions}
            keyExtractor={(_q, i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const answered = !!answers[item.id];
              const isCurrent = index === currentIdx;
              return (
                <TouchableOpacity
                  onPress={() => setCurrentIdx(index)}
                  style={{
                    width: 34, height: 34, borderRadius: 8, marginRight: 6,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isCurrent ? '#6366f1' : answered ? 'rgba(34,197,94,0.2)' : theme.surface.primary,
                    borderWidth: 1.5,
                    borderColor: isCurrent ? '#6366f1' : answered ? '#22c55e' : theme.border.default,
                  }}
                >
                  <Typography variant="caption"
                    color={isCurrent ? 'white' : answered ? '#4ade80' : theme.text.tertiary}
                    style={{ fontWeight: '700', fontSize: 11 }}>
                    {index + 1}
                  </Typography>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: spacing.lg, paddingBottom: spacing.xl,
        backgroundColor: theme.surface.primary,
        borderTopWidth: 1, borderTopColor: theme.border.default,
        flexDirection: 'row', gap: spacing.md,
      }}>
        <TouchableOpacity
          onPress={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          style={{
            flex: 1, paddingVertical: spacing.md, borderRadius: radius.xl,
            backgroundColor: theme.surface.secondary,
            alignItems: 'center', justifyContent: 'center',
            opacity: currentIdx === 0 ? 0.4 : 1,
          }}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text.secondary} />
        </TouchableOpacity>

        {currentIdx < questions.length - 1 ? (
          <TouchableOpacity
            onPress={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
            style={{
              flex: 3, paddingVertical: spacing.md, borderRadius: radius.xl,
              backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6,
            }}
          >
            <Typography variant="button" color="white">Next</Typography>
            <Ionicons name="arrow-forward" size={16} color="white" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => void handleSubmit(false)}
            disabled={submitting}
            style={{
              flex: 3, paddingVertical: spacing.md, borderRadius: radius.xl,
              backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 6, opacity: submitting ? 0.7 : 1,
            }}
          >
            <Ionicons name="checkmark-done" size={16} color="white" />
            <Typography variant="button" color="white">
              {submitting ? 'Submitting…' : 'Submit Test'}
            </Typography>
          </TouchableOpacity>
        )}
      </View>
    </ScreenWrapper>
  );
}
