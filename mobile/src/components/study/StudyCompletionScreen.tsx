// ─── StudyCompletionScreen ──────────────────────────────────
// Full-screen results view shown when all cards are answered.
// Extracted from FlashcardStudyScreen (FIX A12).

import React, { useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { ScreenWrapper } from '../layout/ScreenWrapper';
import { Header } from '../layout/Header';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { AccuracyRing } from './AccuracyRing';
import { ConfettiBurst } from './ConfettiBurst';

interface StudyCompletionScreenProps {
  title: string;
  total: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  sessionCoinsEarned: number;
  onStudyAgain: () => void;
}

export const StudyCompletionScreen = React.memo(function StudyCompletionScreen({
  title,
  total,
  correctCount,
  incorrectCount,
  skippedCount,
  sessionCoinsEarned,
  onStudyAgain,
}: StudyCompletionScreenProps) {
  const { theme } = useTheme();
  const router = useRouter();

  const gradedTotal = correctCount + incorrectCount;
  const accuracyPct = gradedTotal > 0 ? Math.round((correctCount / gradedTotal) * 100) : 0;
  const isPerfect = accuracyPct === 100 && skippedCount === 0;
  const emoji = accuracyPct >= 80 ? '🎉' : accuracyPct >= 60 ? '👍' : '💪';
  const headline =
    accuracyPct >= 80 ? 'Excellent!'
    : accuracyPct >= 60 ? 'Good Work!'
    : 'Keep Practising!';

  // Celebrate completion with haptic feedback
  useEffect(() => {
    if (isPerfect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [isPerfect]);

  return (
    <ScreenWrapper>
      <Header showBack title={title} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['2xl'],
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated accuracy ring */}
        <Animated.View
          entering={ZoomIn.duration(500).springify()}
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <AccuracyRing
            percentage={accuracyPct}
            size={120}
            strokeWidth={10}
            color={accuracyPct >= 60 ? theme.success : theme.primary}
            trackColor={theme.border}
            backgroundColor={theme.card}
            textColor={accuracyPct >= 60 ? theme.success : theme.primary}
            emoji={emoji}
            delay={200}
          />
        </Animated.View>

        {/* Confetti on perfect score */}
        {isPerfect && <ConfettiBurst />}

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ alignItems: 'center', gap: spacing.sm }}>
          <Typography variant="h2" align="center">{headline}</Typography>
          <Typography variant="body" color={theme.textSecondary} align="center">
            You completed all {total} cards
          </Typography>
        </Animated.View>

        {/* Score breakdown */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ flexDirection: 'row', gap: spacing.sm, width: '100%' }}>
          <View style={{
            flex: 1, backgroundColor: theme.successLight,
            borderRadius: radius.xl, padding: spacing.lg,
            alignItems: 'center', gap: spacing.xs,
          }}>
            <Typography variant="h3" color={theme.success}>{correctCount}</Typography>
            <Typography variant="caption" color={theme.textTertiary} align="center">Correct</Typography>
          </View>
          <View style={{
            flex: 1, backgroundColor: theme.errorLight,
            borderRadius: radius.xl, padding: spacing.lg,
            alignItems: 'center', gap: spacing.xs,
          }}>
            <Typography variant="h3" color={theme.error}>{incorrectCount}</Typography>
            <Typography variant="caption" color={theme.textTertiary} align="center">Incorrect</Typography>
          </View>
          {skippedCount > 0 && (
            <View style={{
              flex: 1, backgroundColor: theme.primaryMuted,
              borderRadius: radius.xl, padding: spacing.lg,
              alignItems: 'center', gap: spacing.xs,
            }}>
              <Typography variant="h3" color={theme.skip}>{skippedCount}</Typography>
              <Typography variant="caption" color={theme.textTertiary} align="center">Skipped</Typography>
            </View>
          )}
          <View style={{
            flex: 1, backgroundColor: theme.primaryMuted,
            borderRadius: radius.xl, padding: spacing.lg,
            alignItems: 'center', gap: spacing.xs,
          }}>
            <Typography variant="h3" color={theme.primary}>{accuracyPct}%</Typography>
            <Typography variant="caption" color={theme.textTertiary} align="center">Accuracy</Typography>
          </View>
        </Animated.View>

        {/* Coins earned this session */}
        {(sessionCoinsEarned > 0 || isPerfect) && (
          <View
            style={{
              width: '100%',
              backgroundColor: theme.coinLight,
              borderRadius: radius.xl,
              padding: spacing.lg,
              alignItems: 'center',
              gap: spacing.xs,
              borderWidth: 1,
              borderColor: theme.coin + '44',
            }}
          >
            <Typography variant="h3" color={theme.coin}>
              🪙 +{sessionCoinsEarned + (isPerfect ? 3 : 0)}
            </Typography>
            <Typography variant="caption" color={theme.textSecondary} align="center">
              {isPerfect ? `${sessionCoinsEarned} earned · +3 bonus for perfect session!` : 'Coins earned this session'}
            </Typography>
          </View>
        )}

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(550).duration(400)} style={{ width: '100%', gap: spacing.sm }}>
          <Button fullWidth size="lg" onPress={() => router.replace('/(tabs)')}>Done</Button>
          <Button fullWidth variant="secondary" size="lg" onPress={onStudyAgain}>
            Study Again
          </Button>
        </Animated.View>
      </ScrollView>
    </ScreenWrapper>
  );
});
