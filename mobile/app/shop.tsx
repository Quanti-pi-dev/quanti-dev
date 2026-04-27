// ─── Reward Shop ──────────────────────────────────────────────
// TD4: Decomposed into sub-components under src/components/shop/
// This file now acts as the orchestrator for shared state.
//
// Tabs: Coin Packs (IAP + custom), Power-Ups, Card Packs, and Themes.
// Shows purchased state and applies effects on purchase.

import { useState, useCallback, useRef } from 'react';
import {
  View, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { spacing } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Typography } from '../src/components/ui/Typography';
import { CoinDisplay } from '../src/components/CoinDisplay';
import { PurchaseSuccessSheet } from '../src/components/PurchaseSuccessSheet';
import { CoinPacksTab } from '../src/components/shop/CoinPacksTab';
import { PowerUpsTab } from '../src/components/shop/PowerUpsTab';
import { ShopItemsTab } from '../src/components/shop/ShopItemsTab';
import {
  useCoinBalance,
  useShopItems,
  useUnlockedDecks,
  usePurchaseItem,
} from '../src/hooks/useGamification';
import { useStudyStreak } from '../src/hooks/useProgress';
import { useGlobalUI } from '../src/contexts/GlobalUIContext';
import type { ShopItem } from '@kd/shared';

type Tab = 'coins' | 'powerups' | 'packs' | 'themes';

