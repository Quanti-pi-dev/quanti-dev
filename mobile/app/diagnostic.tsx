// ─── Diagnostic Placement Quiz ────────────────────────────────
// Optional placement quiz accessible from any subject card.
// 3 questions per level (12 total). Auto-unlocks levels based
// on performance — students who already know the material skip
// grinding through lower levels.

import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Header } from '../src/components/layout/Header';
import { Typography } from '../src/components/ui/Typography';
import { RichContent } from '../src/components/ui/RichContent';
import { Skeleton } from '../src/components/ui/Skeleton';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import {
  fetchDiagnosticDeck,
  submitDiagnosticResult,
  type DiagnosticCard,
  type DiagnosticResultResponse,
} from '../src/services/api-contracts';

// ─── Level colors ────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  Emerging:   '#6366F1',
  Skilled:    '#8B5CF6',
  Proficient: '#F59E0B',
  Master:     '#10B981',
};

// ─── Answer option ───────────────────────────────────────────

function DiagnosticAnswerOption({
  text,
  index,
  selected,
  correct,
  revealed,
  onPress,
}: {
  text: string;
  index: number;
  selected: boolean;
  correct: boolean;
  revealed: boolean;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  const labels = ['A', 'B', 'C', 'D'];

  const bg = revealed
    ? correct
      ? isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)'
      : selected ? isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' : theme.cardAlt
    : selected
      ? isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'
      : theme.cardAlt;

  const border = revealed
    ? correct ? '#10B981' : selected ? '#EF4444' : theme.border
    : selected ? theme.primary : theme.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={revealed}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
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
          backgroundColor: revealed
            ? correct ? '#10B98122' : selected ? '#EF444422' : theme.cardAlt
            : selected ? theme.primary + '22' : theme.cardAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="label"
          color={revealed ? (correct ? '#10B981' : selected ? '#EF4444' : theme.textTertiary) : selected ? theme.primary : theme.textTertiary}
          style={{ fontSize: 12 }}
        >
          {labels[index]}
        </Typography>
      </View>
      <RichContent variant="body" color={theme.text} style={{ flex: 1, fontSize: 14 }}>
        {text}
      </RichContent>
      {revealed && correct && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
      {revealed && selected && !correct && <Ionicons name="close-circle" size={18} color="#EF4444" />}
    </TouchableOpacity>
  );
}

// ─── Results screen ──────────────────────────────────────────

