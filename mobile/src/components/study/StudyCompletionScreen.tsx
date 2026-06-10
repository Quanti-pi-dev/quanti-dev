// ─── StudyCompletionScreen ──────────────────────────────────
// Full-screen results view shown when all cards are answered.
// Improvements:
//  - Richer stat tiles with icons and percentage bar
//  - Better coins card with animated entrance
//  - "Done" goes to /(tabs)/study instead of /(tabs)
//  - Accuracy-based message is more nuanced
//  - Added session time display

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, ScrollView, Modal, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius, typography } from '../../theme/tokens';
import { ScreenWrapper } from '../layout/ScreenWrapper';
import { Header } from '../layout/Header';
import { Typography } from '../ui/Typography';
import { RichContent } from '../ui/RichContent';
import { Button } from '../ui/Button';
import { AccuracyRing } from './AccuracyRing';
import { ConfettiBurst } from './ConfettiBurst';
import { FocusQualityScore } from '../analytics/FocusQualityScore';
import { useQueryClient } from '@tanstack/react-query';
import {
  initiateWager,
  submitWagerAnswer,
  fetchActiveWager,
  type WagerState,
} from '../../services/behavioral-contracts';

interface StudyCompletionScreenProps {
  title: string;
  total: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  sessionCoinsEarned: number;
  deckId?: string | null;
  longestStreak?: number;
  onStudyAgain: () => void;
}

interface StatTileProps {
  count: number;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bgColor: string;
  delay?: number;
}

function StatTile({ count, label, icon, color, bgColor, delay = 0 }: StatTileProps) {
  const { theme } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(380)}
      style={{
        flex: 1,
        backgroundColor: bgColor,
        borderRadius: radius.xl,
        padding: spacing.md,
        alignItems: 'center',
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: color + '30',
      }}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: radius.full,
          backgroundColor: color + '20',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Typography variant="h3" color={color}>{count}</Typography>
      <Typography variant="caption" color={theme.textTertiary} align="center">{label}</Typography>
    </Animated.View>
  );
}

