// ─── Create Challenge Wizard ────────────────────────────────
// 3-step flow: Content → Stakes → Review
// Uses swipeable Animated.View, no page navigation.

import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useTheme } from '../../src/theme';
import { spacing, radius, shadows } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { CoinDisplay } from '../../src/components/CoinDisplay';
import { useCoinBalance } from '../../src/hooks/useGamification';
import { useCreateChallenge } from '../../src/hooks/useChallenge';
import { useExams } from '../../src/hooks/useExams';
import { useExamSubjects } from '../../src/hooks/useSubjects';
import { SUBJECT_LEVELS } from '@kd/shared';

const DURATIONS = [
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
  { label: '15 min', value: 900 },
  { label: '20 min', value: 1200 },
];

export default function CreateChallengeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ opponentId?: string; opponentName?: string }>();
  const createMutation = useCreateChallenge();
  const { data: coins } = useCoinBalance();

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('Beginner');
  const [betAmount, setBetAmount] = useState(50);
  const [durationSeconds, setDurationSeconds] = useState(300);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationMinutes, setCustomDurationMinutes] = useState('25');

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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
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
                      accessibilityRole="radio"
                      accessibilityLabel={exam.title}
                      accessibilityState={{ selected: selectedExamId === exam.id }}
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
                        accessibilityRole="radio"
                        accessibilityLabel={subject.name}
                        accessibilityState={{ selected: selectedSubjectId === subject.id }}
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
                      accessibilityRole="radio"
                      accessibilityLabel={level}
                      accessibilityState={{ selected: selectedLevel === level }}
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
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => {
                      setIsCustomDuration(false);
                      setDurationSeconds(d.value);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={d.label}
                    accessibilityState={{ selected: !isCustomDuration && durationSeconds === d.value }}
                    style={{
                      flexBasis: '30%',
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: !isCustomDuration && durationSeconds === d.value ? theme.primary : theme.card,
                      borderWidth: 1,
                      borderColor: !isCustomDuration && durationSeconds === d.value ? theme.primary : theme.border,
                      alignItems: 'center',
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Typography
                      variant="bodySemiBold"
                      style={{
                        color: !isCustomDuration && durationSeconds === d.value ? theme.buttonPrimaryText : theme.text,
                        fontSize: 13,
                      }}
                    >
                      {d.label}
                    </Typography>
                  </TouchableOpacity>
                ))}
                
                <TouchableOpacity
                  onPress={() => setIsCustomDuration(true)}
                  accessibilityRole="radio"
                  accessibilityLabel="Custom time"
                  accessibilityState={{ selected: isCustomDuration }}
                  style={{
                    flexBasis: '30%',
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: isCustomDuration ? theme.primary : theme.card,
                    borderWidth: 1,
                    borderColor: isCustomDuration ? theme.primary : theme.border,
                    alignItems: 'center',
                    marginBottom: spacing.sm,
                  }}
                >
                  <Typography
                    variant="bodySemiBold"
                    style={{
                      color: isCustomDuration ? theme.buttonPrimaryText : theme.text,
                      fontSize: 13,
                    }}
                  >
                    Custom
                  </Typography>
                </TouchableOpacity>
              </View>

              {isCustomDuration && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                  <Typography variant="body" style={{ color: theme.textSecondary }}>Minutes:</Typography>
                  <TextInput
                    value={customDurationMinutes}
                    onChangeText={setCustomDurationMinutes}
                    keyboardType="numeric"
                    placeholder="25"
                    placeholderTextColor={theme.textTertiary}
                    style={{
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                      borderWidth: 1,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      minWidth: 80,
                      textAlign: 'center',
                      fontFamily: 'Inter-Medium',
                      fontSize: 14,
                    }}
                  />
                </View>
              )}
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
                    accessibilityRole="radio"
                    accessibilityLabel={`${v} coins`}
                    accessibilityState={{ selected: betAmount === v }}
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
                { label: 'Opponent', value: params.opponentName ?? '—' },
                { label: 'Exam', value: selectedExam?.title ?? '—' },
                { label: 'Subject', value: (selectedSubject as { name: string } | undefined)?.name ?? '—' },
                { label: 'Level', value: selectedLevel },
                { label: 'Duration', value: isCustomDuration ? `${parseInt(customDurationMinutes) || 5} min` : `${durationSeconds / 60} min` },
                { label: 'Your Bet', value: `🪙 ${betAmount}` },
                { label: 'Winner Takes', value: `🪙 ${betAmount * 2}` },
              ].map((row) => (
                <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Typography variant="body" style={{ color: theme.textSecondary }}>{row.label}</Typography>
                  <Typography variant="bodySemiBold">{row.value}</Typography>
                </View>
              ))}
            </View>

            {/* Create Challenge button */}
            <TouchableOpacity
              onPress={() => {
                if (!params.opponentId) {
                  router.push('/battles/friend-select');
                } else {
                  createMutation.mutate({
                    opponentId: params.opponentId,
                    examId: selectedExamId!,
                    subjectId: selectedSubjectId!,
                    level: selectedLevel,
                    betAmount,
                    durationSeconds: isCustomDuration ? (parseInt(customDurationMinutes) || 5) * 60 : durationSeconds,
                  });
                }
              }}
              disabled={createMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Send challenge. Bet: ${betAmount} coins. Winner takes ${betAmount * 2}.`}
              style={{
                backgroundColor: theme.buttonPrimary,
                borderRadius: radius.lg,
                paddingVertical: spacing.lg,
                alignItems: 'center',
                ...shadows.md,
                shadowColor: theme.primary,
                opacity: createMutation.isPending ? 0.7 : 1,
              }}
            >
              {createMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Typography variant="bodyBold" style={{ color: theme.buttonPrimaryText, fontSize: 16 }}>
                  {params.opponentName ? `Challenge ${params.opponentName} ⚔️` : 'Choose Opponent →'}
                </Typography>
              )}
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
              accessibilityRole="button"
              accessibilityLabel="Previous step"
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
            accessibilityRole="button"
            accessibilityLabel={step === 0 ? 'Next: Set stakes' : 'Next: Review challenge'}
            accessibilityState={{ disabled: step === 0 ? !canProceedStep0 : !canProceedStep1 }}
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
