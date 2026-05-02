// ─── Live Challenge Game ────────────────────────────────────
// The core gameplay screen: flashcards, live scoreboard, countdown.
// Improvements:
//  - Premium scoreboard with gradient header and player avatars
//  - Timer with animated low-time warning + pulse
//  - Question card with cleaner typography
//  - Options with letter-key bubbles + icon feedback
//  - Progress bar beneath scoreboard
//  - Game-over overlay with dramatic styling

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../src/theme';
import { spacing, radius, shadows } from '../../../src/theme/tokens';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../src/components/ui/Typography';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useGlobalUI } from '../../../src/contexts/GlobalUIContext';
import { useChallengeDetail, useSubmitAnswer } from '../../../src/hooks/useChallenge';
import { useChallengeSSE } from '../../../src/hooks/useChallengeSSE';
import { fetchDeckCards } from '../../../src/services/api-contracts';
import { Image } from 'expo-image';
import type { Flashcard } from '@kd/shared';

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

// ─── Pulsing timer ────────────────────────────────────────────
function TimerPill({ timeDisplay, isLowTime }: { timeDisplay: string; isLowTime: boolean }) {
  const { theme } = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isLowTime) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.08, { duration: 400 }), withTiming(1, { duration: 400 })),
        -1,
        true,
      );
    } else {
      pulse.value = 1;
    }
  }, [isLowTime]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View style={style}>
      <View
        style={{
          backgroundColor: isLowTime ? theme.error : '#6366F1',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          shadowColor: isLowTime ? theme.error : '#6366F1',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Ionicons name="timer" size={14} color="#FFF" />
        <Typography variant="label" color="#FFF" style={{ fontSize: 18, fontVariant: ['tabular-nums'] }}>
          {timeDisplay}
        </Typography>
      </View>
    </Animated.View>
  );
}

