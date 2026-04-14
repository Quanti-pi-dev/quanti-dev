// ─── CoinPackCard ────────────────────────────────────────────
// Premium coin pack display card for the shop. Shows coin count,
// price, and optional badge (e.g. "Most Popular", "Best Value").

import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import type { CoinPack } from '../services/coinpack.service';

interface CoinPackCardProps {
  pack: CoinPack;
  onBuy: (pack: CoinPack) => void;
  loading?: boolean;
}

export function CoinPackCard({ pack, onBuy, loading }: CoinPackCardProps) {
  const { theme } = useTheme();
  const priceRupees = (pack.pricePaise / 100).toFixed(0);
  const perCoin = (pack.pricePaise / 100 / pack.coins).toFixed(2);
  const isFeatured = !!pack.badgeText;

  return (
    <View style={{
      borderRadius: radius['2xl'],
      borderWidth: isFeatured ? 2 : 1,
      borderColor: isFeatured ? theme.primary : theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Featured badge */}
      {pack.badgeText && (
        <LinearGradient
          colors={[theme.primary, '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingVertical: spacing.xs,
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <Typography variant="caption" color="#FFFFFF" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
            ⭐ {pack.badgeText}
          </Typography>
        </LinearGradient>
      )}

      <View style={{
        padding: spacing.lg,
        paddingTop: pack.badgeText ? spacing.lg + 24 : spacing.lg,
        alignItems: 'center',
        gap: spacing.sm,
      }}>
        {/* Coin icon + amount */}
        <View style={{
          backgroundColor: 'rgba(255, 199, 0, 0.15)',
          width: 56,
          height: 56,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="logo-bitcoin" size={32} color="#FFC700" />
        </View>

        <Typography variant="h3" align="center">
          {pack.coins.toLocaleString()}
        </Typography>
        <Typography variant="caption" color={theme.textTertiary} align="center">
          coins
        </Typography>

        {/* Per-coin pricing */}
        <Typography variant="caption" color={theme.textSecondary} align="center">
          ₹{perCoin}/coin
        </Typography>

        {/* Savings vs custom rate (₹1 = 1 coin) */}
        {Number(perCoin) < 1 && (
          <View style={{
            backgroundColor: '#10B98118',
            borderRadius: 8,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}>
            <Typography variant="caption" color="#10B981" align="center" style={{ fontWeight: '700' }}>
              Save {Math.round((1 - Number(perCoin)) * 100)}%
            </Typography>
          </View>
        )}

        {/* Name + description */}
        <Typography variant="label" align="center" style={{ marginTop: spacing.xs }}>
          {pack.name}
        </Typography>
        {pack.description ? (
          <Typography variant="caption" color={theme.textTertiary} align="center" numberOfLines={2}>
            {pack.description}
          </Typography>
        ) : null}

        {/* Buy button */}
        <TouchableOpacity
          onPress={() => onBuy(pack)}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: theme.primary,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.sm,
            borderRadius: radius.full,
            marginTop: spacing.sm,
            opacity: loading ? 0.6 : 1,
            width: '100%',
            alignItems: 'center',
          }}
        >
          <Typography variant="label" color="#FFFFFF">
            {loading ? 'Processing...' : `Buy · ₹${priceRupees}`}
          </Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
}
