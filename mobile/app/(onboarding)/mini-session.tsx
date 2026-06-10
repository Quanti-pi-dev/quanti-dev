// ─── Onboarding: "Taste of Mastery" Mini-Session ────────────
// Phase 1 — Gamified Onboarding: Fire the habit loop.
// A 3-card flashcard session during onboarding that lets the
// student experience the core product before they leave setup.
//
// Psychology: Trigger → Action → Reward loop. The student
// answers 3 cards, receives coins, and sees their first stats.
// This seeds BKT/SM-2 models and creates the endowed progress effect.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
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
  withDelay,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { RichContent } from '../../src/components/ui/RichContent';
import { Button } from '../../src/components/ui/Button';
import {
  fetchDiagnosticDeck,
  submitDiagnosticResult,
  type DiagnosticCard,
} from '../../src/services/api-contracts';
import { api } from '../../src/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MINI_SESSION_SIZE = 3;

// ─── Coin Burst Particle ────────────────────────────────────
const COIN_COLORS = ['#F59E0B', '#FCD34D', '#FBBF24', '#D97706', '#F59E0B'];

function CoinParticle({ delay, startX }: { delay: number; startX: number }) {
  const y = useSharedValue(0);
  const x = useSharedValue(startX);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);
  const rotate = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(600, withTiming(0, { duration: 400 })),
    ));
    scale.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 200, easing: Easing.out(Easing.back(2)) }),
      withDelay(500, withTiming(0.5, { duration: 300 })),
    ));
    y.value = withDelay(delay,
      withTiming(-120 - Math.random() * 80, { duration: 800, easing: Easing.out(Easing.quad) }),
    );
    x.value = withDelay(delay,
      withTiming(startX + (Math.random() - 0.5) * 100, { duration: 800 }),
    );
    rotate.value = withDelay(delay,
      withRepeat(withTiming(360, { duration: 500 }), 2, false),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: COIN_COLORS[Math.floor(Math.random() * COIN_COLORS.length)],
          borderWidth: 1.5,
          borderColor: '#D97706',
        },
      ]}
    />
  );
}