export default function ActiveChallengeScreen() {
  const { theme } = useTheme();
  const { showAlert } = useGlobalUI();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const { data: challenge } = useChallengeDetail(id ?? null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const challengeCreatorId = (challenge as { creatorId?: string } | undefined)?.creatorId;
  const myRole: 'creator' | 'opponent' | null = challenge
    ? (challengeCreatorId === user?.id ? 'creator' : 'opponent')
    : null;

  const sse = useChallengeSSE(id ?? null, myRole);
  const submitAnswer = useSubmitAnswer(id ?? '');

  useEffect(() => {
    let cancelled = false;
    if (challenge?.deckId) {
      fetchDeckCards(challenge.deckId)
        .then((c) => { if (!cancelled) setCards(c); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [challenge?.deckId]);

  useEffect(() => {
    if (sse.gameOver) {
      const timer = setTimeout(() => {
        router.replace(`/battles/result/${id}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [sse.gameOver, id, router]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const currentCard = cards[currentIndex];

  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!currentCard || showResult) return;
      setSelectedOption(optionId);
      setShowResult(true);

      const isCorrect = optionId === currentCard.correctAnswerId;
      Haptics.notificationAsync(
        isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      );

      submitAnswer.mutate({ cardId: currentCard.id, selectedAnswerId: optionId });

      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        setSelectedOption(null);
        setShowResult(false);
        setCurrentIndex((prev) => {
          const next = prev + 1;
          return next >= cards.length ? 0 : next;
        });
      }, 700);
    },
    [currentCard, showResult, submitAnswer, cards.length],
  );

  const seconds = Math.ceil(sse.timeRemainingMs / 1000);
  const timeDisplay = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const isLowTime = seconds <= 10;
  const progress = cards.length > 0 ? (currentIndex + 1) / cards.length : 0;

  if (!challenge || cards.length === 0) {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Typography variant="body" color={theme.textSecondary}>
            Loading challenge...
          </Typography>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* ── Forfeit button ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
        <TouchableOpacity
          onPress={() => {
            showAlert({
              title: 'Forfeit Match?',
              message: 'You will lose this challenge and any coins wagered.',
              type: 'info',
              buttons: [
                { text: 'Stay', style: 'cancel' },
                {
                  text: 'Forfeit',
                  style: 'destructive',
                  onPress: () => router.replace('/(tabs)/battles' as never),
                },
              ],
            });
          }}
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: 5,
            borderRadius: radius.full,
            backgroundColor: theme.errorMuted,
            borderWidth: 1,
            borderColor: theme.error + '33',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Ionicons name="flag" size={12} color={theme.error} />
          <Typography variant="captionBold" color={theme.error} style={{ fontSize: 11 }}>
            Forfeit
          </Typography>
        </TouchableOpacity>
      </View>

      {/* ── Scoreboard ── */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* You */}
        <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
          <View
            style={{
              width: 38, height: 38, borderRadius: radius.full,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Typography variant="label" color="#FFF" style={{ fontSize: 16 }}>
              {(user?.displayName ?? 'Y').charAt(0).toUpperCase()}
            </Typography>
          </View>
          <Typography variant="caption" color="rgba(255,255,255,0.8)" style={{ fontSize: 10 }}>You</Typography>
          <Typography variant="h2" color="#FFF">{sse.myScore}</Typography>
        </View>

        {/* Timer */}
        <TimerPill timeDisplay={timeDisplay} isLowTime={isLowTime} />

        {/* Opponent */}
        <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
          <View
            style={{
              width: 38, height: 38, borderRadius: radius.full,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Typography variant="label" color="#FFF" style={{ fontSize: 16 }}>
              {(challenge.opponentName ?? 'O').charAt(0).toUpperCase()}
            </Typography>
          </View>
          <Typography variant="caption" color="rgba(255,255,255,0.8)" style={{ fontSize: 10 }}>
            {challenge.opponentName}
          </Typography>
          <Typography variant="h2" color="rgba(255,255,255,0.9)">{sse.opponentScore}</Typography>
        </View>
      </LinearGradient>

      {/* ── Progress bar ── */}
      <View style={{ height: 3, backgroundColor: theme.border }}>
        <View
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: '#6366F1',
          }}
        />
      </View>

      {/* ── Card counter ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
        <Typography variant="caption" color={theme.textTertiary} align="center">
          Card {currentIndex + 1} of {cards.length}
        </Typography>
      </View>

      {/* ── Game Over overlay ── */}
      {sse.gameOver && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 100,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Animated.View
            entering={FadeInUp.delay(100).duration(350)}
            style={{
              backgroundColor: theme.card,
              borderRadius: radius['2xl'],
              padding: spacing['2xl'],
              alignItems: 'center',
              gap: spacing.md,
              ...shadows.lg,
              shadowColor: '#6366F1',
              borderWidth: 1.5,
              borderColor: '#6366F144',
              marginHorizontal: spacing.xl,
            }}
          >
            <Typography style={{ fontSize: 48 }}>⏱️</Typography>
            <Typography variant="h3">Time's Up!</Typography>
            <Typography variant="body" color={theme.textSecondary} align="center">
              Calculating results...
            </Typography>
            <ActivityIndicator size="small" color="#6366F1" />
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Question + Options ── */}
      {currentCard && (
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
          {/* Question card */}
          <Animated.View
            key={currentCard.id}
            entering={FadeInDown.duration(280)}
            style={{
              backgroundColor: theme.card,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: theme.border,
              minHeight: 100,
              justifyContent: 'center',
              gap: spacing.sm,
              ...shadows.sm,
              shadowColor: theme.shadow,
            }}
          >
            {/* Optional question image (diagrams / graphs) */}
            {currentCard.imageUrl ? (
              <View
                style={{
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: theme.border,
                  maxHeight: 140,
                }}
              >
                <Image
                  source={{ uri: currentCard.imageUrl }}
                  style={{ width: '100%', height: 130 }}
                  contentFit="contain"
                  transition={{ duration: 250, effect: 'cross-dissolve' }}
                  cachePolicy="memory-disk"
                />
              </View>
            ) : null}
            <Typography variant="label" style={{ fontSize: 15, lineHeight: 22 }}>
              {currentCard.question}
            </Typography>
          </Animated.View>

          {/* Options */}
          <View style={{ gap: spacing.sm }}>
            {currentCard.options.map((option, optIdx) => {
              const isSelected = selectedOption === option.id;
              const isCorrect = option.id === currentCard.correctAnswerId;
              const letterKey = OPTION_KEYS[optIdx] ?? 'A';

              let optionBg = theme.card;
              let optionBorder = theme.border;
              let keyBg = theme.primaryMuted;
              let keyColor = theme.primary;

              if (showResult && isSelected) {
                optionBg = isCorrect ? theme.successLight : theme.errorLight;
                optionBorder = isCorrect ? theme.success : theme.error;
                keyBg = isCorrect ? theme.success + '33' : theme.error + '33';
                keyColor = isCorrect ? theme.success : theme.error;
              } else if (showResult && isCorrect) {
                optionBg = theme.successLight;
                optionBorder = theme.success + '88';
                keyBg = theme.success + '33';
                keyColor = theme.success;
              }

              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => handleAnswer(option.id)}
                  disabled={showResult}
                  activeOpacity={0.78}
                  style={{
                    backgroundColor: optionBg,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    borderWidth: 1.5,
                    borderColor: optionBorder,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  {/* Letter key bubble */}
                  <View
                    style={{
                      width: 30, height: 30, borderRadius: radius.full,
                      backgroundColor: keyBg,
                      alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {showResult && isSelected ? (
                      <Ionicons
                        name={isCorrect ? 'checkmark' : 'close'}
                        size={16}
                        color={keyColor}
                      />
                    ) : (
                      <Typography variant="caption" color={keyColor} style={{ fontWeight: '700' }}>
                        {letterKey}
                      </Typography>
                    )}
                  </View>

                  <Typography variant="body" style={{ flex: 1, fontSize: 14 }}>
                    {option.text}
                  </Typography>

                  {/* Trailing result icon */}
                  {showResult && isSelected && (
                    <Ionicons
                      name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={20}
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
