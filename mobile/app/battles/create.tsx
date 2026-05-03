// ─── Create Challenge Wizard ────────────────────────────────
// 3-step flow: Content → Stakes → Review
// Improvements:
//  - Segmented step progress bar with labels
//  - Chip-style selectors with checkmark on selected
//  - Bet slider preview with "you could win X" calculation
//  - Review card uses icon rows
//  - Gradient submit button

import { useState } from 'react';
import {
  View, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
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

const BET_PRESETS = [10, 25, 50, 100, 250, 500];

const STEP_LABELS = ['Content', 'Stakes', 'Review'];

// ─── Reusable chip ────────────────────────────────────────────
function SelectChip({
  label,
  selected,
  onPress,
  accent = '#6366F1',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accent?: string;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: selected ? accent : theme.card,
        borderWidth: 1.5,
        borderColor: selected ? accent : theme.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {selected && <Ionicons name="checkmark" size={12} color="#FFF" />}
      <Typography
        variant="label"
        color={selected ? '#FFF' : theme.text}
        style={{ fontSize: 13 }}
      >
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

// ─── Section heading ──────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <Typography
      variant="label"
      color={theme.textTertiary}
      style={{ fontSize: 10, letterSpacing: 0.8, marginBottom: -spacing.xs }}
    >
      {label}
    </Typography>
  );
}

export default function CreateChallengeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ opponentId?: string; opponentName?: string }>();
  const createMutation = useCreateChallenge();
  const { data: coins } = useCoinBalance();

  const [step, setStep] = useState(0);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('Emerging');
  const [betAmount, setBetAmount] = useState(50);
  const [durationSeconds, setDurationSeconds] = useState(300);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationMinutes, setCustomDurationMinutes] = useState('25');

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

  const effectiveDurationSeconds = isCustomDuration
    ? (parseInt(customDurationMinutes) || 5) * 60
    : durationSeconds;

  function goNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => s + 1);
  }
  function goPrev() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => s - 1);
  }

  return (
    <ScreenWrapper>
      {/* ── Header ── */}
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.base,
          paddingBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/battles');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Typography variant="h4">Create Challenge</Typography>
          {params.opponentName && (
            <Typography variant="caption" color={theme.textTertiary}>
              vs {params.opponentName}
            </Typography>
          )}
        </View>
        {/* Coin balance */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: theme.coinLight,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
          }}
        >
          <Typography style={{ fontSize: 12 }}>🪙</Typography>
          <Typography variant="captionBold" color={theme.coin}>{balance}</Typography>
        </View>
      </View>

      {/* ── Segmented Step Progress ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {STEP_LABELS.map((label, i) => (
            <View key={label} style={{ flex: 1, gap: 4 }}>
              <View
                style={{
                  height: 4, borderRadius: 2,
                  backgroundColor: i <= step ? '#6366F1' : theme.border,
                }}
              />
              <Typography
                variant="caption"
                color={i <= step ? '#6366F1' : theme.textTertiary}
                style={{ fontSize: 10, textAlign: 'center' }}
              >
                {label}
              </Typography>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ Step 0: Content ═══ */}
        {step === 0 && (
          <Animated.View entering={FadeInRight.duration(280)} style={{ gap: spacing.xl }}>

            {/* Exam picker */}
            <View style={{ gap: spacing.md }}>
              <SectionLabel label="SELECT EXAM" />
              {examsLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {exams.map((exam) => (
                    <SelectChip
                      key={exam.id}
                      label={exam.title}
                      selected={selectedExamId === exam.id}
                      onPress={() => { setSelectedExamId(exam.id); setSelectedSubjectId(null); }}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Subject picker */}
            {selectedExamId && (
              <Animated.View entering={FadeInUp.duration(260)} style={{ gap: spacing.md }}>
                <SectionLabel label="SELECT SUBJECT" />
                {subjectsLoading ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {subjectsList.map((subject) => (
                      <SelectChip
                        key={subject.id}
                        label={subject.name}
                        selected={selectedSubjectId === subject.id}
                        onPress={() => setSelectedSubjectId(subject.id)}
                      />
                    ))}
                  </View>
                )}
              </Animated.View>
            )}

            {/* Level picker */}
            {selectedSubjectId && (
              <Animated.View entering={FadeInUp.duration(260)} style={{ gap: spacing.md }}>
                <SectionLabel label="SELECT LEVEL" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {SUBJECT_LEVELS.map((level) => (
                    <SelectChip
                      key={level}
                      label={level}
                      selected={selectedLevel === level}
                      onPress={() => setSelectedLevel(level)}
                      accent="#8B5CF6"
                    />
                  ))}
                </View>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* ═══ Step 1: Stakes ═══ */}
        {step === 1 && (
          <Animated.View entering={FadeInRight.duration(280)} style={{ gap: spacing.xl }}>

            {/* Duration */}
            <View style={{ gap: spacing.md }}>
              <SectionLabel label="MATCH DURATION" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {DURATIONS.map((d) => (
                  <SelectChip
                    key={d.value}
                    label={d.label}
                    selected={!isCustomDuration && durationSeconds === d.value}
                    onPress={() => { setIsCustomDuration(false); setDurationSeconds(d.value); }}
                    accent="#10B981"
                  />
                ))}
                <SelectChip
                  label="Custom"
                  selected={isCustomDuration}
                  onPress={() => setIsCustomDuration(true)}
                  accent="#10B981"
                />
              </View>

              {isCustomDuration && (
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    backgroundColor: theme.card,
                    borderRadius: radius.xl,
                    padding: spacing.md,
                    borderWidth: 1, borderColor: '#10B98144',
                  }}
                >
                  <Ionicons name="timer-outline" size={18} color="#10B981" />
                  <Typography variant="body" color={theme.textSecondary}>Minutes:</Typography>
                  <TextInput
                    value={customDurationMinutes}
                    onChangeText={setCustomDurationMinutes}
                    keyboardType="numeric"
                    placeholder="25"
                    placeholderTextColor={theme.textTertiary}
                    style={{
                      backgroundColor: theme.cardAlt,
                      color: theme.text,
                      borderColor: theme.border,
                      borderWidth: 1,
                      borderRadius: radius.lg,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      minWidth: 80,
                      textAlign: 'center',
                      fontSize: 14,
                    }}
                  />
                </View>
              )}
            </View>

            {/* Bet amount */}
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel label="BET AMOUNT" />
                <Typography variant="caption" color={theme.textTertiary}>
                  Balance: 🪙 {balance}
                </Typography>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {BET_PRESETS.filter((v) => v <= maxBet).map((v) => (
                  <SelectChip
                    key={v}
                    label={`🪙 ${v}`}
                    selected={betAmount === v}
                    onPress={() => setBetAmount(v)}
                    accent="#F59E0B"
                  />
                ))}
              </View>
            </View>

            {/* Prize preview card */}
            <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
              <LinearGradient
                colors={['#F59E0B', '#FBBF24']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  padding: spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <Typography style={{ fontSize: 28 }}>🏆</Typography>
                <View style={{ flex: 1 }}>
                  <Typography variant="h3" color="#FFF">{betAmount * 2} coins</Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.85)">
                    Winner takes all · Your bet: 🪙 {betAmount}
                  </Typography>
                </View>
              </LinearGradient>
            </View>
          </Animated.View>
        )}

        {/* ═══ Step 2: Review ═══ */}
        {step === 2 && (
          <Animated.View entering={FadeInRight.duration(280)} style={{ gap: spacing.xl }}>
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.xl,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              {/* Card header */}
              <LinearGradient
                colors={['#6366F1CC', '#8B5CF6CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Ionicons name="document-text-outline" size={18} color="#FFF" />
                <Typography variant="label" color="#FFF">Challenge Summary</Typography>
              </LinearGradient>

              {/* Rows */}
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                {[
                  { icon: 'person-outline' as const, label: 'Opponent', value: params.opponentName ?? '—' },
                  { icon: 'school-outline' as const, label: 'Exam', value: selectedExam?.title ?? '—' },
                  { icon: 'book-outline' as const, label: 'Subject', value: (selectedSubject as { name: string } | undefined)?.name ?? '—' },
                  { icon: 'bar-chart-outline' as const, label: 'Level', value: selectedLevel },
                  { icon: 'timer-outline' as const, label: 'Duration', value: isCustomDuration ? `${parseInt(customDurationMinutes) || 5} min` : `${durationSeconds / 60} min` },
                  { icon: 'cash-outline' as const, label: 'Your Bet', value: `🪙 ${betAmount}` },
                  { icon: 'trophy-outline' as const, label: 'Winner Takes', value: `🪙 ${betAmount * 2}` },
                ].map((row, i) => (
                  <View key={row.label}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: theme.border, marginBottom: spacing.md }} />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View
                        style={{
                          width: 30, height: 30, borderRadius: radius.md,
                          backgroundColor: theme.primaryMuted,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Ionicons name={row.icon} size={14} color={theme.primary} />
                      </View>
                      <Typography variant="body" color={theme.textSecondary} style={{ flex: 1 }}>
                        {row.label}
                      </Typography>
                      <Typography variant="label">{row.value}</Typography>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={() => {
                if (!params.opponentId) {
                  router.push('/battles/friend-select');
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  createMutation.mutate({
                    opponentId: params.opponentId,
                    examId: selectedExamId!,
                    subjectId: selectedSubjectId!,
                    level: selectedLevel,
                    betAmount,
                    durationSeconds: effectiveDurationSeconds,
                  });
                }
              }}
              disabled={createMutation.isPending}
              accessibilityRole="button"
              style={{ borderRadius: radius.xl, overflow: 'hidden', opacity: createMutation.isPending ? 0.7 : 1 }}
            >
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: spacing.lg,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={18} color="#FFF" />
                    <Typography variant="label" color="#FFF" style={{ fontSize: 16 }}>
                      {params.opponentName ? `Challenge ${params.opponentName}` : 'Choose Opponent →'}
                    </Typography>
                    {params.opponentName && <Typography style={{ fontSize: 16 }}>⚔️</Typography>}
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* ── Footer nav ── */}
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
              onPress={goPrev}
              accessibilityRole="button"
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: theme.cardAlt,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Typography variant="label" color={theme.textSecondary}>Back</Typography>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={goNext}
            disabled={step === 0 ? !canProceedStep0 : !canProceedStep1}
            accessibilityRole="button"
            style={{
              flex: 1,
              borderRadius: radius.xl,
              overflow: 'hidden',
              opacity: (step === 0 ? canProceedStep0 : canProceedStep1) ? 1 : 0.4,
            }}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: spacing.md,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Typography variant="label" color="#FFF">
                {step === 0 ? 'Next: Stakes' : 'Next: Review'}
              </Typography>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </ScreenWrapper>
  );
}
