// ─── Power-Ups Tab ───────────────────────────────────────────
// Extracted from shop.tsx (TD4) — shows streak freeze inventory,
// vulnerability warning, and purchase option.

import React from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { ErrorState } from '../ui/ErrorState';
import type { ShopItem } from '@kd/shared';

export interface PowerUpsTabProps {
  powerups: ShopItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onUnlock: (item: ShopItem) => void;
  isPurchasing: boolean;
  streakData: { currentStreak: number; streakFreezes: number } | null;
}

export function PowerUpsTab({
  powerups, isLoading, isError, onRetry, onUnlock, isPurchasing, streakData,
}: PowerUpsTabProps) {
  const { theme } = useTheme();
  const userFreezes = streakData?.streakFreezes ?? 0;

  if (isError) {
    return (
      <ErrorState
        message="Could not load power-ups. Please try again."
        onRetry={onRetry}
      />
    );
  }
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }
  if (powerups.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <Typography variant="body" color={theme.textTertiary} style={{ textAlign: 'center' }}>
          No power-ups available yet. Check back soon!
        </Typography>
      </View>
    );
  }

  const currentStreak = streakData?.currentStreak ?? 0;
  const isVulnerable = currentStreak >= 7 && userFreezes === 0;
  const bannerBg = isVulnerable ? '#EF444418' : theme.cardAlt;
  const bannerColor = isVulnerable ? '#EF4444' : theme.textSecondary;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'], gap: spacing.md }}
    >
      {/* ── Streak Context Banner ── */}
      <View style={{
        backgroundColor: bannerBg,
        borderRadius: 14,
        padding: spacing.md,
        gap: spacing.xs,
        borderWidth: isVulnerable ? 1 : 0,
        borderColor: isVulnerable ? '#EF444444' : 'transparent',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Typography variant="label" color={bannerColor}>
            {currentStreak > 0 ? `🔥 ${currentStreak}-day streak active` : '🔥 No active streak'}
          </Typography>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Typography variant="bodySmall" color={theme.textTertiary}>
            🛡 {userFreezes} / 3 freezes owned
          </Typography>
        </View>
        {isVulnerable && (
          <Typography variant="caption" color="#EF4444" style={{ marginTop: 2 }}>
            ⚠️ Your {currentStreak}-day streak has no protection!
          </Typography>
        )}
        {currentStreak === 0 && (
          <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: 2 }}>
            Start a streak by studying today
          </Typography>
        )}
      </View>

      {/* ── Power-up Cards ── */}
      {powerups.map((item) => {
        const atCap = item.name === 'Streak Freeze' && userFreezes >= 3;

        return (
          <View
            key={item.id}
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{
                width: 48, height: 48, borderRadius: 14,
                backgroundColor: theme.primary + '18',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="shield-checkmark" size={24} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label">{item.name}</Typography>
                <Typography variant="caption" color={theme.textTertiary}>{item.description}</Typography>
              </View>
            </View>

            {/* Inventory indicator */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginTop: spacing.md, paddingTop: spacing.md,
              borderTopWidth: 1, borderTopColor: theme.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="layers-outline" size={16} color={theme.textSecondary} />
                <Typography variant="bodySmall" color={theme.textSecondary}>
                  Owned: {userFreezes} / 3
                </Typography>
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: atCap ? theme.border : theme.primary,
                  borderRadius: 10,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}
                disabled={atCap || isPurchasing}
                onPress={() => onUnlock(item)}
              >
                <Typography variant="label" color={atCap ? theme.textTertiary : '#FFFFFF'}>
                  {atCap ? 'Max Capacity' : `Buy for ${item.price} 🪙`}
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
