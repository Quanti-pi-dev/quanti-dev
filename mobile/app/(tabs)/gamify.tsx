// ─── Leaderboard Screen ───────────────────────────────────────
// Shows global/weekly coin leaderboard. Weekly is gated to tier 1+.
// Uses the unified ScreenWrapper and theme system — no StyleSheet.create
// inside render (perf fix), consistent with the rest of the app.

import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme';
import { spacing, typography, radius, shadows } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { CoinDisplay } from '../../src/components/CoinDisplay';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { LockedFeatureBanner } from '../../src/components/subscription/LockedFeature';
import { useAuth } from '../../src/contexts/AuthContext';
import { useCoinBalance, useLeaderboard } from '../../src/hooks/useGamification';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';

const RANK_COLOURS: Record<number, string> = {
  1: '#FCD34D', // Gold
  2: '#D1D5DB', // Silver
  3: '#CD7C2F', // Bronze
};

export default function GamifyScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [leaderboardType, setLeaderboardType] = useState<'global' | 'weekly'>('global');
  const { planTier } = useSubscriptionGate();

  const { data: coins, isLoading: coinsLoading, refetch: refetchCoins } = useCoinBalance();
  const { data: leaderboard, isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useLeaderboard(leaderboardType);

  const refreshing = coinsLoading || leaderboardLoading;
  const onRefresh = useCallback(() => {
    void refetchCoins();
    void refetchLeaderboard();
  }, [refetchCoins, refetchLeaderboard]);

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
        <Typography variant="h3">Leaderboard</Typography>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <CoinDisplay coins={coins?.balance ?? 0} />
          <TouchableOpacity
            onPress={() => router.push('/coins-history' as never)}
            style={{
              width: 40, height: 40, borderRadius: radius.full,
              backgroundColor: theme.cardAlt, borderWidth: 1.5, borderColor: theme.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="time-outline" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/shop')}
            style={{
              width: 40, height: 40, borderRadius: radius.full,
              backgroundColor: theme.cardAlt, borderWidth: 1.5, borderColor: theme.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="cart-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm }}>
        {(['global', 'weekly'] as const).map((type) => {
          const locked = type === 'weekly' && planTier < 1;
          const active = leaderboardType === type;
          return (
            <TouchableOpacity
              key={type}
              onPress={() => !locked && setLeaderboardType(type)}
              style={{
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.base,
                borderRadius: radius.full,
                backgroundColor: active ? theme.primary : theme.cardAlt,
                borderWidth: 1,
                borderColor: active ? theme.primary : theme.border,
                opacity: locked ? 0.5 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              {locked && <Ionicons name="lock-closed" size={12} color={active ? theme.buttonPrimaryText : theme.textTertiary} />}
              <Typography
                variant="label"
                color={active ? theme.buttonPrimaryText : theme.textSecondary}
                style={{ textTransform: 'capitalize' }}
              >
                {type}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Weekly lock banner ── */}
      {leaderboardType === 'weekly' && planTier < 1 && (
        <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
          <LockedFeatureBanner feature="Weekly Rankings — Basic plan and above" minTier={1} />
        </View>
      )}

      {/* ── Your Rank chip (FIX U8) ── */}
      {!leaderboardLoading && leaderboard?.entries && user?.id && (() => {
        const myEntry = leaderboard.entries.find((e: { userId: string }) => e.userId === user.id);
        if (!myEntry) return null;
        return (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
              marginBottom: spacing.xs,
            }}
          >
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                paddingHorizontal: spacing.base, paddingVertical: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: theme.primary + '18',
                borderWidth: 1,
                borderColor: theme.primary + '30',
              }}
            >
              <Typography variant="caption" color={theme.primary} style={{ fontFamily: typography.bodySemiBold }}>
                🏅 Your Rank: #{myEntry.rank}
              </Typography>
            </View>
            <Typography variant="caption" color={theme.textTertiary}>
              {myEntry.score.toLocaleString()} coins
            </Typography>
          </View>
        );
      })()}

      {/* ── List ── */}
      {leaderboardLoading ? (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={64} borderRadius={radius.lg} />
          ))}
        </View>
      ) : (
        <FlatList
          data={leaderboard?.entries ?? []}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'], paddingTop: spacing.xs, gap: spacing.sm }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          renderItem={({ item, index }) => {
            const isCurrentUser = item.userId === user?.id;
            const rankColor = RANK_COLOURS[item.rank] ?? theme.surfaceElevated;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index * 45, 400)).springify()}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isCurrentUser ? theme.primaryMuted : theme.card,
                    padding: spacing.base,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: isCurrentUser ? theme.primary + '55' : theme.border,
                    ...shadows.xs,
                    shadowColor: theme.shadow,
                    gap: spacing.base,
                  }}
                >
                  {/* Rank badge */}
                  <View
                    style={{
                      width: 36, height: 36, borderRadius: radius.full,
                      backgroundColor: rankColor,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Typography
                      variant="label"
                      color={item.rank <= 3 ? '#1A1A1A' : theme.textSecondary}
                    >
                      {item.rank}
                    </Typography>
                  </View>

                  {/* Name */}
                  <View style={{ flex: 1 }}>
                    <Typography variant="body" style={{ fontFamily: typography.bodySemiBold }}>
                      {item.displayName}{isCurrentUser ? ' (You)' : ''}
                    </Typography>
                  </View>

                  {/* Score */}
                  <Typography variant="label" color={theme.primary}>
                    {item.score} pts
                  </Typography>
                </View>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing['4xl'] }}>
              <Ionicons name="trophy-outline" size={48} color={theme.textTertiary} />
              <Typography variant="body" color={theme.textTertiary} align="center" style={{ marginTop: spacing.md }}>
                No entries yet. Start studying to rank up!
              </Typography>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
}
