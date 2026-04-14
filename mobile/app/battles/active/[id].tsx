// ─── Live Challenge Game ────────────────────────────────────
// The core gameplay screen: shows flashcards, live scoreboard,
// countdown timer, and SSE-driven score updates.

import { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../src/theme';
import { spacing, typography, radius, shadows } from '../../../src/theme/tokens';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../src/components/ui/Typography';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useChallengeDetail, useSubmitAnswer } from '../../../src/hooks/useChallenge';
import { useChallengeSSE } from '../../../src/hooks/useChallengeSSE';
import { fetchDeckCards } from '../../../src/services/api-contracts';
import type { Flashcard } from '@kd/shared';

export default function ActiveChallengeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const { data: challenge } = useChallengeDetail(id ?? null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Derive role by comparing the challenge's creatorId to the current user.
  // FIX L2: avoid `as any` — use typed property access with fallback.
  const challengeCreatorId = (challenge as { creatorId?: string } | undefined)?.creatorId;
  const myRole: 'creator' | 'opponent' | null = challenge
    ? (challengeCreatorId === user?.id ? 'creator' : 'opponent')
    : null;

  const sse = useChallengeSSE(id ?? null, myRole);
  const submitAnswer = useSubmitAnswer(id ?? '');

  // Fetch cards on mount
  useEffect(() => {
    if (challenge?.deckId) {
      fetchDeckCards(challenge.deckId).then(setCards).catch(() => {});
    }
  }, [challenge?.deckId]);

  // Navigate to results when game ends
  useEffect(() => {
    if (sse.gameOver) {
      const timer = setTimeout(() => {
        router.replace(`/battles/result/${id}` as never);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [sse.gameOver, id, router]);

  const currentCard = cards[currentIndex];
  const allCardsAnswered = currentIndex >= cards.length && cards.length > 0;

  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!currentCard || showResult) return;
      setSelectedOption(optionId);
      setShowResult(true);

      const isCorrect = optionId === currentCard.correctAnswerId;
      submitAnswer.mutate({ cardId: currentCard.id, selectedAnswerId: optionId });

      // Auto-advance after 600ms; cycle back to first card when deck is exhausted
      setTimeout(() => {
        setSelectedOption(null);
        setShowResult(false);
        setCurrentIndex((prev) => {
          const next = prev + 1;
          return next >= cards.length ? 0 : next;
        });
      }, 600);
    },
    [currentCard, showResult, submitAnswer, cards.length],
  );

  // Format time
  const seconds = Math.ceil(sse.timeRemainingMs / 1000);
  const timeDisplay = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const isLowTime = seconds <= 10;

  if (!challenge || cards.length === 0) {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Typography variant="body" style={{ color: theme.textSecondary, marginTop: spacing.md }}>
            Loading challenge...
          </Typography>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* ── Scoreboard Header ── */}
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Typography variant="caption" style={{ color: theme.textSecondary }}>You</Typography>
          <Typography variant="h3" style={{ color: theme.primary }}>{sse.myScore}</Typography>
        </View>

        {/* Timer */}
        <View
          style={{
            backgroundColor: isLowTime ? theme.errorMuted : theme.primaryMuted,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.full,
          }}
        >
          <Typography
            variant="bodyBold"
            style={{ color: isLowTime ? theme.error : theme.primary, fontSize: 18 }}
          >
            {timeDisplay}
          </Typography>
        </View>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Typography variant="caption" style={{ color: theme.textSecondary }}>
            {challenge.opponentName}
          </Typography>
          <Typography variant="h3" style={{ color: theme.error }}>{sse.opponentScore}</Typography>
        </View>
      </View>

      {/* ── Card Counter ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <Typography variant="caption" style={{ color: theme.textTertiary, textAlign: 'center' }}>
          Card {currentIndex + 1} of {cards.length}
        </Typography>
      </View>

      {/* ── Game Over overlay ── */}
      {sse.gameOver && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            backgroundColor: theme.overlay,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: radius.xl,
              padding: spacing['2xl'],
              alignItems: 'center',
              gap: spacing.md,
              ...shadows.lg,
              shadowColor: theme.shadow,
            }}
          >
            <Ionicons name="flag" size={48} color={theme.primary} />
            <Typography variant="h3">Time's Up!</Typography>
            <Typography variant="body" style={{ color: theme.textSecondary }}>
              Calculating results...
            </Typography>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        </Animated.View>
      )}

      {/* ── Question ── */}
      {currentCard && (
        <View style={{ flex: 1, padding: spacing.xl, gap: spacing.xl }}>
          <Animated.View
            key={currentCard.id}
            entering={FadeInDown.duration(300)}
            style={{
              backgroundColor: theme.card,
              borderRadius: radius.lg,
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: theme.border,
              minHeight: 120,
              justifyContent: 'center',
              ...shadows.sm,
              shadowColor: theme.shadow,
            }}
          >
            <Typography variant="bodyBold" style={{ fontSize: 16, lineHeight: 24 }}>
              {currentCard.question}
            </Typography>
          </Animated.View>

          {/* Options */}
          <View style={{ gap: spacing.md }}>
            {currentCard.options.map((option) => {
              const isSelected = selectedOption === option.id;
              const isCorrect = option.id === currentCard.correctAnswerId;
              let optionBg = theme.card;
              let optionBorder = theme.border;

              if (showResult && isSelected) {
                optionBg = isCorrect ? theme.successLight : theme.errorLight;
                optionBorder = isCorrect ? theme.success : theme.error;
              } else if (showResult && isCorrect) {
                optionBg = theme.successLight;
                optionBorder = theme.success;
              }

              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => handleAnswer(option.id)}
                  disabled={showResult}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: optionBg,
                    borderRadius: radius.md,
                    padding: spacing.lg,
                    borderWidth: 1.5,
                    borderColor: optionBorder,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  <Typography variant="body" style={{ flex: 1 }}>
                    {option.text}
                  </Typography>
                  {showResult && isSelected && (
                    <Ionicons
                      name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={22}
                      color={isCorrect ? theme.success : theme.error}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </ScreenWrapper>
  );
}
