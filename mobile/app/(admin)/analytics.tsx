// ─── Admin Analytics Screen ───────────────────────────────────
// Full rewrite: design-system components, real data from
// GET /admin/analytics — no hardcoded values.
// Sections: Platform Overview · Coin Economy · Shop Activity · Leaderboard

import { View, ScrollView, RefreshControl } from 'react-native';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { useAdminAnalytics, useRevenueDashboard } from '../../src/hooks/useGamification';
import { useLeaderboard } from '../../src/hooks/useGamification';

// ─── Helpers ─────────────────────────────────────────────────

/** Format large numbers: 1200 → "1.2K", 1500000 → "1.5M" */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Sub-components ──────────────────────────────────────────

interface StatBoxProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  sub?: string;
  color: string;
}

function StatBox({ icon, label, value, sub, color }: StatBoxProps) {
  const { theme } = useTheme();
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      gap: spacing.xs,
      minWidth: '45%',
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: radius.md,
        backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.xs,
      }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Typography variant="h3" color={color}>{value}</Typography>
      <Typography variant="label">{label}</Typography>
      {sub && <Typography variant="caption" color={theme.textTertiary}>{sub}</Typography>}
    </View>
  );
}

interface CoinFlowRowProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function CoinFlowRow({ label, value, total, color }: CoinFlowRowProps) {
  const { theme } = useTheme();
  const pct = total > 0 ? value / total : 0;
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color={theme.textSecondary}>{label}</Typography>
        <Typography variant="label" color={color}>{fmt(value)}</Typography>
      </View>
      <View style={{ height: 6, backgroundColor: theme.cardAlt, borderRadius: radius.full, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: radius.full }} />
      </View>
    </View>
  );
}

const RANK_COLOURS: Record<number, string> = { 1: '#FCD34D', 2: '#D1D5DB', 3: '#CD7C2F' };

// ─── Screen ──────────────────────────────────────────────────

