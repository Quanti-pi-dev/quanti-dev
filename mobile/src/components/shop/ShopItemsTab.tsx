// ─── Shop Items Tab ──────────────────────────────────────────
// Extracted from shop.tsx (TD4) — renders card packs and themes
// in a 2-column grid using RewardCard.

import React from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { ErrorState } from '../ui/ErrorState';
import { RewardCard } from '../RewardCard';
import type { ShopItem } from '@kd/shared';

export interface ShopItemsTabProps {
  items: ShopItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onUnlock: (item: ShopItem) => void;
  isItemPurchased: (item: ShopItem) => boolean;
  userCoins: number;
  emptyMessage: string;
}

export function ShopItemsTab({
  items, isLoading, isError, onRetry, onUnlock, isItemPurchased, userCoins, emptyMessage,
}: ShopItemsTabProps) {
  const { theme } = useTheme();

  if (isError) {
    return (
      <ErrorState
        message="Could not load shop items. Please try again."
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
  if (items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <Typography variant="body" color={theme.textTertiary} style={{ textAlign: 'center' }}>
          {emptyMessage}
        </Typography>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {items.map((item) => {
          const purchased = isItemPurchased(item);
          const icon = item.category === 'flashcard_pack' ? 'library-outline' : 'color-palette-outline';

          return (
            <RewardCard
              key={item.id}
              name={item.name}
              description={item.cardCount ? `${item.description} · ${item.cardCount} cards` : item.description}
              icon={icon}
              price={item.price}
              unlocked={purchased}
              userCoins={userCoins}
              onUnlock={() => onUnlock(item)}
              style={{ width: '47%' }}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}