export const StudyCompletionScreen = React.memo(function StudyCompletionScreen({
  title,
  total,
  correctCount,
  incorrectCount,
  skippedCount,
  sessionCoinsEarned,
  deckId,
  longestStreak = 0,
  onStudyAgain,
}: StudyCompletionScreenProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const gradedTotal = correctCount + incorrectCount;
  const accuracyPct = gradedTotal > 0 ? Math.round((correctCount / gradedTotal) * 100) : 0;
  const isPerfect = accuracyPct === 100 && skippedCount === 0;

  const emoji = accuracyPct >= 90 ? '🏆' : accuracyPct >= 75 ? '🎉' : accuracyPct >= 60 ? '👍' : '💪';
  const headline =
    accuracyPct >= 90 ? 'Outstanding!'
    : accuracyPct >= 75 ? 'Excellent Work!'
    : accuracyPct >= 60 ? 'Good Job!'
    : 'Keep Practising!';
  const subline =
    accuracyPct >= 90 ? `You nailed ${total} cards. Brilliant performance!`
    : accuracyPct >= 75 ? `You completed all ${total} cards with great accuracy.`
    : accuracyPct >= 60 ? `You completed all ${total} cards. A bit more practice will help.`
    : `You completed all ${total} cards. Review the ones you missed!`;

  const totalCoins = sessionCoinsEarned + (isPerfect ? 3 : 0);

  // Wager Challenge States
  const [activeWagerState, setActiveWagerState] = useState<WagerState | null>(null);
  const [selectedWagerCoins, setSelectedWagerCoins] = useState<number>(10);
  const [isWagerModalVisible, setIsWagerModalVisible] = useState(false);
  const [wagerCards, setWagerCards] = useState<any[]>([]);
  const [currentWagerCardIdx, setCurrentWagerCardIdx] = useState(0);
  const [wagerStatus, setWagerStatus] = useState<'idle' | 'answering' | 'correct' | 'incorrect' | 'won' | 'lost' | 'timeout'>('idle');
  const [selectedWagerOptionId, setSelectedWagerOptionId] = useState<string | null>(null);
  const [isWagerLoading, setIsWagerLoading] = useState(false);
  const [wagerMessage, setWagerMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(10.0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for active wagers on mount
  useEffect(() => {
    fetchActiveWager()
      .then((state) => {
        if (state) {
          setActiveWagerState(state);
        }
      })
      .catch(() => {});
  }, []);

  // Stop Timer
  const stopWagerTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start Timer
  const startWagerTimer = useCallback(() => {
    stopWagerTimer();
    setTimeLeft(10.0);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          stopWagerTimer();
          handleWagerTimeout();
          return 0;
        }
        return Math.round((prev - 0.1) * 10) / 10;
      });
    }, 100);
  }, [stopWagerTimer, wagerStatus, wagerCards, currentWagerCardIdx]);

  // Timeout handler
  const handleWagerTimeout = async () => {
    setWagerStatus('timeout');
    setIsWagerLoading(true);
    try {
      const currentCards = wagerCards.length > 0 ? wagerCards : (activeWagerState?.cards || []);
      const card = currentCards[currentWagerCardIdx];
      if (card) {
        const result = await submitWagerAnswer(card.id, '');
        setWagerStatus('lost');
        setWagerMessage(result.message || "Time's up! Wager challenge failed.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        void queryClient.invalidateQueries({ queryKey: ['gamification'] });
        setActiveWagerState(null);
      }
    } catch (err) {
      setWagerStatus('lost');
      setWagerMessage("Time's up! Wager challenge failed.");
    } finally {
      setIsWagerLoading(false);
    }
  };

  // Option submission handler
  const handleWagerOptionSelect = async (optionId: string) => {
    if (wagerStatus !== 'answering') return;
    stopWagerTimer();
    setSelectedWagerOptionId(optionId);
    setIsWagerLoading(true);
    try {
      const currentCards = wagerCards.length > 0 ? wagerCards : (activeWagerState?.cards || []);
      const card = currentCards[currentWagerCardIdx];
      if (!card) return;

      const result = await submitWagerAnswer(card.id, optionId);
      if (result.correct) {
        setWagerStatus('correct');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result.finished && result.won) {
          setWagerStatus('won');
          const coinsWon = result.reward ?? (activeWagerState?.wageredCoins ? activeWagerState.wageredCoins * 2 : selectedWagerCoins * 2);
          setWagerMessage(`Double Win! You won +${coinsWon} coins!`);
          void queryClient.invalidateQueries({ queryKey: ['gamification'] });
          void queryClient.invalidateQueries({ queryKey: ['pending-celebration'] });
          setActiveWagerState(null);
        } else {
          // Advance to next card after 1.2s delay
          setTimeout(() => {
            setCurrentWagerCardIdx((prev) => prev + 1);
            setSelectedWagerOptionId(null);
            setWagerStatus('answering');
            startWagerTimer();
          }, 1200);
        }
      } else {
        setWagerStatus('lost');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setWagerMessage(result.message || 'Incorrect answer. Wager challenge failed!');
        void queryClient.invalidateQueries({ queryKey: ['gamification'] });
        setActiveWagerState(null);
      }
    } catch (err) {
      setWagerStatus('lost');
      setWagerMessage('An error occurred submitting your answer.');
    } finally {
      setIsWagerLoading(false);
    }
  };

  // Start Wager Challenge
  const startWagerChallenge = async () => {
    setIsWagerLoading(true);
    try {
      const result = await initiateWager(selectedWagerCoins, deckId ?? undefined);
      if (result.success && result.cards && result.cards.length > 0) {
        setWagerCards(result.cards);
        setCurrentWagerCardIdx(0);
        setSelectedWagerOptionId(null);
        setWagerMessage(null);
        setWagerStatus('answering');
        setIsWagerModalVisible(true);
        startWagerTimer();
        void queryClient.invalidateQueries({ queryKey: ['gamification'] });
      } else {
        Alert.alert('Unable to Start Wager', result.message || 'Check your coin balance or try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start wager challenge.');
    } finally {
      setIsWagerLoading(false);
    }
  };

  // Resume Wager Challenge
  const resumeWagerChallenge = () => {
    if (!activeWagerState || !activeWagerState.cards) return;
    setWagerCards(activeWagerState.cards);
    setCurrentWagerCardIdx(activeWagerState.currentCardIndex);
    setSelectedWagerOptionId(null);
    setWagerMessage(null);
    setWagerStatus('answering');
    setIsWagerModalVisible(true);
    startWagerTimer();
  };

  // Quit/Cancel challenge warning
  const handleQuitWager = () => {
    Alert.alert(
      'Forfeit Wager?',
      'Leaving now will forfeit your coin stake.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forfeit',
          style: 'destructive',
          onPress: () => {
            stopWagerTimer();
            setIsWagerModalVisible(false);
            setWagerStatus('idle');
            setActiveWagerState(null);
          },
        },
      ]
    );
  };

  // Celebrate completion with haptic feedback
  useEffect(() => {
    if (isPerfect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    return () => stopWagerTimer();
  }, [isPerfect, stopWagerTimer]);

  const displayedCards = wagerCards.length > 0 ? wagerCards : (activeWagerState?.cards || []);

  return (
    <ScreenWrapper>
      <Header showBack title={title} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          padding: spacing['2xl'],
          gap: spacing.lg,
          paddingBottom: spacing['4xl'],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Accuracy ring */}
        <Animated.View
          entering={ZoomIn.duration(500).springify()}
          style={{ alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}
        >
          <AccuracyRing
            percentage={accuracyPct}
            size={130}
            strokeWidth={11}
            color={accuracyPct >= 60 ? theme.success : theme.error}
            trackColor={theme.border}
            backgroundColor={theme.card}
            textColor={accuracyPct >= 60 ? theme.success : theme.error}
            emoji={emoji}
            delay={200}
          />
        </Animated.View>

        {/* Confetti on perfect score */}
        {isPerfect && <ConfettiBurst />}

        {/* Headline */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ alignItems: 'center', gap: spacing.xs }}>
          <Typography variant="h2" align="center">{headline}</Typography>
          <Typography variant="body" color={theme.textSecondary} align="center">
            {subline}
          </Typography>
        </Animated.View>

        {/* Score tiles */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, width: '100%' }}>
          <StatTile
            count={correctCount}
            label="Correct"
            icon="checkmark-circle"
            color={theme.success}
            bgColor={theme.successLight}
            delay={320}
          />
          <StatTile
            count={incorrectCount}
            label="Incorrect"
            icon="close-circle"
            color={theme.error}
            bgColor={theme.errorLight}
            delay={380}
          />
          {skippedCount > 0 && (
            <StatTile
              count={skippedCount}
              label="Skipped"
              icon="arrow-forward-circle"
              color={theme.skip}
              bgColor={theme.primaryMuted}
              delay={440}
            />
          )}
        </View>

        {/* Accuracy summary bar */}
        <Animated.View
          entering={FadeInDown.delay(460).duration(400)}
          style={{ width: '100%', gap: spacing.sm }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Typography variant="caption" color={theme.textTertiary}>Accuracy</Typography>
            <Typography variant="captionBold" color={accuracyPct >= 60 ? theme.success : theme.error}>
              {accuracyPct}%
            </Typography>
          </View>
          <View
            style={{
              height: 8, borderRadius: radius.full,
              backgroundColor: theme.border, overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${accuracyPct}%`,
                height: '100%',
                borderRadius: radius.full,
                backgroundColor: accuracyPct >= 60 ? theme.success : theme.error,
              }}
            />
          </View>
        </Animated.View>

        {/* Focus Quality Score — post-session diagnostic */}
        <FocusQualityScore
          correctCount={correctCount}
          incorrectCount={incorrectCount}
          skippedCount={skippedCount}
          totalCards={total}
          longestStreak={longestStreak}
        />

        {/* Coins earned */}
        {totalCoins > 0 && (
          <Animated.View
            entering={FadeInDown.delay(520).duration(400)}
            style={{ width: '100%' }}
          >
            <LinearGradient
              colors={['#F59E0B', '#FBBF24']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: radius.xl,
                padding: 1.5,
              }}
            >
              <View
                style={{
                  backgroundColor: theme.coinLight,
                  borderRadius: radius.xl - 1,
                  padding: spacing.lg,
                  alignItems: 'center',
                  gap: spacing.xs,
                  flexDirection: 'row',
                }}
              >
                <Typography variant="h3" style={{ fontSize: 28 }}>🪙</Typography>
                <View style={{ flex: 1 }}>
                  <Typography variant="h3" color={theme.coin}>+{totalCoins} coins earned</Typography>
                  <Typography variant="caption" color={theme.textSecondary}>
                    {isPerfect ? `${sessionCoinsEarned} earned · +3 bonus for perfect!` : 'Great session!'}
                  </Typography>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Double-or-Nothing Challenge Section */}
        <Animated.View
          entering={FadeInDown.delay(570).duration(400)}
          style={{ width: '100%' }}
        >
          <LinearGradient
            colors={['#8B5CF6', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius.xl,
              padding: 1.5,
              marginTop: spacing.sm,
            }}
          >
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.xl - 1,
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Typography variant="h3" style={{ fontSize: 24 }}>🎰</Typography>
                <View style={{ flex: 1 }}>
                  <Typography variant="label" style={{ fontSize: 16 }}>Double-or-Nothing Challenge</Typography>
                  <Typography variant="caption" color={theme.textSecondary}>
                    Answer 3 fast-paced cards. Double your coins!
                  </Typography>
                </View>
              </View>

              {activeWagerState ? (
                <View style={{ gap: spacing.md }}>
                  <Typography variant="body" color={theme.textSecondary}>
                    You have an unfinished challenge wagers of <Typography variant="bodyBold" color={theme.coin}>🪙 {activeWagerState.wageredCoins} coins</Typography>.
                  </Typography>
                  <Button
                    fullWidth
                    variant="primary"
                    onPress={resumeWagerChallenge}
                    loading={isWagerLoading}
                  >
                    Resume Challenge
                  </Button>
                </View>
              ) : (
                <>
                  {/* Stake Selector */}
                  <View style={{ gap: spacing.xs }}>
                    <Typography variant="caption" color={theme.textTertiary}>Select your wager stake:</Typography>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {[5, 10, 20, 25].map((coins) => (
                        <TouchableOpacity
                          key={coins}
                          onPress={() => setSelectedWagerCoins(coins)}
                          style={{
                            flex: 1,
                            paddingVertical: spacing.sm,
                            borderRadius: radius.md,
                            backgroundColor: selectedWagerCoins === coins ? theme.primaryMuted : theme.cardAlt,
                            borderWidth: 1.5,
                            borderColor: selectedWagerCoins === coins ? theme.primary : theme.border,
                            alignItems: 'center',
                          }}
                        >
                          <Typography
                            variant="captionBold"
                            color={selectedWagerCoins === coins ? theme.primary : theme.textSecondary}
                          >
                            🪙 {coins}
                          </Typography>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <Button
                    fullWidth
                    variant="primary"
                    onPress={startWagerChallenge}
                    loading={isWagerLoading}
                  >
                    Start Challenge
                  </Button>
                </>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Actions */}
        <Animated.View
          entering={FadeInDown.delay(620).duration(400)}
          style={{ width: '100%', gap: spacing.sm }}
        >
          <Button fullWidth size="lg" onPress={() => router.replace('/(tabs)/study' as never)}>
            Done
          </Button>
          <Button fullWidth variant="secondary" size="lg" onPress={onStudyAgain}>
            Study Again
          </Button>
        </Animated.View>
      </ScrollView>

      {/* Wager Challenge Modal */}
      <Modal
        visible={isWagerModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleQuitWager}
      >
        <ScreenWrapper>
          <View style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Modal Header */}
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
              <Typography variant="label">🎰 Challenge Streak: {currentWagerCardIdx + 1}/3</Typography>
              <TouchableOpacity onPress={handleQuitWager}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Timer Progress Bar */}
            <View style={{ height: 6, backgroundColor: theme.border, width: '100%' }}>
              <View
                style={{
                  height: '100%',
                  width: `${(timeLeft / 10) * 100}%`,
                  backgroundColor: timeLeft > 3 ? theme.coin : theme.error,
                }}
              />
            </View>

            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                padding: spacing.xl,
                justifyContent: 'center',
                gap: spacing.lg,
              }}
            >
              {displayedCards[currentWagerCardIdx] ? (
                <View style={{ gap: spacing.lg }}>
                  {/* Timer text */}
                  <Typography
                    variant="h3"
                    align="center"
                    color={timeLeft > 3 ? theme.text : theme.error}
                    style={{ fontSize: 24, fontVariant: ['tabular-nums'] }}
                  >
                    ⏱️ {timeLeft.toFixed(1)}s
                  </Typography>

                  {/* Question Container */}
                  <View
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: radius.xl,
                      padding: spacing.xl,
                      borderWidth: 1.5,
                      borderColor: theme.border,
                      minHeight: 120,
                      justifyContent: 'center',
                    }}
                  >
                    <RichContent variant="body" align="center" style={{ fontSize: 16, lineHeight: 22 }}>
                      {displayedCards[currentWagerCardIdx].question}
                    </RichContent>
                  </View>

                  {/* Options */}
                  <View style={{ gap: spacing.sm }}>
                    {displayedCards[currentWagerCardIdx].options.map((opt: any) => {
                      const isSelected = selectedWagerOptionId === opt.id;
                      const isCorrectState = wagerStatus === 'correct' && isSelected;
                      const isIncorrectState = wagerStatus === 'lost' && isSelected;

                      let btnBg = theme.card;
                      let btnBorderColor = theme.border;
                      let textWeight: '400' | '700' = typography.weights.regular;

                      if (isSelected) {
                        textWeight = typography.weights.bold;
                        if (isCorrectState) {
                          btnBg = theme.successLight;
                          btnBorderColor = theme.success;
                        } else if (isIncorrectState) {
                          btnBg = theme.errorLight;
                          btnBorderColor = theme.error;
                        } else {
                          btnBg = theme.primaryMuted;
                          btnBorderColor = theme.primary;
                        }
                      }

                      return (
                        <TouchableOpacity
                          key={opt.id}
                          disabled={wagerStatus !== 'answering' || isWagerLoading}
                          onPress={() => handleWagerOptionSelect(opt.id)}
                          style={{
                            padding: spacing.md,
                            borderRadius: radius.lg,
                            backgroundColor: btnBg,
                            borderWidth: 1.5,
                            borderColor: btnBorderColor,
                          }}
                        >
                          <RichContent variant="body" style={{ fontWeight: textWeight }}>
                            {opt.text}
                          </RichContent>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <ActivityIndicator size="large" color={theme.primary} />
              )}

              {/* Status / Message Display */}
              {wagerStatus !== 'answering' && wagerMessage && (
                <Animated.View
                  entering={FadeInDown.duration(300)}
                  style={{
                    backgroundColor: wagerStatus === 'won' || wagerStatus === 'correct' ? theme.successLight : theme.errorLight,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: wagerStatus === 'won' || wagerStatus === 'correct' ? theme.success : theme.error,
                    gap: spacing.xs,
                    marginTop: spacing.md,
                  }}
                >
                  <Typography
                    variant="label"
                    color={wagerStatus === 'won' || wagerStatus === 'correct' ? theme.success : theme.error}
                    align="center"
                  >
                    {wagerStatus === 'won' || wagerStatus === 'correct' ? '🎉 Success!' : '❌ Challenge Failed'}
                  </Typography>
                  <RichContent variant="body" align="center" style={{ fontSize: 13 }}>
                    {wagerMessage}
                  </RichContent>

                  {/* Show explanation if available */}
                  {(wagerStatus === 'lost' || wagerStatus === 'won') &&
                    displayedCards[currentWagerCardIdx]?.explanation && (
                      <View style={{ marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: spacing.sm }}>
                        <Typography variant="captionBold" color={theme.textSecondary}>
                          Explanation:
                        </Typography>
                        <RichContent variant="caption" color={theme.textSecondary}>
                          {displayedCards[currentWagerCardIdx].explanation}
                        </RichContent>
                      </View>
                    )}
                </Animated.View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            {wagerStatus !== 'answering' && (wagerStatus === 'won' || wagerStatus === 'lost') && (
              <View style={{ padding: spacing.xl, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Button
                  fullWidth
                  variant={wagerStatus === 'won' ? 'primary' : 'secondary'}
                  onPress={() => {
                    setIsWagerModalVisible(false);
                    setWagerStatus('idle');
                  }}
                >
                  {wagerStatus === 'won' ? 'Awesome!' : 'Close'}
                </Button>
              </View>
            )}
          </View>
        </ScreenWrapper>
      </Modal>
    </ScreenWrapper>
  );
});
