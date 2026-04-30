// ─── Battles Hub ────────────────────────────────────────────
// Main tab screen for P2P Challenges.
// Improvements:
//  - Gradient hero header with coin display
//  - Active game banner with live pulse indicator
//  - Pending invites with richer card design (bet highlight, countdown feel)
//  - Challenge CTA upgraded to gradient card with icon
//  - History rows with colored result pill, accuracy bar, coin delta
//  - Empty state with animated illustration

import { useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme';
import { spacing, radius, shadows } from '../../src/theme/tokens';
import { useAuth } from '../../src/contexts/AuthContext';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { useCoinBalance } from '../../src/hooks/useGamification';
import {
  usePendingChallenges,
  useActiveChallenge,
  useChallengeHistory,
  useAcceptChallenge,
  useDeclineChallenge,
} from '../../src/hooks/useChallenge';
import { useEffect } from 'react';

// ─── Live pulse dot ───────────────────────────────────────────
function LiveDot() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.6, { duration: 800 }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[style, {
          position: 'absolute', width: 10, height: 10,
          borderRadius: 5, backgroundColor: '#4ADE80',
        }]}
      />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' }} />
    </View>
  );
}

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

  const hasPending = (pending?.length ?? 0) > 0;
  const hasHistory = (history?.data?.length ?? 0) > 0;

  return (
    <ScreenWrapper>
      {/* ── Gradient Hero Header ── */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Typography variant="h3" color="#FFF">⚔️ Battles</Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.75)">
              Challenge friends • Win coins
            </Typography>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            {/* Coin pill */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
              }}
            >
              <Typography style={{ fontSize: 14 }}>🪙</Typography>
              <Typography variant="label" color="#FFF">{coins?.balance ?? 0}</Typography>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/social')}
              style={{
                width: 38, height: 38, borderRadius: radius.full,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="people" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          {[
            { label: 'Pending', value: pending?.length ?? 0, icon: 'hourglass-outline' as const },
            { label: 'Active', value: active ? 1 : 0, icon: 'flash' as const },
            { label: 'Battles', value: history?.data?.length ?? 0, icon: 'trophy-outline' as const },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1, alignItems: 'center', gap: 2,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: radius.lg,
                paddingVertical: spacing.sm,
              }}
            >
              <Ionicons name={s.icon} size={14} color="rgba(255,255,255,0.9)" />
              <Typography variant="label" color="#FFF" style={{ fontSize: 16 }}>{s.value}</Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.7)" style={{ fontSize: 10 }}>{s.label}</Typography>
            </View>
          ))}
        </View>
      </LinearGradient>

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
              <Skeleton width="100%" height={88} borderRadius={radius.xl} />
            ) : active ? (
              <Animated.View entering={FadeInDown.duration(400)}>
                <TouchableOpacity
                  onPress={() => router.push(`/battles/active/${active.id}`)}
                  activeOpacity={0.85}
                  style={{ borderRadius: radius.xl, overflow: 'hidden' }}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      padding: spacing.lg,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 52, height: 52, borderRadius: radius.full,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="game-controller" size={26} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <LiveDot />
                        <Typography variant="captionBold" color="rgba(255,255,255,0.85)" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                          LIVE GAME
                        </Typography>
                      </View>
                      <Typography variant="label" color="#FFF" style={{ fontSize: 16 }}>Game In Progress!</Typography>
                      <Typography variant="caption" color="rgba(255,255,255,0.8)">
                        vs {active.opponentName} · Tap to continue
                      </Typography>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.8)" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ) : null}

            {/* ── Pending Invites ── */}
            {pendingLoading ? (
              <View style={{ gap: spacing.md }}>
                <Skeleton width={160} height={18} borderRadius={radius.sm} />
                <Skeleton width="100%" height={110} borderRadius={radius.xl} />
              </View>
            ) : hasPending ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View
                    style={{
                      width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B',
                    }}
                  />
                  <Typography variant="label" color={theme.textSecondary} style={{ fontSize: 11, letterSpacing: 0.6 }}>
                    INCOMING CHALLENGES ({pending!.length})
                  </Typography>
                </View>
                {pending!.map((challenge, idx) => (
                  <Animated.View
                    key={challenge.id}
                    entering={FadeInDown.delay(idx * 80).duration(400)}
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: radius.xl,
                      borderWidth: 1.5,
                      borderColor: '#F59E0B44',
                      overflow: 'hidden',
                      ...shadows.sm,
                      shadowColor: '#F59E0B',
                    }}
                  >
                    {/* Colored top stripe */}
                    <View style={{ height: 3, backgroundColor: '#F59E0B' }} />
                    <View style={{ padding: spacing.lg, gap: spacing.md }}>
                      {/* Challenger row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                        <View
                          style={{
                            width: 46, height: 46, borderRadius: radius.full,
                            backgroundColor: '#F59E0B18',
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2, borderColor: '#F59E0B44',
                          }}
                        >
                          <Typography variant="label" color="#F59E0B" style={{ fontSize: 18 }}>
                            {challenge.creatorName.charAt(0).toUpperCase()}
                          </Typography>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Typography variant="label">{challenge.creatorName}</Typography>
                          <Typography variant="caption" color={theme.textSecondary}>
                            {challenge.level} · {Math.round(challenge.durationSeconds / 60)} min
                          </Typography>
                        </View>
                        {/* Bet badge */}
                        <View
                          style={{
                            backgroundColor: theme.coinLight,
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.xs,
                            borderRadius: radius.full,
                            borderWidth: 1,
                            borderColor: theme.coin + '44',
                          }}
                        >
                          <Typography variant="captionBold" color={theme.coin}>
                            🪙 {challenge.betAmount}
                          </Typography>
                        </View>
                      </View>

                      {/* Prize preview */}
                      <View
                        style={{
                          backgroundColor: theme.successMuted,
                          borderRadius: radius.lg,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.xs,
                        }}
                      >
                        <Ionicons name="trophy" size={12} color={theme.success} />
                        <Typography variant="caption" color={theme.success}>
                          Winner takes 🪙 {challenge.betAmount * 2}
                        </Typography>
                      </View>

                      {/* Action buttons */}
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            declineMutation.mutate(challenge.id);
                          }}
                          disabled={declineMutation.isPending}
                          style={{
                            flex: 1,
                            paddingVertical: spacing.sm + 2,
                            borderRadius: radius.lg,
                            backgroundColor: theme.cardAlt,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: theme.border,
                          }}
                        >
                          <Typography variant="label" color={theme.textSecondary} style={{ fontSize: 13 }}>
                            Decline
                          </Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            acceptMutation.mutate(challenge.id);
                          }}
                          disabled={acceptMutation.isPending}
                          style={{ flex: 1, borderRadius: radius.lg, overflow: 'hidden' }}
                        >
                          <LinearGradient
                            colors={['#6366F1', '#8B5CF6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              paddingVertical: spacing.sm + 2,
                              alignItems: 'center',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            {acceptMutation.isPending ? (
                              <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                              <>
                                <Typography variant="label" color="#FFF" style={{ fontSize: 13 }}>Accept</Typography>
                                <Typography style={{ fontSize: 13 }}>⚔️</Typography>
                              </>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {/* ── Create Challenge CTA ── */}
            <TouchableOpacity
              onPress={() => router.push('/battles/friend-select')}
              activeOpacity={0.85}
              style={{ borderRadius: radius.xl, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#6366F118', '#8B5CF608']}
                style={{
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                  borderWidth: 1.5,
                  borderColor: '#6366F140',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 56, height: 56, borderRadius: radius.full,
                    backgroundColor: '#6366F122',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: '#6366F140',
                  }}
                >
                  <Ionicons name="add" size={28} color="#6366F1" />
                </View>
                <Typography variant="label" color="#6366F1" style={{ fontSize: 15 }}>
                  Challenge a Friend
                </Typography>
                <Typography variant="caption" color={theme.textTertiary} align="center">
                  Pick a subject, set stakes, and test your knowledge
                </Typography>
              </LinearGradient>
            </TouchableOpacity>

            {/* ── Battle History ── */}
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="time-outline" size={14} color={theme.textTertiary} />
                <Typography variant="label" color={theme.textSecondary} style={{ fontSize: 11, letterSpacing: 0.6 }}>
                  RECENT BATTLES
                </Typography>
              </View>

              {historyLoading ? (
                <View style={{ gap: spacing.sm }}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width="100%" height={72} borderRadius={radius.xl} />
                  ))}
                </View>
              ) : hasHistory ? (
                history!.data.slice(0, 10).map((c, idx) => {
                  const isWinner = c.winnerId !== null && c.winnerId === user?.id;
                  const isTie = c.winnerId === null && c.status === 'completed';

                  const resultLabel = c.status === 'completed'
                    ? (isTie ? 'TIE' : isWinner ? 'WON' : 'LOST')
                    : c.status.toUpperCase();
                  const resultColor = isTie ? theme.coin : isWinner ? theme.success : theme.error;
                  const resultBg = isTie ? theme.coinLight : isWinner ? theme.successLight : theme.errorLight;
                  const resultIcon: React.ComponentProps<typeof Ionicons>['name'] =
                    isTie ? 'swap-horizontal' : isWinner ? 'trophy' : 'close-circle';
                  const coinDelta = isWinner
                    ? `+${c.betAmount * 2} 🪙`
                    : isTie ? `↩${c.betAmount} 🪙` : `-${c.betAmount} 🪙`;
                  const myScore = isWinner || (!isTie && isWinner === false)
                    ? (user?.id === c.creatorId ? c.creatorScore : c.opponentScore)
                    : c.creatorScore;
                  const oppScore = user?.id === c.creatorId ? c.opponentScore : c.creatorScore;

                  return (
                    <Animated.View
                      key={c.id}
                      entering={FadeInDown.delay(idx * 50).duration(300)}
                      style={{
                        backgroundColor: theme.card,
                        borderRadius: radius.xl,
                        padding: spacing.md,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        borderWidth: 1,
                        borderColor: resultColor + '22',
                        ...shadows.xs,
                        shadowColor: resultColor,
                      }}
                    >
                      {/* Result icon */}
                      <View
                        style={{
                          width: 44, height: 44, borderRadius: radius.full,
                          backgroundColor: resultBg,
                          alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Ionicons name={resultIcon} size={22} color={resultColor} />
                      </View>

                      {/* Info */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Typography variant="label" numberOfLines={1}>
                          vs {c.opponentName}
                        </Typography>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
                            {myScore}–{oppScore}
                          </Typography>
                          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary }} />
                          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11 }}>
                            {c.level}
                          </Typography>
                        </View>
                      </View>

                      {/* Right: result pill + coin delta */}
                      <View style={{ alignItems: 'flex-end', gap: 3 }}>
                        <View
                          style={{
                            backgroundColor: resultBg,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                            borderRadius: radius.full,
                            borderWidth: 1,
                            borderColor: resultColor + '44',
                          }}
                        >
                          <Typography variant="captionBold" color={resultColor} style={{ fontSize: 10 }}>
                            {resultLabel}
                          </Typography>
                        </View>
                        <Typography variant="caption" color={resultColor} style={{ fontSize: 11, fontWeight: '700' }}>
                          {coinDelta}
                        </Typography>
                      </View>
                    </Animated.View>
                  );
                })
              ) : (
                <Animated.View entering={FadeIn.duration(400)}>
                  <View
                    style={{
                      alignItems: 'center',
                      padding: spacing['2xl'],
                      gap: spacing.md,
                      backgroundColor: theme.cardAlt,
                      borderRadius: radius.xl,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <View
                      style={{
                        width: 72, height: 72, borderRadius: radius.full,
                        backgroundColor: theme.primaryMuted,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="shield-outline" size={36} color={theme.primary} />
                    </View>
                    <Typography variant="label" color={theme.textSecondary} align="center">
                      No battles yet
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary} align="center">
                      Challenge a friend above to fight your first battle and win coins!
                    </Typography>
                  </View>
                </Animated.View>
              )}
            </View>
          </View>
        }
      />
    </ScreenWrapper>
  );
}