// ─── Answer Option ──────────────────────────────────────────
function AnswerOption({
  answer,
  index,
  selected,
  correct,
  revealed,
  onPress,
}: {
  answer: { id: string; text: string; imageUrl?: string | null };
  index: number;
  selected: boolean;
  correct: boolean;
  revealed: boolean;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  const letters = ['A', 'B', 'C', 'D'];

  const isCorrectAnswer = revealed && correct;
  const isWrongSelection = revealed && selected && !correct;

  let borderColor = theme.border;
  let bgColor = theme.card;
  let letterBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  let letterColor = theme.textSecondary;

  if (isCorrectAnswer) {
    borderColor = '#10B981';
    bgColor = isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)';
    letterBg = '#10B981';
    letterColor = '#FFFFFF';
  } else if (isWrongSelection) {
    borderColor = '#EF4444';
    bgColor = isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.06)';
    letterBg = '#EF4444';
    letterColor = '#FFFFFF';
  } else if (selected && !revealed) {
    borderColor = theme.primary;
    bgColor = isDark ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.06)';
    letterBg = theme.primary;
    letterColor = '#FFFFFF';
  }

  return (
    <Animated.View entering={FadeInDown.delay(300 + index * 80).duration(350).springify()}>
      <TouchableOpacity
        onPress={onPress}
        disabled={revealed}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: answer.imageUrl ? 'flex-start' : 'center',
          padding: spacing.md,
          borderRadius: radius.xl,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: bgColor,
          gap: spacing.md,
        }}
      >
        {/* Letter badge */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            backgroundColor: letterBg,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: answer.imageUrl ? 2 : 0,
          }}
        >
          {revealed && isCorrectAnswer ? (
            <Ionicons name="checkmark" size={16} color={letterColor} />
          ) : revealed && isWrongSelection ? (
            <Ionicons name="close" size={16} color={letterColor} />
          ) : (
            <Typography variant="bodySemiBold" color={letterColor}>
              {letters[index]}
            </Typography>
          )}
        </View>

        {/* Text + optional image */}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <RichContent variant="body" color={theme.text}>
            {answer.text}
          </RichContent>
          {answer.imageUrl ? (
            <Image
              source={{ uri: answer.imageUrl }}
              style={{ width: '100%', aspectRatio: 16 / 9, minHeight: 80, borderRadius: radius.md, marginTop: 4 }}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Progress Dots ──────────────────────────────────────────
function ProgressDots({
  total,
  current,
  results,
}: {
  total: number;
  current: number;
  results: (boolean | null)[];
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        let bg = theme.border;
        if (results[i] === true) bg = '#10B981';
        else if (results[i] === false) bg = '#EF4444';
        else if (i === current) bg = theme.primary;

        return (
          <View
            key={i}
            style={{
              width: i === current ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: bg,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────

type SessionResult = { cardId: string; level: string; correct: boolean };

export default function MiniSessionScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const {
    examIds,
    selectedSubjects,
    examDate,
    preferredStudyTime,
    dailyCardTarget,
    totalSteps: totalStepsParam,
    // Phase 3: personality fields passed from study-personality
    studyPersonality,
    motivationType,
    sessionPreference,
  } = useLocalSearchParams<{
    examIds: string;
    selectedSubjects: string;
    examDate?: string;
    preferredStudyTime?: string;
    dailyCardTarget?: string;
    totalSteps: string;
    studyPersonality?: string;
    motivationType?: string;
    sessionPreference?: string;
  }>();

  const [cards, setCards] = useState<DiagnosticCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<(boolean | null)[]>([null, null, null]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [phase, setPhase] = useState<'loading' | 'playing' | 'reward'>('loading');
  const [coinsEarned] = useState(5); // Starter coins
  const [loadError, setLoadError] = useState(false);
  const responseStartTime = useRef(Date.now());

  // Parse exam/subject IDs for API call
  const examIdArray = useMemo(() => examIds?.split(',').filter(Boolean) ?? [], [examIds]);
  const subjectIdArray = useMemo(() => selectedSubjects?.split(',').filter(Boolean) ?? [], [selectedSubjects]);

  // Fetch 3 cards from the student's first selected subject
  useEffect(() => {
    (async () => {
      try {
        if (examIdArray.length === 0 || subjectIdArray.length === 0) {
          // No subjects selected — skip mini-session
          navigateToComplete(0, 0, 0);
          return;
        }

        const examId = examIdArray[0]!;
        const subjectId = subjectIdArray[0]!;
        const deck = await fetchDiagnosticDeck(examId, subjectId);

        if (!deck.cards || deck.cards.length === 0) {
          // No cards available — skip gracefully
          navigateToComplete(0, 0, 0);
          return;
        }

        // Take only 3 cards (preferring Emerging level for approachability)
        const emergingCards = deck.cards.filter(c => c.level === 'Emerging');
        const selectedCards = (emergingCards.length >= MINI_SESSION_SIZE
          ? emergingCards
          : deck.cards
        ).slice(0, MINI_SESSION_SIZE);

        setCards(selectedCards);
        setResults(selectedCards.map(() => null));
        setPhase('playing');
        responseStartTime.current = Date.now();
      } catch {
        setLoadError(true);
        // After 2s, skip to completion if loading fails
        setTimeout(() => navigateToComplete(0, 0, 0), 2000);
      }
    })();
  }, []);

  const currentCard = cards[currentIndex];

  // ─── Handle answer selection ───────────────────────────────
  const handleSelectAnswer = useCallback((answerId: string) => {
    if (revealed || !currentCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAnswerId(answerId);
  }, [revealed, currentCard]);

  // ─── Handle confirm answer ─────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!selectedAnswerId || !currentCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isCorrect = selectedAnswerId === currentCard.correctAnswerId;
    setRevealed(true);

    // Update results
    setResults(prev => {
      const next = [...prev];
      next[currentIndex] = isCorrect;
      return next;
    });

    // Record result
    setSessionResults(prev => [
      ...prev,
      { cardId: currentCard.cardId, level: currentCard.level, correct: isCorrect },
    ]);

    // Haptic feedback based on correctness
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [selectedAnswerId, currentCard, currentIndex]);

  // ─── Handle next card ──────────────────────────────────────
  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswerId(null);
      setRevealed(false);
      responseStartTime.current = Date.now();
    } else {
      // Session complete — show reward phase
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('reward');
      submitResultsAndAwardCoins();
    }
  }, [currentIndex, cards.length]);

  // ─── Submit results to backend (fire-and-forget) ───────────
  const submitResultsAndAwardCoins = async () => {
    try {
      if (examIdArray.length > 0 && subjectIdArray.length > 0 && sessionResults.length > 0) {
        // Submit diagnostic results to seed BKT/SM-2
        await submitDiagnosticResult(
          examIdArray[0]!,
          subjectIdArray[0]!,
          // Include the last answer that was just recorded
          [...sessionResults, sessionResults.length < cards.length ? {
            cardId: cards[cards.length - 1]!.cardId,
            level: cards[cards.length - 1]!.level,
            correct: results[cards.length - 1] ?? false,
          } : undefined].filter(Boolean) as SessionResult[],
        );
      }

      // Award starter coins
      await api.post('/gamify/starter-coins', { amount: coinsEarned, reason: 'onboarding_mini_session' }).catch(() => {
        // Non-critical — coins can be awarded later
      });
    } catch {
      // Non-critical — BKT seeding failure doesn't block onboarding
    }
  };

  // ─── Navigate to completion ────────────────────────────────
  const navigateToComplete = useCallback((correct: number, total: number, coins: number) => {
    router.push({
      pathname: '/(onboarding)/complete',
      params: {
        examIds: examIds ?? '',
        selectedSubjects: selectedSubjects ?? '',
        examDate: examDate ?? '',
        preferredStudyTime: preferredStudyTime ?? '',
        dailyCardTarget: dailyCardTarget ?? '',
        totalSteps: totalStepsParam ?? '4',
        miniSessionCorrect: String(correct),
        miniSessionTotal: String(total),
        miniSessionCoins: String(coins),
        // Phase 3: Forward personality fields to completion screen
        studyPersonality: studyPersonality ?? '',
        motivationType: motivationType ?? '',
        sessionPreference: sessionPreference ?? '',
      },
    });
  }, [router, examIds, selectedSubjects, examDate, preferredStudyTime, dailyCardTarget, totalStepsParam, studyPersonality, motivationType, sessionPreference]);

  // ─── Coin particles (must be at top level — Rules of Hooks) ──
  const coinParticles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        key: i,
        delay: i * 60,
        startX: (Math.random() - 0.5) * 60,
      })),
    [],
  );

  const handleFinishReward = useCallback(() => {
    const correctCount = results.filter(r => r === true).length;
    navigateToComplete(correctCount, cards.length, coinsEarned);
  }, [results, cards.length, coinsEarned, navigateToComplete]);

  // ─── Loading State ─────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, position: 'relative' }}>
          <LinearGradient
            colors={
              isDark
                ? ['rgba(96,165,250,0.06)', 'transparent', 'rgba(245,158,11,0.06)']
                : ['rgba(37,99,235,0.04)', 'transparent', 'rgba(245,158,11,0.03)']
            }
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}>
            <Animated.View entering={FadeIn.duration(400)}>
              <Typography style={{ fontSize: 56 }}>🎮</Typography>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Typography variant="h3" align="center">
                {loadError ? 'Couldn\'t load cards...' : 'Preparing your first challenge...'}
              </Typography>
            </Animated.View>
            {!loadError && (
              <Animated.View entering={FadeInDown.delay(400).duration(400)}>
                <Typography variant="body" color={theme.textSecondary} align="center">
                  3 quick questions from your subjects
                </Typography>
              </Animated.View>
            )}
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  // ─── Reward Phase ──────────────────────────────────────────
  if (phase === 'reward') {
    const correctCount = results.filter(r => r === true).length;
    const allCorrect = correctCount === cards.length;

    return (
      <ScreenWrapper>
        <View style={{ flex: 1, position: 'relative' }}>
          <LinearGradient
            colors={
              isDark
                ? ['rgba(245,158,11,0.08)', 'transparent', 'rgba(16,185,129,0.06)']
                : ['rgba(245,158,11,0.04)', 'transparent', 'rgba(16,185,129,0.03)']
            }
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <Animated.View
            entering={FadeIn.duration(400)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.xl,
              gap: spacing['2xl'],
            }}
          >
            {/* Score ring */}
            <Animated.View entering={FadeInDown.delay(200).duration(500).springify()}>
              <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {/* Coin particles */}
                {coinParticles.map(p => (
                  <CoinParticle key={p.key} delay={p.delay} startX={p.startX} />
                ))}

                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    ...Platform.select({
                      ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24 },
                      android: { elevation: 16 },
                    }),
                  }}
                >
                  <LinearGradient
                    colors={allCorrect ? ['#10B981', '#059669'] : ['#F59E0B', '#D97706']}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Typography style={{ fontSize: 36, fontWeight: '900', color: '#FFFFFF' }}>
                    {correctCount}/{cards.length}
                  </Typography>
                </View>
              </View>
            </Animated.View>

            {/* Result message */}
            <View style={{ gap: spacing.sm, alignItems: 'center' }}>
              <Animated.View entering={FadeInDown.delay(500).duration(400).springify()}>
                <Typography variant="h2" align="center">
                  {allCorrect
                    ? 'Perfect! 🎯'
                    : correctCount > 0
                      ? 'Great start! 🚀'
                      : 'No worries! 💪'}
                </Typography>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(700).duration(400)}>
                <Typography variant="body" align="center" color={theme.textSecondary}>
                  {allCorrect
                    ? 'You nailed every question — the adaptive engine will match your level.'
                    : correctCount > 0
                      ? `You got ${correctCount} out of ${cards.length} right. Your learning journey starts now!`
                      : 'Every expert was once a beginner. Our AI adapts to your level.'}
                </Typography>
              </Animated.View>
            </View>

            {/* Coins earned pill */}
            <Animated.View
              entering={FadeInUp.delay(900).duration(400).springify()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
                borderRadius: radius.full,
                borderWidth: 1.5,
                borderColor: isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.2)',
              }}
            >
              <Ionicons name="logo-bitcoin" size={22} color="#F59E0B" />
              <Typography variant="bodySemiBold" color="#F59E0B">
                +{coinsEarned} coins earned!
              </Typography>
            </Animated.View>

            {/* CTA */}
            <Animated.View entering={FadeInUp.delay(1100).duration(400)} style={{ width: '100%' }}>
              <Button
                fullWidth
                size="lg"
                onPress={handleFinishReward}
                style={{ marginTop: spacing.md }}
                icon={<Ionicons name="arrow-forward" size={18} color={theme.buttonPrimaryText} />}
                iconPosition="right"
              >
                See My Profile
              </Button>
            </Animated.View>
          </Animated.View>
        </View>
      </ScreenWrapper>
    );
  }

  // ─── Playing Phase (main quiz) ─────────────────────────────
  return (
    <ScreenWrapper>
      <View style={{ flex: 1, position: 'relative' }}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(96,165,250,0.06)', 'transparent', 'rgba(99,102,241,0.04)']
              : ['rgba(37,99,235,0.03)', 'transparent', 'rgba(99,102,241,0.02)']
          }
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'] }}>
          {/* Header: progress + card count */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.xl,
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <Typography variant="overline" color={theme.textTertiary}>
                YOUR FIRST CHALLENGE
              </Typography>
              <Typography variant="h3">
                Question {currentIndex + 1} of {cards.length}
              </Typography>
            </View>
            <View
              style={{
                backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              <Ionicons name="logo-bitcoin" size={14} color="#F59E0B" />
              <Typography variant="caption" color="#F59E0B">+5</Typography>
            </View>
          </Animated.View>

          {/* Progress dots */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginBottom: spacing.xl }}>
            <ProgressDots total={cards.length} current={currentIndex} results={results} />
          </Animated.View>

          {/* Question card */}
          {currentCard && (
            <Animated.View
              key={`card-${currentIndex}`}
              entering={FadeIn.duration(300)}
              style={{
                backgroundColor: theme.card,
                borderRadius: radius['2xl'],
                padding: spacing.xl,
                marginBottom: spacing.xl,
                borderWidth: 1,
                borderColor: theme.border,
                ...Platform.select({
                  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
                  android: { elevation: 4 },
                }),
              }}
            >
              <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: spacing.sm }}>
                {currentCard.topicName}
              </Typography>
              {currentCard.imageUrl ? (
                <View
                  style={{
                    borderRadius: radius.lg,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: theme.border,
                    marginBottom: spacing.sm,
                  }}
                >
                  <Image
                    source={{ uri: currentCard.imageUrl }}
                    style={{ width: '100%', aspectRatio: 16 / 9, minHeight: 120 }}
                    contentFit="contain"
                    transition={{ duration: 250, effect: 'cross-dissolve' }}
                    cachePolicy="memory-disk"
                  />
                </View>
              ) : null}
              <RichContent variant="bodySemiBold" color={theme.text} style={{ lineHeight: 24 }}>
                {currentCard.question}
              </RichContent>
            </Animated.View>
          )}

          {/* Answer options */}
          {currentCard && (
            <View style={{ gap: spacing.sm }}>
              {currentCard.answers.map((answer, index) => (
                <AnswerOption
                  key={answer.id}
                  answer={answer}
                  index={index}
                  selected={selectedAnswerId === answer.id}
                  correct={answer.id === currentCard.correctAnswerId}
                  revealed={revealed}
                  onPress={() => handleSelectAnswer(answer.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Bottom CTA */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={{
            padding: spacing.xl,
            paddingBottom: spacing['2xl'],
          }}
        >
          {!revealed ? (
            <Button
              fullWidth
              size="lg"
              disabled={!selectedAnswerId}
              onPress={handleConfirm}
            >
              Check Answer
            </Button>
          ) : (
            <Button
              fullWidth
              size="lg"
              onPress={handleNext}
              icon={<Ionicons name="arrow-forward" size={18} color={theme.buttonPrimaryText} />}
              iconPosition="right"
            >
              {currentIndex < cards.length - 1 ? 'Next Question' : 'See My Results'}
            </Button>
          )}
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}
