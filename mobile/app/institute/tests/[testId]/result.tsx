// ─── Institute Test Result Screen ─────────────────────────────────
// Shows score, pass/fail, per-question review with correct answers.

import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../../src/theme';
import { spacing, radius } from '../../../../src/theme/tokens';
import { ScreenWrapper } from '../../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../../src/components/ui/Typography';
import { Skeleton } from '../../../../src/components/ui/Skeleton';
import {
  fetchInstituteTestResult,
  type InstituteSubmissionResult,
} from '../../../../src/services/api-contracts';

interface ResultData {
  submission: InstituteSubmissionResult;
  test: { title: string; totalMarks: number; passingScore: number; passed: boolean };
  resultsAvailable: boolean;
  message?: string;
}

// ── Main screen ─────────────────────────────────────────────────

export default function TestResultScreen() {
  const { testId, instituteId } = useLocalSearchParams<{ testId: string; instituteId: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [data, setData]             = useState<ResultData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (!testId || !instituteId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchInstituteTestResult(instituteId, testId);
        setData(res);
        void Haptics.notificationAsync(
          res.resultsAvailable && res.submission.percentage >= (res.test.passingScore ?? 60)
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [testId, instituteId]);

  // On returning home, bust the institute-tests cache so the home
  // screen reflects any status change (e.g. test now "closed").
  const goHome = () => {
    void queryClient.invalidateQueries({ queryKey: ['institute-tests', instituteId] });
    router.replace('/institute');
  };

  if (loading) return (
    <ScreenWrapper>
      <View style={{ padding: spacing.lg }}>
        <Skeleton height={240} style={{ borderRadius: radius.xl, marginBottom: spacing.lg }} />
        <Skeleton height={60} style={{ borderRadius: radius.lg, marginBottom: spacing.md }} />
        <Skeleton height={60} style={{ borderRadius: radius.lg }} />
      </View>
    </ScreenWrapper>
  );

  if (!data) return (
    <ScreenWrapper>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.text.tertiary} />
        <Typography variant="body" color={theme.text.secondary}>Result not found</Typography>
        <TouchableOpacity onPress={goHome}
          style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: '#6366f1', borderRadius: radius.xl }}>
          <Typography variant="button" color="white">Back to Institute</Typography>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );

  // Results pending
  if (!data.resultsAvailable) {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <LinearGradient colors={['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.05)']}
            style={{ width: 90, height: 90, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time-outline" size={44} color="#f59e0b" />
          </LinearGradient>
          <Typography variant="h2" color={theme.text.primary} style={{ textAlign: 'center' }}>
            Submitted!
          </Typography>
          <Typography variant="body" color={theme.text.secondary} style={{ textAlign: 'center', lineHeight: 22 }}>
            {data.message ?? 'Results will be available when released by your educator.'}
          </Typography>
          <TouchableOpacity onPress={goHome} style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
              <Typography variant="button" color="white">Back to Institute</Typography>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  const { submission, test } = data;
  const pct     = submission.percentage;
  const correct = submission.answers.filter(a => a.isCorrect).length;
  const wrong   = submission.answers.filter(a => !a.isCorrect && a.selectedOptionId).length;
  const skipped = submission.answers.filter(a => !a.selectedOptionId).length;

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 3 }}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInDown.springify()}>
          <Typography variant="h2" color={theme.text.primary} style={{ marginBottom: spacing.xs }}>
            {test.title}
          </Typography>
          <Typography variant="body" color={theme.text.secondary}>Test Results</Typography>
        </Animated.View>

        {/* Score circle */}
        <Animated.View entering={FadeIn.delay(100).springify()}
          style={{
            marginVertical: spacing.xl,
            padding: spacing.xl, borderRadius: radius.xl,
            backgroundColor: test.passed ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
            borderWidth: 1,
            borderColor: test.passed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
            alignItems: 'center',
          }}>

          <View style={{
            width: 130, height: 130, borderRadius: 65,
            borderWidth: 6, borderColor: test.passed ? '#22c55e' : '#ef4444',
            alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
          }}>
            <Typography variant="h1" color={test.passed ? '#4ade80' : '#f87171'}
              style={{ fontSize: 38, fontWeight: '800' }}>
              {pct}%
            </Typography>
          </View>

          <View style={{
            paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full,
            backgroundColor: test.passed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          }}>
            <Typography variant="label"
              color={test.passed ? '#4ade80' : '#f87171'}
              style={{ fontSize: 15, fontWeight: '700' }}>
              {test.passed ? '🎉 Passed' : '❌ Failed'} · {submission.score}/{test.totalMarks} marks
            </Typography>
          </View>
        </Animated.View>

        {/* Stat cards */}
        <Animated.View entering={FadeInDown.delay(150).springify()}
          style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          {[
            { label: 'Correct', value: correct, color: '#4ade80' },
            { label: 'Wrong',   value: wrong,   color: '#f87171' },
            { label: 'Skipped', value: skipped, color: '#fbbf24' },
          ].map(s => (
            <View key={s.label} style={{
              flex: 1, padding: spacing.md, borderRadius: radius.xl,
              backgroundColor: theme.surface.secondary,
              borderWidth: 1, borderColor: theme.border.default, alignItems: 'center', gap: 4,
            }}>
              <Typography variant="h2" color={s.color}>{s.value}</Typography>
              <Typography variant="caption" color={theme.text.tertiary}>{s.label}</Typography>
            </View>
          ))}
        </Animated.View>

        {/* Review toggle */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TouchableOpacity
            onPress={() => setShowReview(v => !v)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              padding: spacing.lg, borderRadius: radius.xl,
              backgroundColor: theme.surface.secondary,
              borderWidth: 1, borderColor: theme.border.default,
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="list-outline" size={18} color="#a5b4fc" />
              <Typography variant="label" color={theme.text.primary}>Review Answers</Typography>
            </View>
            <Ionicons name={showReview ? 'chevron-up' : 'chevron-down'} size={18} color={theme.text.tertiary} />
          </TouchableOpacity>

          {showReview && (
            <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
              {submission.answers.map((ans, idx) => (
                <Animated.View key={ans.questionId} entering={FadeInDown.delay(idx * 30).springify()}
                  style={{
                    padding: spacing.md, borderRadius: radius.xl,
                    backgroundColor: ans.isCorrect ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                    borderWidth: 1, borderColor: ans.isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                    <View style={{
                      width: 24, height: 24, borderRadius: 12,
                      backgroundColor: ans.isCorrect ? '#22c55e' : '#ef4444',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={ans.isCorrect ? 'checkmark' : 'close'} size={14} color="white" />
                    </View>
                    <Typography variant="caption" color={theme.text.tertiary}>Q{idx + 1} · {ans.marks} marks</Typography>
                  </View>
                  {!ans.isCorrect && ans.correctAnswerId && (
                    <Typography variant="caption" color="#4ade80" style={{ marginBottom: 4 }}>
                      ✓ Correct: option {ans.correctAnswerId.slice(-1).toUpperCase()}
                    </Typography>
                  )}
                  {ans.explanation && (
                    <Typography variant="caption" color={theme.text.secondary}
                      style={{ marginTop: 4, fontStyle: 'italic' }}>
                      💡 {ans.explanation}
                    </Typography>
                  )}
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* CTA */}
        <TouchableOpacity onPress={goHome} activeOpacity={0.85}
          style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
          <LinearGradient colors={['#6366f1', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ paddingVertical: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
            <Ionicons name="home" size={16} color="white" />
            <Typography variant="button" color="white">Back to Institute</Typography>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}
