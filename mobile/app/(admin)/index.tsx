// ─── Admin Dashboard ─────────────────────────────────────────


import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { spacing } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { StatCard } from '../../src/components/StatCard';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Icon } from '../../src/components/ui/Icon';
import { useAdminAnalytics } from '../../src/hooks/useGamification';

/** Format large numbers: 1200 → "1.2K" */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AdminDashboard() {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: analytics, isLoading } = useAdminAnalytics();

  return (
    <ScreenWrapper>
      <Header showBack title="Admin Panel" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
      >
        {/* Stats */}
        <View style={{ gap: spacing.sm }}>
          <Typography variant="overline" color={theme.textTertiary}>Overview</Typography>
          {isLoading ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Skeleton height={90} style={{ flex: 1, borderRadius: 16 }} />
                <Skeleton height={90} style={{ flex: 1, borderRadius: 16 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Skeleton height={90} style={{ flex: 1, borderRadius: 16 }} />
                <Skeleton height={90} style={{ flex: 1, borderRadius: 16 }} />
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <StatCard icon="people-outline" label="Users" value={fmt(analytics?.totalUsers ?? 0)} accent="#6366F1" />
                <StatCard icon="pulse-outline" label="Active Today" value={fmt(analytics?.activeUsersToday ?? 0)} accent="#10B981" />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <StatCard icon="library-outline" label="Sessions" value={fmt(analytics?.totalSessions ?? 0)} accent="#8B5CF6" />
                <StatCard icon="flash-outline" label="Cards Answered" value={fmt(analytics?.totalCardsAnswered ?? 0)} accent="#F59E0B" />
              </View>
            </>
          )}
        </View>

        {/* Quick actions */}
        <View style={{ gap: spacing.md }}>
          <Typography variant="h4">Quick Actions</Typography>
          <Card pressable onPress={() => router.push('/(admin)/content')} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="book-outline" size={22} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Manage Exams</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Create, edit, delete exam categories</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/content')} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="albums-outline" size={22} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Manage Flashcards</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Browse subjects → topics → levels to add cards</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/shop-editor')} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="gift-outline" size={22} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Shop Items</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Manage purchasable packs and themes</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/badges' as never)} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="ribbon-outline" size={22} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Badges</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Create and manage achievement badges</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/tournaments' as never)} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="trophy-outline" size={22} color="#6366F1" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Tournaments</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Create, manage, and monitor competitions</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/decks' as never)} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="layers-outline" size={22} color="#3B82F6" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Deck Browser</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Browse and manage all content decks</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/plans' as never)} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="card-outline" size={22} color="#8B5CF6" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Subscription Plans</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Create and tweak plan pricing & features</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/coupons' as never)} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="pricetag-outline" size={22} color="#F97316" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Coupons</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Create and manage discount coupons</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/subscriptions' as never)} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="receipt-outline" size={22} color="#EC4899" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Manage Subscriptions</Typography>
                <Typography variant="caption" color={theme.textTertiary}>View, grant, and manage user subscriptions</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/analytics' as never)} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="analytics-outline" size={22} color="#14B8A6" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Analytics Dashboard</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Platform health, engagement, and revenue metrics</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>

          <Card pressable onPress={() => router.push('/(admin)/config' as never)} variant="outlined">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="settings-outline" size={22} color="#06B6D4" />
              <View style={{ flex: 1 }}>
                <Typography variant="label">Platform Config</Typography>
                <Typography variant="caption" color={theme.textTertiary}>Edit marketing copy, coin values, UI toggles — no deploy needed</Typography>
              </View>
              <Icon name="chevron-forward" size={18} color={theme.textTertiary} />
            </View>
          </Card>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

