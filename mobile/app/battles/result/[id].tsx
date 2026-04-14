// ─── Challenge Result Screen ────────────────────────────────
// Shows Win/Loss/Tie with coin impact, final scores, and action buttons.

import { View, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp, BounceIn } from 'react-native-reanimated';
import { useTheme } from '../../../src/theme';
import { spacing, typography, radius, shadows } from '../../../src/theme/tokens';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../src/components/ui/Typography';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { useChallengeDetail } from '../../../src/hooks/useChallenge';
import { useAuth } from '../../../src/contexts/AuthContext';

export default function ResultScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const { data: challenge, isLoading } = useChallengeDetail(id ?? null);

  if (isLoading || !challenge) {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
          <Skeleton width={200} height={40} borderRadius={radius.md} />
          <Skeleton width={150} height={24} borderRadius={radius.sm} />
          <Skeleton width="80%" height={120} borderRadius={radius.lg} />
        </View>
      </ScreenWrapper>
    );
  }

  const isTie = challenge.winnerId === null && challenge.status === 'completed';
  // Compare winnerId against the current user's PG id from /auth/me
  const isWinner =
    challenge.status === 'completed' &&
    challenge.winnerId !== null &&
    challenge.winnerId === user?.id;

  let resultTitle = '';
  let resultEmoji = '';
  let resultColor = theme.textSecondary;
  let coinDelta = 0;
  let coinPrefix = '';

  if (isTie) {
    resultTitle = "It's a Tie!";
    resultEmoji = '🤝';
    resultColor = theme.coin;
    coinDelta = challenge.betAmount;
    coinPrefix = '↩';
  } else if (isWinner) {
    resultTitle = 'You Won!';
    resultEmoji = '🏆';
    resultColor = theme.success;
    coinDelta = challenge.betAmount * 2;
    coinPrefix = '+';
  } else {
    resultTitle = 'You Lost';
    resultEmoji = '💪';
    resultColor = theme.error;
    coinDelta = challenge.betAmount;
    coinPrefix = '-';
  }

  return (
    <ScreenWrapper>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing['2xl'] }}>
        {/* Result Icon */}
        <Animated.View entering={BounceIn.delay(200).duration(600)}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: radius.full,
              backgroundColor: isWinner ? theme.successMuted : isTie ? theme.coinLight : theme.errorMuted,
              alignItems: 'center',
              justifyContent: 'center',
              ...shadows.lg,
              shadowColor: resultColor,
            }}
          >
            <Typography variant="h1" style={{ fontSize: 56 }}>{resultEmoji}</Typography>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={{ alignItems: 'center', gap: spacing.sm }}>
          <Typography variant="h2" style={{ color: resultColor }}>{resultTitle}</Typography>
          <Typography variant="h3" style={{ color: resultColor }}>
            {coinPrefix}{coinDelta} 🪙
          </Typography>
          {isTie && (
            <Typography variant="caption" style={{ color: theme.textSecondary }}>
              Your bet has been refunded
            </Typography>
          )}
        </Animated.View>

        {/* Score Card */}
        <Animated.View
          entering={FadeIn.delay(600).duration(400)}
          style={{
            backgroundColor: theme.card,
            borderRadius: radius.lg,
            padding: spacing.xl,
            width: '100%',
            gap: spacing.md,
            borderWidth: 1,
            borderColor: theme.border,
            ...shadows.md,
            shadowColor: theme.shadow,
          }}
        >
          <Typography variant="labelMedium" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            FINAL SCORE
          </Typography>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Typography variant="caption" style={{ color: theme.textSecondary }}>
                {challenge.creatorName}
              </Typography>
              <Typography variant="h2" style={{ color: theme.primary }}>
                {challenge.creatorScore}
              </Typography>
            </View>
            <Typography variant="h4" style={{ color: theme.textTertiary }}>vs</Typography>
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Typography variant="caption" style={{ color: theme.textSecondary }}>
                {challenge.opponentName}
              </Typography>
              <Typography variant="h2" style={{ color: theme.error }}>
                {challenge.opponentScore}
              </Typography>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: theme.divider }} />
          {[
            { label: 'Level', value: challenge.level },
            { label: 'Duration', value: `${challenge.durationSeconds}s` },
            { label: 'Bet', value: `🪙 ${challenge.betAmount}` },
          ].map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Typography variant="body" style={{ color: theme.textSecondary }}>{r.label}</Typography>
              <Typography variant="bodySemiBold">{r.value}</Typography>
            </View>
          ))}
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInUp.delay(800).duration(400)}
          style={{ width: '100%', gap: spacing.md }}
        >
          <TouchableOpacity
            onPress={() => router.push('/battles/create' as never)}
            style={{
              backgroundColor: theme.buttonPrimary,
              borderRadius: radius.md,
              paddingVertical: spacing.lg,
              alignItems: 'center',
              ...shadows.sm,
              shadowColor: theme.primary,
            }}
          >
            <Typography variant="bodyBold" style={{ color: theme.buttonPrimaryText }}>
              Play Again ⚔️
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/battles' as never)}
            style={{
              backgroundColor: theme.buttonSecondary,
              borderRadius: radius.md,
              paddingVertical: spacing.lg,
              alignItems: 'center',
            }}
          >
            <Typography variant="bodySemiBold" style={{ color: theme.buttonSecondaryText }}>
              View Battles
            </Typography>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}
