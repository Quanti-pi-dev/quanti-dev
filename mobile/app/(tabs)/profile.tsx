// ─── Profile Screen ───────────────────────────────────────────
// Slim composer that delegates to memoized sub-components.
// Phase 2.3: Split from 667 lines → ~110 lines.
// Sub-components: ProfileHeader, SubscriptionCard, CoinWalletCard,
//                 BadgeShowcase, SettingsSection, EditProfileModal.

import { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { StatTile } from '../../src/components/StatTile';
import { useAuth } from '../../src/contexts/AuthContext';
import { useCoinBalance, useUserBadges } from '../../src/hooks/useGamification';
import { useProgressSummary, useStudyStreak } from '../../src/hooks/useProgress';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { api } from '../../src/services/api';
import type { UserBadge } from '@kd/shared';

import {
  ProfileHeader,
  SubscriptionCard,
  CoinWalletCard,
  BadgeShowcase,
  SettingsSection,
  EditProfileModal,
} from '../../src/components/profile';
import type { EarnedBadge } from '../../src/components/profile';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Screen ───────────────────────────────────────────────────

export default function ProfileScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, preferences, logout, refreshUser } = useAuth();
  const router = useRouter();
  const { registerForPushNotifications } = usePushNotifications();
  const { data: coinData } = useCoinBalance();
  const { data: progressData } = useProgressSummary();
  const { data: streakData } = useStudyStreak();
  const { data: userBadges } = useUserBadges();

  const name = user?.displayName ?? user?.email?.split('@')[0] ?? 'Student';
  const email = user?.email ?? '';
  const avatarUri = user?.avatarUrl ?? null;
  const isAdmin = user?.role === 'admin';
  const coins = coinData?.balance ?? 0;

  // ─── Derived stats ──────────────────────────────────────────
  const solved = String(progressData?.totalCardsCompleted ?? 0);
  const accuracy = progressData?.overallAccuracy != null
    ? `${Math.round(progressData.overallAccuracy)}%` : '—';
  const streak = streakData?.currentStreak ?? 0;

  // ─── Earned badges ─────────────────────────────────────────
  const earnedBadges = useMemo<EarnedBadge[]>(() =>
    ((userBadges ?? []) as UserBadge[])
      .filter((b) => b.earnedAt != null)
      .slice(0, 3)
      .map((b) => ({
        id: b.badgeId,
        name: b.badge?.name ?? 'Badge',
        icon: (b.badge?.iconUrl ?? 'ribbon-outline') as IoniconName,
        earned: true,
        accent: theme.primary,
      })),
    [userBadges, theme.primary],
  );

  // ─── Edit modal state ──────────────────────────────────────
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Logout confirmation (FIX U9)
  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
      >
        <ProfileHeader
          name={name}
          email={email}
          avatarUri={avatarUri}
          isAdmin={isAdmin}
          coins={coins}
          onEditPress={() => setEditModalVisible(true)}
          onCoinsPress={() => router.push('/coins-history')}
          onCartPress={() => router.push('/shop')}
        />

        <SubscriptionCard />

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile label="Solved" value={solved} color={theme.statSolved} />
          <StatTile label="Accuracy" value={accuracy} color={theme.statAccuracy} />
          <StatTile label="Streak" value={`${streak}d`} color={theme.statStreak} />
        </View>

        <CoinWalletCard
          coins={coins}
          lifetimeEarned={coinData?.lifetimeEarned}
          lifetimeSpent={coinData?.lifetimeEarned != null ? coinData.lifetimeEarned - coins : null}
          onHistoryPress={() => router.push('/coins-history')}
          onShopPress={() => router.push('/shop')}
        />

        <BadgeShowcase badges={earnedBadges} />

        <SettingsSection
          isDark={isDark}
          isAdmin={isAdmin}
          notificationsEnabled={preferences?.notificationsEnabled ?? false}
          onToggleTheme={toggleTheme}
          onToggleNotifications={async (enabled) => {
            try {
              await api.put('/users/preferences', { notificationsEnabled: enabled });
              if (enabled) {
                await registerForPushNotifications();
              }
              await refreshUser();
            } catch {
              Alert.alert('Error', 'Failed to update notification settings. Please try again.');
            }
          }}
          onLogout={handleLogout}
        />
      </ScrollView>

      <EditProfileModal
        visible={editModalVisible}
        name={name}
        avatarUri={avatarUri}
        onClose={() => setEditModalVisible(false)}
        onSaved={refreshUser}
      />
    </ScreenWrapper>
  );
}