function DiagnosticResults({
  result,
  subjectName,
  onDone,
}: {
  result: DiagnosticResultResponse;
  subjectName: string;
  onDone: () => void;
}) {
  const { theme, isDark } = useTheme();
  const color = LEVEL_COLORS[result.unlockedUpTo] ?? theme.primary;
  const didUnlock = result.unlockedCount > 1;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, alignItems: 'center' }}
    >
      <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center', gap: spacing.lg, width: '100%' }}>
        {/* Icon */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: color + '18',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={didUnlock ? 'trophy' : 'school'}
            size={36}
            color={color}
          />
        </View>

        {/* Headline */}
        <Typography variant="h2" align="center">
          {didUnlock ? 'Great news!' : 'You\'re all set!'}
        </Typography>

        {didUnlock ? (
          <Typography variant="body" color={theme.textSecondary} align="center">
            Based on your placement quiz, we've unlocked up to{' '}
            <Typography variant="bodySemiBold" color={color}>
              {result.unlockedUpTo}
            </Typography>{' '}
            level for all topics in {subjectName}. You can start from where your knowledge is strongest.
          </Typography>
        ) : (
          <Typography variant="body" color={theme.textSecondary} align="center">
            You'll start from the <Typography variant="bodySemiBold">Emerging</Typography> level in {subjectName}. Levels unlock as you answer more questions correctly.
          </Typography>
        )}

        {/* Stats */}
        {didUnlock && (
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
              <Typography variant="caption" color={theme.textTertiary}>Unlocked up to</Typography>
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: color + '18',
                }}
              >
                <Typography variant="caption" color={color}>{result.unlockedUpTo}</Typography>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Typography variant="caption" color={theme.textTertiary}>Topics unlocked</Typography>
              <Typography variant="label" color={theme.text}>{result.topicsUnlocked}</Typography>
            </View>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          onPress={onDone}
          activeOpacity={0.8}
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: color,
            borderRadius: radius.xl,
            paddingVertical: spacing.md + 4,
          }}
        >
          <Ionicons name="play-circle" size={18} color="#FFFFFF" />
          <Typography variant="label" color="#FFFFFF">
            Start Studying {subjectName}
          </Typography>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function DiagnosticScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { examId, subjectId, subjectName } = useLocalSearchParams<{
    examId: string;
    subjectId: string;
    subjectName?: string;
  }>();

  const displayName = subjectName ?? 'Subject';
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<{ cardId: string; level: string; correct: boolean }[]>([]);
  const [result, setResult] = useState<DiagnosticResultResponse | null>(null);

  const { data: deck, isLoading } = useQuery({
    queryKey: ['diagnosticDeck', examId, subjectId],
    queryFn: () => fetchDiagnosticDeck(examId, subjectId),
    enabled: !!examId && !!subjectId,
    staleTime: 5 * 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: ({ results }: { results: typeof answers }) =>
      submitDiagnosticResult(examId, subjectId, results),
    onSuccess: (data) => setResult(data),
  });

  const cards = deck?.cards ?? [];
  const currentCard = cards[currentIdx];
  const currentLevel = currentCard?.level ?? '';
  const levelColor = LEVEL_COLORS[currentLevel] ?? theme.primary;
  const progress = cards.length > 0 ? (currentIdx + (revealed ? 1 : 0)) / cards.length : 0;

  const handleSelect = useCallback((optionId: string) => {
    if (revealed) return;
    setSelectedId(optionId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [revealed]);

  const handleReveal = useCallback(() => {
    if (!selectedId || !currentCard) return;
    setRevealed(true);
    const correct = selectedId === currentCard.correctAnswerId;
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setAnswers(prev => [...prev, {
      cardId: currentCard.cardId,
      level: currentCard.level,
      correct,
    }]);
  }, [selectedId, currentCard]);

  const handleNext = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= cards.length) {
      // Submit
      const finalAnswers = [...answers];
      submitMutation.mutate({ results: finalAnswers });
    } else {
      setCurrentIdx(nextIdx);
      setSelectedId(null);
      setRevealed(false);
    }
  }, [currentIdx, cards.length, answers, submitMutation]);

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenWrapper>
        <Header showBack title="Placement Quiz" />
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <Skeleton height={160} borderRadius={radius['2xl']} />
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height={56} borderRadius={radius.xl} />)}
        </View>
      </ScreenWrapper>
    );
  }

  // ── Results ──────────────────────────────────────────────────
  if (result) {
    return (
      <ScreenWrapper>
        <Header showBack title="Placement Results" />
        <DiagnosticResults
          result={result}
          subjectName={displayName}
          onDone={() => router.back()}
        />
      </ScreenWrapper>
    );
  }

  // ── Empty ────────────────────────────────────────────────────
  if (!isLoading && cards.length === 0) {
    return (
      <ScreenWrapper>
        <Header showBack title="Placement Quiz" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
          <Typography variant="body" color={theme.textSecondary} align="center">
            No diagnostic cards available for {displayName} yet. Start from Emerging level and unlock higher levels as you progress.
          </Typography>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: theme.primary,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
            }}
          >
            <Typography variant="label" color="#FFFFFF">Start Studying</Typography>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  // ── Pre-start ────────────────────────────────────────────────
  if (!started) {
    return (
      <ScreenWrapper>
        <Header showBack title="Placement Quiz" />
        <ScrollView
          contentContainerStyle={{
            padding: spacing.xl,
            gap: spacing.lg,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', gap: spacing.lg }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="telescope-outline" size={32} color={theme.primary} />
            </View>

            <Typography variant="h2" align="center">
              {displayName} Placement
            </Typography>
            <Typography variant="body" color={theme.textSecondary} align="center">
              Answer {cards.length} quick questions across levels. We'll unlock the right starting point for you — no need to repeat what you already know.
            </Typography>

            {/* Level breakdown */}
            <View style={{ width: '100%', gap: spacing.sm }}>
              {['Emerging', 'Skilled', 'Proficient', 'Master'].map(level => {
                const count = cards.filter(c => c.level === level).length;
                const color = LEVEL_COLORS[level] ?? theme.primary;
                return count > 0 ? (
                  <View
                    key={level}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: spacing.sm,
                      borderRadius: radius.lg,
                      backgroundColor: color + '10',
                      borderWidth: 1,
                      borderColor: color + '20',
                    }}
                  >
                    <Typography variant="caption" color={color}>{level}</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>{count} questions</Typography>
                  </View>
                ) : null;
              })}
            </View>

            <TouchableOpacity
              onPress={() => setStarted(true)}
              activeOpacity={0.85}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: theme.primary,
                borderRadius: radius.xl,
                paddingVertical: spacing.md + 4,
              }}
            >
              <Ionicons name="play-circle" size={18} color="#FFFFFF" />
              <Typography variant="label" color="#FFFFFF">Begin Placement</Typography>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Typography variant="caption" color={theme.textTertiary}>
                Skip — start from Emerging level
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // ── Active quiz ──────────────────────────────────────────────
  return (
    <ScreenWrapper>
      <Header showBack title={`${displayName} Placement`} />

      {/* Level indicator + progress */}
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.full,
              backgroundColor: levelColor + '18',
            }}
          >
            <Typography variant="caption" color={levelColor} style={{ fontSize: 11 }}>
              {currentLevel} Level
            </Typography>
          </View>
          <Typography variant="caption" color={theme.textTertiary}>
            {currentIdx + 1} / {cards.length}
          </Typography>
        </View>
        <ProgressBar progress={progress} height={4} color={levelColor} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
      >
        {currentCard && (
          <Animated.View entering={FadeIn.duration(200)} key={currentIdx}>
            <RichContent variant="h4" color={theme.text} style={{ lineHeight: 26, marginBottom: spacing.md }}>
              {currentCard.question}
            </RichContent>

            <View style={{ gap: spacing.sm }}>
              {currentCard.answers.map((ans, i) => (
                <DiagnosticAnswerOption
                  key={ans.id}
                  text={ans.text}
                  index={i}
                  selected={selectedId === ans.id}
                  correct={ans.id === currentCard.correctAnswerId}
                  revealed={revealed}
                  onPress={() => handleSelect(ans.id)}
                />
              ))}
            </View>

            {/* Confirm / Next button */}
            {!revealed ? (
              <TouchableOpacity
                onPress={handleReveal}
                disabled={!selectedId}
                activeOpacity={0.8}
                style={{
                  marginTop: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  backgroundColor: selectedId ? levelColor : theme.border,
                  borderRadius: radius.xl,
                  paddingVertical: spacing.md + 2,
                }}
              >
                <Typography variant="label" color={selectedId ? '#FFFFFF' : theme.textTertiary}>
                  Confirm Answer
                </Typography>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleNext}
                disabled={submitMutation.isPending}
                activeOpacity={0.8}
                style={{
                  marginTop: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  backgroundColor: levelColor,
                  borderRadius: radius.xl,
                  paddingVertical: spacing.md + 2,
                }}
              >
                <Typography variant="label" color="#FFFFFF">
                  {currentIdx < cards.length - 1 ? 'Next Question' : submitMutation.isPending ? 'Calculating…' : 'See Results'}
                </Typography>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
