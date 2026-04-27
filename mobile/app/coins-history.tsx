// ─── Coin History Screen ─────────────────────────────────────
// Paginated log of every coin earned and spent.

import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { spacing } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Typography } from '../src/components/ui/Typography';
import { ErrorState } from '../src/components/ui/ErrorState';
import { CoinDisplay } from '../src/components/CoinDisplay';
import { useCoinBalance, useCoinHistory } from '../src/hooks/useGamification';
import { formatCompactDateTime } from '../src/utils/time';
import type { CoinTransaction } from '@kd/shared';

// ─── Reason → Human label mapping ────────────────────────────
const REASON_LABEL: Record<string, { label: string; icon: string }> = {
  correct_answer:          { label: 'Correct Answer',     icon: '✅' },
  level_unlock:            { label: 'Level Unlocked',     icon: '🔓' },
  master_level_completed:  { label: 'Master Complete',    icon: '🏆' },
  perfect_session:         { label: 'Perfect Session',    icon: '🎯' },
  streak_3:                { label: '3-Day Streak',       icon: '🔥' },
  streak_7:                { label: '7-Day Streak',       icon: '🔥' },
  streak_30:               { label: '30-Day Streak',      icon: '🔥' },
  shop_purchase:           { label: 'Shop Purchase',      icon: '🛍️' },
  coin_pack_purchase:      { label: 'Coin Pack',          icon: '💎' },
  custom_coin_purchase:    { label: 'Custom Purchase',    icon: '💳' },
  streak_freeze_purchase:  { label: 'Streak Freeze',      icon: '🛡️' },
  challenge_bet:           { label: 'Challenge Bet',      icon: '⚔️' },
  challenge_won:           { label: 'Challenge Won',      icon: '🏆' },
  challenge_refund:        { label: 'Challenge Refund',   icon: '↩️' },
  tournament_entry:        { label: 'Tournament Entry',   icon: '🎮' },
  admin_award:             { label: 'Admin Award',        icon: '🎁' },
};



function TransactionRow({ tx }: { tx: CoinTransaction }) {
  const { theme } = useTheme();
  const isEarn = tx.amount > 0;
  const meta = REASON_LABEL[tx.reason] ?? { label: tx.reason.replace(/_/g, ' '), icon: '💰' };

  const label = `${isEarn ? 'Earned' : 'Spent'} ${Math.abs(tx.amount)} coins for ${meta.label} on ${formatCompactDateTime(tx.createdAt)}`;

  return (
    <View
      accessible={true}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.base,
        backgroundColor: theme.surface,
        borderRadius: 12,
        marginBottom: spacing.sm,
        gap: spacing.sm,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: isEarn ? `${theme.success}22` : `${theme.error}22`,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Typography variant="bodyLarge">{meta.icon}</Typography>
      </View>

      {/* Label + date */}
      <View style={{ flex: 1 }}>
        <Typography variant="body" style={{ textTransform: 'capitalize' }}>
          {meta.label}
        </Typography>
        <Typography variant="bodySmall" color={theme.textTertiary}>
          {formatCompactDateTime(tx.createdAt)}
        </Typography>
      </View>

      {/* Amount */}
      <Typography
        variant="body"
        color={isEarn ? theme.success : theme.error}
        style={{ fontWeight: '700' }}
      >
        {isEarn ? `+${tx.amount}` : tx.amount} 🪙
      </Typography>
    </View>
  );
}

export default function CoinHistoryScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data: coinData } = useCoinBalance();
  const { data, isLoading, isError, isFetching, refetch } = useCoinHistory(page);

  const transactions = data?.data ?? [];
  const pagination = data?.pagination;
  const coins = coinData?.balance ?? 0;

  return (
    <ScreenWrapper>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: spacing.xl, paddingTop: spacing.base, paddingBottom: spacing.md,
        }}
      >
        <View>
          <Typography variant="h3">Coin History</Typography>
          <Typography variant="bodySmall" color={theme.textTertiary}>
            Your earn & spend log
          </Typography>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <CoinDisplay coins={coins} size="lg" />
          {/* FIX U6: Standard back arrow instead of close icon */}
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={28} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Summary chips ── */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.base }}>
        <View
          style={{
            paddingHorizontal: spacing.base, paddingVertical: spacing.xs,
            backgroundColor: `${theme.success}18`, borderRadius: 20,
          }}
        >
          <Typography variant="bodySmall" color={theme.success}>
            Lifetime earned: {coinData?.lifetimeEarned ?? 0} 🪙
          </Typography>
        </View>
      </View>

      {/* ── Transaction list ── */}
      {isError ? (
        <ErrorState
          message="Could not load transaction history. Please try again."
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : transactions.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Typography variant="body" color={theme.textTertiary} style={{ textAlign: 'center' }}>
            No transactions yet. Start studying to earn your first coins!
          </Typography>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] }}
        >
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}

          {/* ── Pagination ── */}
          {pagination && (pagination.hasNextPage || pagination.hasPreviousPage) && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.lg }}>
              <TouchableOpacity
                disabled={!pagination.hasPreviousPage || isFetching}
                onPress={() => setPage((p) => p - 1)}
                accessibilityRole="button"
                accessibilityLabel="Newer transactions"
                accessibilityState={{ disabled: !pagination.hasPreviousPage || isFetching }}
                style={{
                  paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
                  backgroundColor: pagination.hasPreviousPage ? theme.primary : theme.surface,
                  borderRadius: 8, opacity: pagination.hasPreviousPage ? 1 : 0.4,
                }}
              >
                <Typography variant="bodySmall" color={pagination.hasPreviousPage ? theme.buttonPrimaryText : theme.textTertiary}>
                  ← Newer
                </Typography>
              </TouchableOpacity>

              <Typography variant="bodySmall" color={theme.textSecondary} style={{ alignSelf: 'center' }}>
                {page} / {pagination.totalPages}
              </Typography>

              <TouchableOpacity
                disabled={!pagination.hasNextPage || isFetching}
                onPress={() => setPage((p) => p + 1)}
                accessibilityRole="button"
                accessibilityLabel="Older transactions"
                accessibilityState={{ disabled: !pagination.hasNextPage || isFetching }}
                style={{
                  paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
                  backgroundColor: pagination.hasNextPage ? theme.primary : theme.surface,
                  borderRadius: 8, opacity: pagination.hasNextPage ? 1 : 0.4,
                }}
              >
                <Typography variant="bodySmall" color={pagination.hasNextPage ? theme.buttonPrimaryText : theme.textTertiary}>
                  Older →
                </Typography>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}