export default function AdminAnalyticsScreen() {
  const { theme } = useTheme();
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useAdminAnalytics();
  const { data: leaderboard, isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useLeaderboard('global');
  const { data: revenue, isLoading: revenueLoading, refetch: refetchRevenue } = useRevenueDashboard();

  const refreshing = analyticsLoading || leaderboardLoading || revenueLoading;
  const onRefresh = useCallback(() => {
    void refetchAnalytics();
    void refetchLeaderboard();
    void refetchRevenue();
  }, [refetchAnalytics, refetchLeaderboard, refetchRevenue]);

  return (
    <ScreenWrapper>
      <Header showBack title="Platform Analytics" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* ── Platform Overview ── */}
        <View style={{ gap: spacing.sm }}>
          <Typography variant="overline" color={theme.textTertiary}>Platform Overview</Typography>
          {analyticsLoading ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Skeleton height={110} style={{ flex: 1, borderRadius: radius.xl }} />
                <Skeleton height={110} style={{ flex: 1, borderRadius: radius.xl }} />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Skeleton height={110} style={{ flex: 1, borderRadius: radius.xl }} />
                <Skeleton height={110} style={{ flex: 1, borderRadius: radius.xl }} />
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <StatBox
                  icon="people-outline"
                  label="Total Users"
                  value={fmt(analytics?.totalUsers ?? 0)}
                  color="#6366F1"
                />
                <StatBox
                  icon="pulse-outline"
                  label="Active Today"
                  value={fmt(analytics?.activeUsersToday ?? 0)}
                  sub="study sessions"
                  color="#10B981"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <StatBox
                  icon="library-outline"
                  label="Total Sessions"
                  value={fmt(analytics?.totalSessions ?? 0)}
                  color="#8B5CF6"
                />
                <StatBox
                  icon="flash-outline"
                  label="Cards Answered"
                  value={fmt(analytics?.totalCardsAnswered ?? 0)}
                  sub={analytics?.avgAccuracyPct != null ? `${analytics.avgAccuracyPct}% avg accuracy` : undefined}
                  color="#F59E0B"
                />
              </View>
            </>
          )}
        </View>

        {/* ── Coin Economy ── */}
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Typography variant="h4">🪙 Coin Economy</Typography>
            </View>
            {analyticsLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={18} borderRadius={radius.md} />
                <Skeleton height={18} borderRadius={radius.md} />
                <Skeleton height={18} borderRadius={radius.md} />
              </View>
            ) : (
              <>
                {/* Circulation summary */}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{
                    flex: 1, padding: spacing.md, borderRadius: radius.lg,
                    backgroundColor: '#10B981' + '18', alignItems: 'center', gap: spacing.xs,
                  }}>
                    <Typography variant="h4" color="#10B981">{fmt(analytics?.totalCoinsEarned ?? 0)}</Typography>
                    <Typography variant="caption" color={theme.textTertiary} align="center">Earned (all time)</Typography>
                  </View>
                  <View style={{
                    flex: 1, padding: spacing.md, borderRadius: radius.lg,
                    backgroundColor: '#EF4444' + '18', alignItems: 'center', gap: spacing.xs,
                  }}>
                    <Typography variant="h4" color="#EF4444">{fmt(analytics?.totalCoinsSpent ?? 0)}</Typography>
                    <Typography variant="caption" color={theme.textTertiary} align="center">Spent (all time)</Typography>
                  </View>
                  <View style={{
                    flex: 1, padding: spacing.md, borderRadius: radius.lg,
                    backgroundColor: '#6366F1' + '18', alignItems: 'center', gap: spacing.xs,
                  }}>
                    <Typography variant="h4" color="#6366F1">{fmt(analytics?.totalCoinsInCirculation ?? 0)}</Typography>
                    <Typography variant="caption" color={theme.textTertiary} align="center">In Circulation</Typography>
                  </View>
                </View>

                {/* Flow bars */}
                <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  <CoinFlowRow
                    label="Earned"
                    value={analytics?.totalCoinsEarned ?? 0}
                    total={(analytics?.totalCoinsEarned ?? 0) + (analytics?.totalCoinsSpent ?? 0)}
                    color="#10B981"
                  />
                  <CoinFlowRow
                    label="Spent"
                    value={analytics?.totalCoinsSpent ?? 0}
                    total={(analytics?.totalCoinsEarned ?? 0) + (analytics?.totalCoinsSpent ?? 0)}
                    color="#EF4444"
                  />
                </View>
              </>
            )}
          </View>
        </Card>

        {/* ── Revenue Dashboard ── */}
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Typography variant="h4">💰 Revenue</Typography>
            </View>
            {revenueLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={60} borderRadius={radius.md} />
                <Skeleton height={60} borderRadius={radius.md} />
              </View>
            ) : revenue ? (
              <>
                {/* Total */}
                <View style={{
                  padding: spacing.md, borderRadius: radius.lg,
                  backgroundColor: '#10B98118', alignItems: 'center', gap: spacing.xs,
                }}>
                  <Typography variant="h3" color="#10B981">
                    ₹{((revenue.totalRevenuePaise ?? 0) / 100).toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary}>Total Revenue (All Time)</Typography>
                </View>

                {/* Subscription vs Coin Pack split */}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{
                    flex: 1, padding: spacing.md, borderRadius: radius.lg,
                    backgroundColor: '#6366F118', alignItems: 'center', gap: spacing.xs,
                  }}>
                    <Typography variant="label" color="#6366F1">
                      ₹{((revenue.subscriptions?.totalRevenuePaise ?? 0) / 100).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary} align="center">Subscriptions</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>
                      {revenue.subscriptions?.paymentCount ?? 0} payments
                    </Typography>
                  </View>
                  <View style={{
                    flex: 1, padding: spacing.md, borderRadius: radius.lg,
                    backgroundColor: '#F59E0B18', alignItems: 'center', gap: spacing.xs,
                  }}>
                    <Typography variant="label" color="#F59E0B">
                      ₹{((revenue.coinPacks?.totalRevenuePaise ?? 0) / 100).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary} align="center">Coin Packs</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>
                      {revenue.coinPacks?.purchaseCount ?? 0} purchases
                    </Typography>
                  </View>
                </View>

                {/* Trend bars */}
                <View style={{ gap: spacing.sm }}>
                  <CoinFlowRow
                    label="Last 7 days"
                    value={((revenue.subscriptions?.last7dPaise ?? 0) + (revenue.coinPacks?.last7dPaise ?? 0)) / 100}
                    total={(revenue.totalRevenuePaise ?? 1) / 100}
                    color="#10B981"
                  />
                  <CoinFlowRow
                    label="Last 30 days"
                    value={((revenue.subscriptions?.last30dPaise ?? 0) + (revenue.coinPacks?.last30dPaise ?? 0)) / 100}
                    total={(revenue.totalRevenuePaise ?? 1) / 100}
                    color="#6366F1"
                  />
                </View>
              </>
            ) : null}
          </View>
        </Card>

        {/* ── Shop Activity ── */}
        <Card>
          <View style={{ gap: spacing.md }}>
            <Typography variant="h4">🏪 Shop Activity</Typography>
            {analyticsLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={18} borderRadius={radius.md} />
                <Skeleton height={18} borderRadius={radius.md} />
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {[
                  { label: 'Active shop items', value: analytics?.shopItemCount ?? 0, icon: 'storefront-outline' as const, color: '#6366F1' },
                  { label: 'Flashcard packs purchased', value: analytics?.purchasedPackCount ?? 0, icon: 'library-outline' as const, color: '#8B5CF6' },
                  { label: 'Themes purchased', value: analytics?.purchasedThemeCount ?? 0, icon: 'color-palette-outline' as const, color: '#EC4899' },
                ].map((row) => (
                  <View
                    key={row.label}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Ionicons name={row.icon} size={18} color={row.color} />
                      <Typography variant="body" color={theme.textSecondary}>{row.label}</Typography>
                    </View>
                    <Typography variant="label" color={row.color}>{fmt(row.value)}</Typography>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>

        {/* ── Global Leaderboard ── */}
        <View style={{ gap: spacing.sm }}>
          <Typography variant="overline" color={theme.textTertiary}>Global Leaderboard (Top 10)</Typography>
          {leaderboardLoading ? (
            <View style={{ gap: spacing.sm }}>
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={60} borderRadius={radius.lg} />)}
            </View>
          ) : (
            (leaderboard?.entries ?? []).slice(0, 10).map((entry) => {
              const rankColor = RANK_COLOURS[entry.rank] ?? theme.surfaceElevated;
              return (
                <View
                  key={entry.userId}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    backgroundColor: theme.card, borderRadius: radius.lg, padding: spacing.md,
                    borderWidth: 1, borderColor: theme.border,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: radius.full,
                    backgroundColor: rankColor, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography variant="label" color={entry.rank <= 3 ? '#1A1A1A' : theme.textSecondary}>
                      {entry.rank}
                    </Typography>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="body">{entry.displayName}</Typography>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Typography variant="caption" color={theme.textTertiary}>🪙</Typography>
                    <Typography variant="label" color={theme.primary}>{fmt(entry.score)}</Typography>
                  </View>
                </View>
              );
            })
          )}
          {!leaderboardLoading && (leaderboard?.entries ?? []).length === 0 && (
            <Card>
              <Typography variant="body" align="center" color={theme.textTertiary}>
                No leaderboard entries yet
              </Typography>
            </Card>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
