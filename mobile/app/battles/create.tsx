// ─── Create Challenge Wizard ────────────────────────────────
// 3-step flow: Content → Stakes → Review
// Uses swipeable Animated.View, no page navigation.

import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useTheme } from '../../src/theme';
import { spacing, radius, shadows } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { CoinDisplay } from '../../src/components/CoinDisplay';
import { useCoinBalance } from '../../src/hooks/useGamification';
import { useExams } from '../../src/hooks/useExams';
import { useExamSubjects } from '../../src/hooks/useSubjects';
import { SUBJECT_LEVELS } from '@kd/shared';

const DURATIONS = [
  { label: '1 min', value: 60 },
  { label: '1.5 min', value: 90 },
  { label: '2 min', value: 120 },
  { label: '3 min', value: 180 },
];

export default function CreateChallengeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: coins } = useCoinBalance();

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('Beginner');
  const [betAmount, setBetAmount] = useState(50);
  const [durationSeconds, setDurationSeconds] = useState(120);

  // Data
  const { data: examsPages, isLoading: examsLoading } = useExams();
  const { data: subjects, isLoading: subjectsLoading } = useExamSubjects(selectedExamId ?? '');

  const balance = coins?.balance ?? 0;
  const maxBet = Math.min(balance, 50000);

  const exams = examsPages?.pages?.flatMap((p) => p.data) ?? [];
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const subjectsList = subjects ?? [];
  const selectedSubject = subjectsList.find((s) => s.id === selectedSubjectId);

  const canProceedStep0 = !!selectedExamId && !!selectedSubjectId && !!selectedLevel;
  const canProceedStep1 = betAmount >= 10 && betAmount <= maxBet;

  return (
    <ScreenWrapper>
      {/* ── Header ── */}
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.base,
          paddingBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/battles');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Typography variant="h4">Create Challenge</Typography>
          <Typography variant="caption" style={{ color: theme.textSecondary }}>
            Step {step + 1} of 3
          </Typography>
        </View>
        <CoinDisplay coins={balance} size="sm" />
      </View>

      {/* ── Progress bar ── */}
      <View style={{ height: 3, backgroundColor: theme.borderLight, flexDirection: 'row' }}>
        <View style={{ flex: step + 1, backgroundColor: theme.primary, borderRadius: 2 }} />
        <View style={{ flex: 2 - step }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ Step 0: Content ═══ */}
        {step === 0 && (
          <Animated.View entering={FadeInRight.duration(300)} style={{ gap: spacing.xl }}>
            {/* Exam picker */}
            <View style={{ gap: spacing.md }}>
              <Typography variant="labelMedium" style={{ color: theme.textSecondary }}>
                SELECT EXAM
              </Typography>
              {examsLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {(exams ?? []).map((exam) => (
                    <TouchableOpacity
                      key={exam.id}
                      onPress={() => { setSelectedExamId(exam.id); setSelectedSubjectId(null); }}
                      style={{
                        paddingHorizontal: spacing.base,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.full,
                        backgroundColor: selectedExamId === exam.id ? theme.primary : theme.card,
                        borderWidth: 1,
                        borderColor: selectedExamId === exam.id ? theme.primary : theme.border,
                      }}
                    >
                      <Typography
                        variant="bodySemiBold"
                        style={{
                          color: selectedExamId === exam.id ? theme.buttonPrimaryText : theme.text,
                          fontSize: 13,
                        }}
                      >
                        {exam.title}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Subject picker */}
            {selectedExamId && (
              <View style={{ gap: spacing.md }}>
                <Typography variant="labelMedium" style={{ color: theme.textSecondary }}>
                  SELECT SUBJECT
                </Typography>
                {subjectsLoading ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {subjectsList.map((subject) => (
                      <TouchableOpacity
                        key={subject.id}
                        onPress={() => setSelectedSubjectId(subject.id)}
                        style={{
                          paddingHorizontal: spacing.base,
                          paddingVertical: spacing.sm,
                          borderRadius: radius.full,
                          backgroundColor: selectedSubjectId === subject.id ? theme.primary : theme.card,
                          borderWidth: 1,
                          borderColor: selectedSubjectId === subject.id ? theme.primary : theme.border,
                        }}
                      >
                        <Typography
                          variant="bodySemiBold"
                          style={{
                            color: selectedSubjectId === subject.id ? theme.buttonPrimaryText : theme.text,
                            fontSize: 13,
                          }}
                        >
                          {subject.name}
                        </Typography>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Level picker */}
            {selectedSubjectId && (
              <View style={{ gap: spacing.md }}>
                <Typography variant="labelMedium" style={{ color: theme.textSecondary }}>
                  SELECT LEVEL
                </Typography>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {SUBJECT_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => setSelectedLevel(level)}
                      style={{
                        paddingHorizontal: spacing.base,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.full,
                        backgroundColor: selectedLevel === level ? theme.primary : theme.card,
                        borderWidth: 1,
                        borderColor: selectedLevel === level ? theme.primary : theme.border,
                      }}
                    >
                      <Typography
                        variant="bodySemiBold"
                        style={{
                          color: selectedLevel === level ? theme.buttonPrimaryText : theme.text,
                          fontSize: 13,
                        }}
                      >
                        {level}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ═══ Step 1: Stakes ═══ */}
        {step === 1 && (
          <Animated.View entering={FadeInRight.duration(300)} style={{ gap: spacing.xl }}>
            {/* Duration toggle */}
            <View style={{ gap: spacing.md }}>
              <Typography variant="labelMedium" style={{ color: theme.textSecondary }}>
                MATCH DURATION
              </Typography>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => setDurationSeconds(d.value)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: durationSeconds === d.value ? theme.primary : theme.card,
                      borderWidth: 1,
                      borderColor: durationSeconds === d.value ? theme.primary : theme.border,
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="bodySemiBold"
                      style={{
                        color: durationSeconds === d.value ? theme.buttonPrimaryText : theme.text,
                        fontSize: 13,
                      }}
                    >
                      {d.label}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Bet amount */}
            <View style={{ gap: spacing.md }}>
              <Typography variant="labelMedium" style={{ color: theme.textSecondary }}>
                BET AMOUNT
              </Typography>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {[10, 25, 50, 100, 250, 500].filter((v) => v <= maxBet).map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setBetAmount(v)}
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: betAmount === v ? theme.coin : theme.card,
                      borderWidth: 1,
                      borderColor: betAmount === v ? theme.coin : theme.border,
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="bodyBold"
                      style={{
                        color: betAmount === v ? '#fff' : theme.text,
                      }}
                    >
                      🪙 {v}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
              <Typography variant="caption" style={{ color: theme.textTertiary }}>
                Your balance: {balance} coins
              </Typography>
            </View>

            {/* Winner preview */}
            <View
              style={{
                backgroundColor: theme.successLight,
                borderRadius: radius.lg,
                padding: spacing.lg,
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              <Typography variant="h3" style={{ color: theme.success }}>
                🏆 {betAmount * 2}
              </Typography>
              <Typography variant="caption" style={{ color: theme.success }}>
                Winner takes all
              </Typography>
            </View>
          </Animated.View>
        )}

        {/* ═══ Step 2: Review ═══ */}
        {step === 2 && (
          <Animated.View entering={FadeInRight.duration(300)} style={{ gap: spacing.xl }}>
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.lg,
                padding: spacing.xl,
                gap: spacing.md,
                borderWidth: 1,
                borderColor: theme.border,
                ...shadows.sm,
                shadowColor: theme.shadow,
              }}
            >
              <Typography variant="h4" style={{ textAlign: 'center' }}>Challenge Summary</Typography>
              <View style={{ height: 1, backgroundColor: theme.divider }} />

              {[
                { label: 'Exam', value: selectedExam?.title ?? '—' },
                { label: 'Subject', value: (selectedSubject as { name: string } | undefined)?.name ?? '—' },
                { label: 'Level', value: selectedLevel },
                { label: 'Duration', value: `${durationSeconds}s` },
                { label: 'Your Bet', value: `🪙 ${betAmount}` },
                { label: 'Winner Takes', value: `🪙 ${betAmount * 2}` },
              ].map((row) => (
                <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Typography variant="body" style={{ color: theme.textSecondary }}>{row.label}</Typography>
                  <Typography variant="bodySemiBold">{row.value}</Typography>
                </View>
              ))}
            </View>

            {/* Choose Opponent button */}
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/battles/friend-select' as never,
                  params: {
                    examId: selectedExamId!,
                    subjectId: selectedSubjectId!,
                    level: selectedLevel,
                    betAmount: String(betAmount),
                    durationSeconds: String(durationSeconds),
                  },
                } as never)
              }
              style={{
                backgroundColor: theme.buttonPrimary,
                borderRadius: radius.lg,
                paddingVertical: spacing.lg,
                alignItems: 'center',
                ...shadows.md,
                shadowColor: theme.primary,
              }}
            >
              <Typography variant="bodyBold" style={{ color: theme.buttonPrimaryText, fontSize: 16 }}>
                Choose Opponent →
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* ── Navigation buttons ── */}
      {step < 2 && (
        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            flexDirection: 'row',
            gap: spacing.md,
          }}
        >
          {step > 0 && (
            <TouchableOpacity
              onPress={() => setStep(step - 1)}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                backgroundColor: theme.buttonSecondary,
                alignItems: 'center',
              }}
            >
              <Typography variant="bodySemiBold" style={{ color: theme.buttonSecondaryText }}>
                Back
              </Typography>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setStep(step + 1)}
            disabled={step === 0 ? !canProceedStep0 : !canProceedStep1}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              backgroundColor: (step === 0 ? canProceedStep0 : canProceedStep1)
                ? theme.buttonPrimary
                : theme.buttonDisabled,
              alignItems: 'center',
            }}
          >
            <Typography
              variant="bodySemiBold"
              style={{
                color: (step === 0 ? canProceedStep0 : canProceedStep1)
                  ? theme.buttonPrimaryText
                  : theme.buttonDisabledText,
              }}
            >
              Next
            </Typography>
          </TouchableOpacity>
        </View>
      )}
    </ScreenWrapper>
  );
}
