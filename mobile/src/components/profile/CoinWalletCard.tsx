// ─── CoinWalletCard ──────────────────────────────────────────
// Coin balance display with links to history and shop.
// Extracted from ProfileScreen for memoization.

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';

interface CoinWalletCardProps {
  coins: number;
  lifetimeEarned?: number | null;
  lifetimeSpent?: number | null;
  onHistoryPress: () => void;
  onShopPress: () => void;
}

export const CoinWalletCard = React.memo(function CoinWalletCard({
  coins,
  lifetimeEarned,
  lifetimeSpent,
  onHistoryPress,
  onShopPress,
}: CoinWalletCardProps) {
  const { theme } = useTheme();

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">🪙 Coin Wallet</Typography>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={onHistoryPress}
              style={{
                paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                borderRadius: radius.full, borderWidth: 1, borderColor: theme.border,
              }}
            >
              <Typography variant="caption" color={theme.textSecondary}>History</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onShopPress}
              style={{
                paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                borderRadius: radius.full, backgroundColor: theme.primary,
              }}
            >
              <Typography variant="caption" color={theme.buttonPrimaryText}>Shop</Typography>
            </TouchableOpacity>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            backgroundColor: theme.primaryMuted, borderRadius: radius.lg, padding: spacing.lg,
          }}
        >
          <Typography variant="h2" color={theme.coin ?? theme.primary}>{coins}</Typography>
          <View>
            <Typography variant="label" color={theme.textSecondary}>Coins available</Typography>
            {lifetimeEarned != null && (
              <Typography variant="caption" color={theme.textTertiary}>
                {lifetimeEarned} earned lifetime
              </Typography>
            )}
          </View>
        </View>

        {/* Stats row */}
        {(lifetimeEarned != null || lifetimeSpent != null) && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {lifetimeEarned != null && (
              <View style={{
                flex: 1, alignItems: 'center', gap: 2,
                backgroundColor: '#10B98112', borderRadius: radius.lg,
                paddingVertical: spacing.sm,
              }}>
                <Typography variant="caption" color={theme.textTertiary}>Earned</Typography>
                <Typography variant="label" color="#10B981">{lifetimeEarned.toLocaleString()}</Typography>
              </View>
            )}
            {lifetimeSpent != null && (
              <View style={{
                flex: 1, alignItems: 'center', gap: 2,
                backgroundColor: '#EF444412', borderRadius: radius.lg,
                paddingVertical: spacing.sm,
              }}>
                <Typography variant="caption" color={theme.textTertiary}>Spent</Typography>
                <Typography variant="label" color="#EF4444">{lifetimeSpent.toLocaleString()}</Typography>
              </View>
            )}
          </View>
        )}
      </View>
    </Card>
  );
});
