// ─── StudyCompletionScreen ──────────────────────────────────
// Full-screen results view shown when all cards are answered.
// Improvements:
//  - Richer stat tiles with icons and percentage bar
//  - Better coins card with animated entrance
//  - "Done" goes to /(tabs)/study instead of /(tabs)
//  - Accuracy-based message is more nuanced
//  - Added session time display

import React, { useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  onStudyAgain,
}: StudyCompletionScreenProps) {
  const { theme } = useTheme();
  const router = useRouter();

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
    </ScreenWrapper>
  );
});