export default function ShopScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { showAlert, showToast } = useGlobalUI();
  const [activeTab, setActiveTab] = useState<Tab>('coins');
  const [successSheet, setSuccessSheet] = useState<{
    visible: boolean; icon: string; title: string; subtitle?: string;
    coinsSpent?: number; newBalance?: number;
  }>({ visible: false, icon: '✅', title: '' });

  // ─── Data hooks ───────────────────────────────────────────
  const { data: coinData, isLoading: coinsLoading, isError: coinsError, refetch: refetchCoins } = useCoinBalance();
  const { data: items, isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useShopItems();
  const { data: unlockedDeckIds = [] } = useUnlockedDecks();
  const purchaseMutation = usePurchaseItem();
  const { data: streakData } = useStudyStreak();

  const coins = coinData?.balance ?? 0;

  // Use a ref for the latest balance to avoid stale closures in async callbacks.
  const coinBalanceRef = useRef(coins);
  coinBalanceRef.current = coins;

  // ─── Categorized items ────────────────────────────────────
  const packs = (items ?? []).filter((i) => i.category === 'flashcard_pack');
  const themes = (items ?? []).filter((i) => i.category === 'theme');
  const powerups = (items ?? []).filter((i) => i.category === 'power_up');

  // Track theme purchases in local state (no server endpoint for these)
  const [purchasedThemeIds, setPurchasedThemeIds] = useState<string[]>([]);

  const isItemPurchased = useCallback((item: ShopItem): boolean => {
    if (item.category === 'flashcard_pack' && item.deckId) {
      return unlockedDeckIds.includes(item.deckId);
    }
    if (item.category === 'theme') {
      return purchasedThemeIds.includes(item.id);
    }
    return false;
  }, [unlockedDeckIds, purchasedThemeIds]);

  // ─── Shared purchase handler ─────────────────────────────────────────
  const handleUnlock = useCallback((item: ShopItem) => {
    if (isItemPurchased(item)) {
      showToast('You already own this item.', 'info');
      return;
    }
    if (coins < item.price) {
      showAlert({
        title: 'Not Enough Coins',
        message: `You need ${item.price} coins to unlock "${item.name}". You have ${coins}.`,
        type: 'warning',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    const label = item.category === 'flashcard_pack'
      ? `Unlock "${item.name}"${item.cardCount ? ` (${item.cardCount} cards)` : ''} for ${item.price} coins?`
      : item.category === 'power_up'
        ? `Buy "${item.name}" for ${item.price} coins?`
        : `Apply the "${item.name}" theme for ${item.price} coins?`;

    showAlert({
      title: 'Confirm Purchase',
      message: label,
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          onPress: () => {
            purchaseMutation.mutate(item.id, {
              onSuccess: (res) => {
                const icon = res.effect?.type === 'power_up' ? '🛡️'
                  : res.effect?.type === 'theme' ? '🎨' : '✅';
                const subtitle = res.effect?.type === 'theme'
                  ? 'Theme is now active!'
                  : res.effect?.type === 'flashcard_pack'
                    ? 'Deck is now in your study feed.'
                    : res.effect?.type === 'power_up'
                      ? 'Streak Freeze added to inventory!'
                      : res.message;
                setSuccessSheet({
                  visible: true, icon, title: 'Unlocked!',
                  subtitle, coinsSpent: item.price,
                  newBalance: coinBalanceRef.current - item.price,
                });
                if (item.category === 'theme') {
                  setPurchasedThemeIds(prev => [...prev, item.id]);
                }
              },
              onError: (err: unknown) => {
                const msg = err instanceof Error ? err.message : 'Please try again.';
                showToast(msg, 'error');
              },
            });
          },
        },
      ],
    });
  }, [coins, isItemPurchased, purchaseMutation, coinBalanceRef, showAlert, showToast]);


  // ─── Coin pack purchase success callback ──────────────────
  const handleCoinPurchaseSuccess = useCallback((
    icon: string, title: string, subtitle: string, newBalance: number,
  ) => {
    setSuccessSheet({ visible: true, icon, title, subtitle, newBalance });
  }, []);

  // ─── Tab styling ──────────────────────────────────────────
  const tabStyle = (tab: Tab) => ({
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
    backgroundColor: activeTab === tab ? theme.primary + '15' : 'transparent',
  });

  const retryAll = useCallback(() => {
    void refetchCoins();
    void refetchItems();
  }, [refetchCoins, refetchItems]);

  // ─── Render ───────────────────────────────────────────────
  return (
    <ScreenWrapper>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: spacing.xl, paddingTop: spacing.base, paddingBottom: spacing.sm,
        }}
      >
        <Typography variant="h3">Reward Shop</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {coinsLoading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <CoinDisplay coins={coins} size="lg" />
          )}
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

      <Typography
        variant="bodySmall"
        color={theme.textTertiary}
        style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.base }}
      >
        Buy coins, unlock flashcard packs, and customize your experience
      </Typography>

      {/* ── Tabs ── */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: spacing.xl,
          marginBottom: spacing.base,
          gap: spacing.xs,
          backgroundColor: theme.cardAlt,
          borderRadius: 14,
          padding: 4,
        }}
      >
        <TouchableOpacity
          style={tabStyle('coins')}
          onPress={() => setActiveTab('coins')}
          accessibilityRole="tab"
          accessibilityLabel="Coins tab"
          accessibilityState={{ selected: activeTab === 'coins' }}
        >
          <Ionicons name="diamond-outline" size={16} color={activeTab === 'coins' ? theme.primary : theme.textTertiary} />
          <Typography
            variant="caption"
            color={activeTab === 'coins' ? theme.primary : theme.textSecondary}
            style={{ fontWeight: activeTab === 'coins' ? '700' : '500' }}
          >
            Coins
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity
          style={tabStyle('powerups')}
          onPress={() => setActiveTab('powerups')}
          accessibilityRole="tab"
          accessibilityLabel="Power-Ups tab"
          accessibilityState={{ selected: activeTab === 'powerups' }}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={activeTab === 'powerups' ? theme.primary : theme.textTertiary} />
          <Typography
            variant="caption"
            color={activeTab === 'powerups' ? theme.primary : theme.textSecondary}
            style={{ fontWeight: activeTab === 'powerups' ? '700' : '500' }}
          >
            Power-Ups
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity
          style={tabStyle('packs')}
          onPress={() => setActiveTab('packs')}
          accessibilityRole="tab"
          accessibilityLabel="Card Packs tab"
          accessibilityState={{ selected: activeTab === 'packs' }}
        >
          <Ionicons name="library-outline" size={16} color={activeTab === 'packs' ? theme.primary : theme.textTertiary} />
          <Typography
            variant="caption"
            color={activeTab === 'packs' ? theme.primary : theme.textSecondary}
            style={{ fontWeight: activeTab === 'packs' ? '700' : '500' }}
          >
            Cards
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity
          style={tabStyle('themes')}
          onPress={() => setActiveTab('themes')}
          accessibilityRole="tab"
          accessibilityLabel="Themes tab"
          accessibilityState={{ selected: activeTab === 'themes' }}
        >
          <Ionicons name="color-palette-outline" size={16} color={activeTab === 'themes' ? theme.primary : theme.textTertiary} />
          <Typography
            variant="caption"
            color={activeTab === 'themes' ? theme.primary : theme.textSecondary}
            style={{ fontWeight: activeTab === 'themes' ? '700' : '500' }}
          >
            Themes
          </Typography>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {activeTab === 'coins' && (
        <CoinPacksTab
          coinBalanceRef={coinBalanceRef}
          onPurchaseSuccess={handleCoinPurchaseSuccess}
        />
      )}
      {activeTab === 'powerups' && (
        <PowerUpsTab
          powerups={powerups}
          isLoading={coinsLoading || itemsLoading}
          isError={coinsError || itemsError}
          onRetry={retryAll}
          onUnlock={handleUnlock}
          isPurchasing={purchaseMutation.isPending}
          streakData={streakData ? { currentStreak: streakData.currentStreak, streakFreezes: streakData.streakFreezes ?? 0 } : null}
        />
      )}
      {(activeTab === 'packs' || activeTab === 'themes') && (
        <ShopItemsTab
          items={activeTab === 'packs' ? packs : themes}
          isLoading={coinsLoading || itemsLoading}
          isError={coinsError || itemsError}
          onRetry={retryAll}
          onUnlock={handleUnlock}
          isItemPurchased={isItemPurchased}
          userCoins={coins}
          emptyMessage={
            activeTab === 'packs'
              ? 'No card packs available yet. Check back soon!'
              : 'No themes available yet. Check back soon!'
          }
        />
      )}

      {/* ── Purchase success overlay ── */}
      <PurchaseSuccessSheet
        visible={successSheet.visible}
        icon={successSheet.icon}
        title={successSheet.title}
        subtitle={successSheet.subtitle}
        coinsSpent={successSheet.coinsSpent}
        newBalance={successSheet.newBalance}
        onDismiss={() => setSuccessSheet((s) => ({ ...s, visible: false }))}
      />
    </ScreenWrapper>
  );
}
