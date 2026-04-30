// ─── Challenge Result Screen ────────────────────────────────
// Shows Win/Loss/Tie with coin impact, final scores, and actions.
// Improvements:
//  - Full-bleed gradient background matching result (green/red/amber)
//  - Animated emoji hero with BounceIn
//  - Score comparison bar showing relative performance
//  - Match details in icon-row card
//  - Gradient "Play Again" button; secondary "View Battles"

import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInUp, BounceIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme';
import { spacing, radius, shadows } from '../../../src/theme/tokens';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../src/components/ui/Typography';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { useChallengeDetail } from '../../../src/hooks/useChallenge';
import { useAuth } from '../../../src/hooks/../contexts/AuthContext';

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
          <Skeleton width={220} height={44} borderRadius={radius.xl} />
          <Skeleton width={160} height={28} borderRadius={radius.lg} />
          <Skeleton width="85%" height={130} borderRadius={radius.xl} />
        </View>
      </ScreenWrapper>
    );
  }

  const isTie = challenge.winnerId === null && challenge.status === 'completed';
  const isWinner =
    challenge.status === 'completed' &&
    challenge.winnerId !== null &&
    challenge.winnerId === user?.id;

  let resultTitle = '';
  let resultEmoji = '';
  let gradientColors: [string, string] = ['#6366F1', '#8B5CF6'];
  let coinDelta = 0;
  let coinPrefix = '';
  let coinLabel = '';

  if (isTie) {
    resultTitle = "It's a Tie!";
    resultEmoji = '🤝';
    gradientColors = ['#F59E0B', '#FBBF24'];
    coinDelta = challenge.betAmount;
    coinPrefix = '↩';
    coinLabel = 'Bet refunded';
  } else if (isWinner) {
    resultTitle = 'You Won!';
    resultEmoji = '🏆';
    gradientColors = ['#10B981', '#34D399'];
    coinDelta = challenge.betAmount * 2;
    coinPrefix = '+';
    coinLabel = 'Coins earned';
  } else {
    resultTitle = 'You Lost';
    resultEmoji = '💪';
    gradientColors = ['#EF4444', '#F87171'];
    coinDelta = challenge.betAmount;
    coinPrefix = '-';
    coinLabel = 'Better luck next time';
  }

  const myScore = user?.id === (challenge as any).creatorId
    ? challenge.creatorScore
    : challenge.opponentScore;
  const oppScore = user?.id === (challenge as any).creatorId
    ? challenge.opponentScore
    : challenge.creatorScore;
  const totalScore = myScore + oppScore;
  const myPct = totalScore > 0 ? myScore / totalScore : 0.5;

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Result hero ── */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: spacing['3xl'],
            paddingBottom: spacing['2xl'],
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          {/* Emoji */}
          <Animated.View entering={BounceIn.delay(200).duration(700)}>
            <View
              style={{
                width: 110, height: 110, borderRadius: radius.full,
                backgroundColor: 'rgba(255,255,255,0.25)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
              }}
            >
              <Typography variant="h1" style={{ fontSize: 56 }}>{resultEmoji}</Typography>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400).duration(400)} style={{ alignItems: 'center', gap: spacing.xs }}>
            <Typography variant="h2" color="#FFF">{resultTitle}</Typography>

            {/* Coin delta */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: 'rgba(255,255,255,0.25)',
                borderRadius: radius.full,
                paddingHorizontal: spacing.lg,
                paddingVertical: 6,
                marginTop: spacing.xs,
              }}
            >
              <Typography style={{ fontSize: 16 }}>🪙</Typography>
              <Typography variant="h3" color="#FFF">{coinPrefix}{coinDelta}</Typography>
            </View>
            <Typography variant="caption" color="rgba(255,255,255,0.8)">{coinLabel}</Typography>
          </Animated.View>
        </LinearGradient>

        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          {/* ── Score comparison card ── */}
          <Animated.View entering={FadeIn.delay(500).duration(400)}>
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.xl,
                padding: spacing.lg,
                gap: spacing.md,
                borderWidth: 1,
                borderColor: theme.border,
                ...shadows.md,
                shadowColor: gradientColors[0],
                shadowOpacity: 0.15,
              }}
            >
              <Typography variant="caption" color={theme.textTertiary} align="center"
                style={{ letterSpacing: 0.6, fontSize: 10 }}>
                FINAL SCORE
              </Typography>

              {/* Score row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                <View style={{ alignItems: 'center', gap: spacing.xs }}>
                  <View
                    style={{
                      width: 42, height: 42, borderRadius: radius.full,
                      backgroundColor: gradientColors[0] + '22',
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 2, borderColor: gradientColors[0] + '55',
                    }}
                  >
                    <Typography variant="label" color={gradientColors[0]}>
                      {(user?.displayName ?? 'Y').charAt(0).toUpperCase()}
                    </Typography>
                  </View>
                  <Typography variant="caption" color={theme.textSecondary}>You</Typography>
                  <Typography variant="h2" color={gradientColors[0]}>{myScore}</Typography>
                </View>

                <Typography variant="h4" color={theme.textTertiary}>vs</Typography>

                <View style={{ alignItems: 'center', gap: spacing.xs }}>
                  <View
                    style={{
                      width: 42, height: 42, borderRadius: radius.full,
                      backgroundColor: theme.primaryMuted,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 2, borderColor: theme.border,
                    }}
                  >
                    <Typography variant="label" color={theme.primary}>
                      {(challenge.opponentName ?? 'O').charAt(0).toUpperCase()}
                    </Typography>
                  </View>
                  <Typography variant="caption" color={theme.textSecondary}>
                    {challenge.opponentName}
                  </Typography>
                  <Typography variant="h2" color={theme.textSecondary}>{oppScore}</Typography>
                </View>
              </View>

              {/* Score comparison bar */}
              {totalScore > 0 && (
                <View style={{ gap: 4 }}>
                  <View style={{ height: 8, borderRadius: radius.full, flexDirection: 'row', overflow: 'hidden' }}>
                    <View
                      style={{
                        flex: myPct,
                        backgroundColor: gradientColors[0],
                      }}
                    />
                    <View
                      style={{
                        flex: 1 - myPct,
                        backgroundColor: theme.border,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color={gradientColors[0]} style={{ fontSize: 10 }}>
                      You {Math.round(myPct * 100)}%
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                      {challenge.opponentName} {Math.round((1 - myPct) * 100)}%
                    </Typography>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── Match details card ── */}
          <Animated.View entering={FadeInDown.delay(620).duration(400)}>
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.xl,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <View style={{ backgroundColor: theme.cardAlt, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="information-circle-outline" size={15} color={theme.textTertiary} />
                <Typography variant="caption" color={theme.textTertiary} style={{ letterSpacing: 0.5, fontSize: 10 }}>
                  MATCH DETAILS
                </Typography>
              </View>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                {[
                  { icon: 'bar-chart-outline' as const, label: 'Level', value: challenge.level },
                  { icon: 'timer-outline' as const, label: 'Duration', value: `${Math.round(challenge.durationSeconds / 60)} min` },
                  { icon: 'cash-outline' as const, label: 'Wager', value: `🪙 ${challenge.betAmount}` },
                  { icon: 'trophy-outline' as const, label: 'Prize Pool', value: `🪙 ${challenge.betAmount * 2}` },
                ].map((r, i) => (
                  <View key={r.label}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: theme.border, marginBottom: spacing.md }} />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View
                        style={{
                          width: 30, height: 30, borderRadius: radius.md,
                          backgroundColor: theme.primaryMuted,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Ionicons name={r.icon} size={14} color={theme.primary} />
                      </View>
                      <Typography variant="body" color={theme.textSecondary} style={{ flex: 1 }}>
                        {r.label}
                      </Typography>
                      <Typography variant="label">{r.value}</Typography>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* ── Actions ── */}
          <Animated.View entering={FadeInUp.delay(800).duration(400)} style={{ gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => router.push('/battles/create')}
              style={{ borderRadius: radius.xl, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={gradientColors}
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
                <Ionicons name="flash" size={18} color="#FFF" />
                <Typography variant="label" color="#FFF" style={{ fontSize: 15 }}>
                  Play Again ⚔️
                </Typography>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/battles' as never)}
              style={{
                paddingVertical: spacing.md,
                alignItems: 'center',
                borderRadius: radius.xl,
                borderWidth: 1.5,
                borderColor: theme.border,
                backgroundColor: theme.card,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: spacing.sm,
              }}
            >
              <Ionicons name="arrow-back" size={16} color={theme.text} />
              <Typography variant="label" color={theme.text}>View Battles</Typography>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
