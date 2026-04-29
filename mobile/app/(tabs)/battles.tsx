// ─── Battles Hub ────────────────────────────────────────────
// Main tab screen for P2P Challenges:
// - Active game banner (if live)
// - Pending invites
// - Recent history (Win/Loss/Tie)
// - CTA to create or find friends

import { useCallback } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme';
import { spacing, radius, shadows } from '../../src/theme/tokens';
import { useAuth } from '../../src/contexts/AuthContext';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { CoinDisplay } from '../../src/components/CoinDisplay';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { useCoinBalance } from '../../src/hooks/useGamification';
import {
  usePendingChallenges,
  useActiveChallenge,
  useChallengeHistory,
  useAcceptChallenge,
  useDeclineChallenge,
} from '../../src/hooks/useChallenge';

export default function BattlesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const { data: coins } = useCoinBalance();
  const { data: pending, isLoading: pendingLoading, refetch: refetchPending } = usePendingChallenges();
  const { data: active, isLoading: activeLoading, refetch: refetchActive } = useActiveChallenge();
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useChallengeHistory();

  const acceptMutation = useAcceptChallenge();
  const declineMutation = useDeclineChallenge();

  const refreshing = pendingLoading || activeLoading || historyLoading;
  const onRefresh = useCallback(() => {
    void refetchPending();
    void refetchActive();
    void refetchHistory();
  }, [refetchPending, refetchActive, refetchHistory]);

  return (
    <ScreenWrapper>
      {/* ── Header ── */}
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.base,
          paddingBottom: spacing.lg,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Typography variant="h3">⚔️ Battles</Typography>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <CoinDisplay coins={coins?.balance ?? 0} size="sm" />
          <TouchableOpacity
            onPress={() => router.push('/social')}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              backgroundColor: theme.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="people" size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListHeaderComponent={
          <View style={{ padding: spacing.xl, gap: spacing['2xl'] }}>
            {/* ── Active Game Banner ── */}
            {activeLoading ? (
              <Skeleton width="100%" height={80} borderRadius={radius.lg} />
            ) : active ? (
              <Animated.View entering={FadeInDown.duration(400)}>
                <TouchableOpacity
                  onPress={() => router.push(`/battles/active/${active.id}`)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: theme.primary,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    ...shadows.md,
                    shadowColor: theme.primary,
                  }}
                >
                  <Animated.View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.full,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="game-controller" size={24} color="#fff" />
                  </Animated.View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodyBold" style={{ color: '#fff' }}>
                      Game In Progress!
                    </Typography>
                    <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      vs {active.creatorName === active.opponentName ? 'opponent' :
                        active.opponentName} • Tap to continue
                    </Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </Animated.View>
            ) : null}

            {/* ── Pending Invites ── */}
            {pendingLoading ? (
              <View style={{ gap: spacing.md }}>
                <Skeleton width={120} height={20} borderRadius={radius.sm} />
                <Skeleton width="100%" height={100} borderRadius={radius.lg} />
              </View>
            ) : pending && pending.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <Typography variant="labelMedium" style={{ color: theme.textSecondary }}>
                  INCOMING CHALLENGES ({pending.length})
                </Typography>
                {pending.map((challenge, idx) => (
                  <Animated.View
                    key={challenge.id}
                    entering={FadeInDown.delay(idx * 80).duration(400)}
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: radius.lg,
                      padding: spacing.lg,
                      borderWidth: 1,
                      borderColor: theme.border,
                      gap: spacing.md,
                      ...shadows.sm,
                      shadowColor: theme.shadow,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.full,
                          backgroundColor: theme.primaryMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="person" size={20} color={theme.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Typography variant="bodyBold">{challenge.creatorName}</Typography>
                        <Typography variant="caption" style={{ color: theme.textSecondary }}>
                          {challenge.level} • {challenge.durationSeconds}s • {challenge.betAmount} coins
                        </Typography>
                      </View>
                      <View style={{
                        backgroundColor: theme.coinLight,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: radius.full,
                      }}>
                        <Typography variant="captionBold" style={{ color: theme.coin }}>
                          🪙 {challenge.betAmount}
                        </Typography>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          declineMutation.mutate(challenge.id);
                        }}
                        disabled={declineMutation.isPending}
                        style={{
                          flex: 1,
                          paddingVertical: spacing.sm,
                          borderRadius: radius.md,
                          backgroundColor: theme.buttonSecondary,
                          alignItems: 'center',
                        }}
                      >
                        <Typography variant="bodySemiBold" style={{ color: theme.buttonSecondaryText }}>
                          Decline
                        </Typography>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          acceptMutation.mutate(challenge.id);
                        }}
                        disabled={acceptMutation.isPending}
                        style={{
                          flex: 1,
                          paddingVertical: spacing.sm,
                          borderRadius: radius.md,
                          backgroundColor: theme.buttonPrimary,
                          alignItems: 'center',
                        }}
                      >
                        {acceptMutation.isPending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Typography variant="bodySemiBold" style={{ color: theme.buttonPrimaryText }}>
                            Accept ⚔️
                          </Typography>
                        )}
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {/* ── Create Challenge CTA ── */}
            <TouchableOpacity
              onPress={() => router.push('/battles/friend-select')}
              activeOpacity={0.85}
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.lg,
                padding: spacing.xl,
                borderWidth: 1.5,
                borderColor: theme.primary,
                borderStyle: 'dashed',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <Ionicons name="add-circle" size={32} color={theme.primary} />
              <Typography variant="bodySemiBold" style={{ color: theme.primary }}>
                Challenge a Friend
              </Typography>
            </TouchableOpacity>

            {/* ── Recent History ── */}
            <View style={{ gap: spacing.md }}>
              <Typography variant="labelMedium" style={{ color: theme.textSecondary }}>
                RECENT BATTLES
              </Typography>
              {historyLoading ? (
                <View style={{ gap: spacing.sm }}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width="100%" height={64} borderRadius={radius.md} />
                  ))}
                </View>
              ) : history?.data && history.data.length > 0 ? (
                history.data.slice(0, 10).map((c, idx) => {
                  const isWinner = c.winnerId !== null && c.winnerId === user?.id;
                  const isTie = c.winnerId === null && c.status === 'completed';
                  let resultLabel = '';
                  let resultColor = theme.textSecondary;
                  let resultIcon: React.ComponentProps<typeof Ionicons>['name'] = 'remove-circle-outline';

                  if (c.status === 'completed') {
                    if (isTie) {
                      resultLabel = 'TIE';
                      resultColor = theme.coin;
                      resultIcon = 'swap-horizontal';
                    } else if (isWinner) {
                      resultLabel = 'WON';
                      resultColor = theme.success;
                      resultIcon = 'trophy';
                    } else {
                      resultLabel = 'LOST';
                      resultColor = theme.error;
                      resultIcon = 'close-circle';
                    }
                  } else {
                    resultLabel = c.status.toUpperCase();
                  }

                  return (
                    <Animated.View
                      key={c.id}
                      entering={FadeInDown.delay(idx * 60).duration(300)}
                      style={{
                        backgroundColor: theme.card,
                        borderRadius: radius.md,
                        padding: spacing.base,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        borderWidth: 1,
                        borderColor: theme.borderLight,
                      }}
                    >
                      <Ionicons name={resultIcon} size={24} color={resultColor} />
                      <View style={{ flex: 1 }}>
                        <Typography variant="bodySemiBold">
                          vs {c.opponentName}
                        </Typography>
                        <Typography variant="caption" style={{ color: theme.textSecondary }}>
                          {c.creatorScore} — {c.opponentScore} • {c.level}
                        </Typography>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Typography variant="captionBold" style={{ color: resultColor }}>
                          {resultLabel}
                        </Typography>
                        <Typography variant="caption" style={{ color: theme.textTertiary, fontSize: 10 }}>
                          {isWinner ? `+${c.betAmount * 2}` : isTie ? `↩${c.betAmount}` : `-${c.betAmount}`} 🪙
                        </Typography>
                      </View>
                    </Animated.View>
                  );
                })
              ) : (
                <View style={{ alignItems: 'center', padding: spacing['2xl'], gap: spacing.md }}>
                  <Ionicons name="shield-outline" size={48} color={theme.textTertiary} />
                  <Typography variant="body" style={{ color: theme.textTertiary, textAlign: 'center' }}>
                    No battles yet.{'\n'}Challenge a friend to get started!
                  </Typography>
                </View>
              )}
            </View>
          </View>
        }
      />
    </ScreenWrapper>
  );
}
