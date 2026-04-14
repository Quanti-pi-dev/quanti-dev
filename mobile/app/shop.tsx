// ─── Reward Shop ──────────────────────────────────────────────
// Tabs: Coin Packs (IAP + custom), Power-Ups, Card Packs, and Themes.
// Shows purchased state and applies effects on purchase.

import { useState, useCallback, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RazorpayCheckout from 'react-native-razorpay';
import { useTheme } from '../src/theme';
import { spacing } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Typography } from '../src/components/ui/Typography';
import { ErrorState } from '../src/components/ui/ErrorState';
import { CoinDisplay } from '../src/components/CoinDisplay';
import { RewardCard } from '../src/components/RewardCard';
import { CoinPackCard } from '../src/components/CoinPackCard';
import { PurchaseSuccessSheet } from '../src/components/PurchaseSuccessSheet';
import {
  useCoinBalance,
  useShopItems,
  useUnlockedDecks,
  usePurchaseItem,
} from '../src/hooks/useGamification';
import { useCoinPacks, useCoinPackCheckout, useCoinPackVerify, useCustomCoinCheckout } from '../src/hooks/useCoinPacks';
import { useStudyStreak } from '../src/hooks/useProgress';
import type { ShopItem } from '@kd/shared';
import type { CoinPack } from '../src/services/coinpack.service';

type Tab = 'coins' | 'powerups' | 'packs' | 'themes';


export default function ShopScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('coins');
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [customCoinAmount, setCustomCoinAmount] = useState('');
  const [successSheet, setSuccessSheet] = useState<{
    visible: boolean; icon: string; title: string; subtitle?: string;
    coinsSpent?: number; newBalance?: number;
  }>({ visible: false, icon: '✅', title: '' });

  const { data: coinData, isLoading: coinsLoading, isError: coinsError, refetch: refetchCoins } = useCoinBalance();
  const { data: items, isLoading: itemsLoading, isError: itemsError, refetch: refetchItems } = useShopItems();
  const { data: unlockedDeckIds = [] } = useUnlockedDecks();
  const purchaseMutation = usePurchaseItem();

  // Coin packs
  const { data: coinPacks, isLoading: packsLoading, isError: packsError, refetch: refetchPacks } = useCoinPacks();
  const checkoutMutation = useCoinPackCheckout();
  const verifyMutation = useCoinPackVerify();
  const customCheckout = useCustomCoinCheckout();

  // Streak data (for freeze inventory)
  const { data: streakData } = useStudyStreak();

  const coins = coinData?.balance ?? 0;

  // FIX M1/M2: Use a ref for the latest balance to avoid stale closures
  // in async payment callbacks that may resolve long after coinData changes.
  const coinBalanceRef = useRef(coins);
  coinBalanceRef.current = coins;

  const packs = (items ?? []).filter((i) => i.category === 'flashcard_pack');
  const themes = (items ?? []).filter((i) => i.category === 'theme');
  const powerups = (items ?? []).filter((i) => i.category === 'power_up');

  const isItemPurchased = (item: ShopItem): boolean => {
    if (item.category === 'flashcard_pack' && item.deckId) {
      return unlockedDeckIds.includes(item.deckId);
    }
    // power_ups are consumables — never "purchased"
    return false;
  };

  const handleUnlock = (item: ShopItem) => {
    if (isItemPurchased(item)) {
      Alert.alert('Already Unlocked', 'You already own this item.');
      return;
    }
    if (coins < item.price) {
      Alert.alert(
        'Not Enough Coins',
        `You need ${item.price} coins to unlock "${item.name}". You have ${coins}.`,
      );
      return;
    }

    const label = item.category === 'flashcard_pack'
      ? `Unlock "${item.name}"${item.cardCount ? ` (${item.cardCount} cards)` : ''} for ${item.price} coins?`
      : item.category === 'power_up'
        ? `Buy "${item.name}" for ${item.price} coins?`
        : `Apply the "${item.name}" theme for ${item.price} coins?`;

    Alert.alert('Confirm Purchase', label, [
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
                newBalance: (coinData?.balance ?? 0) - item.price,
              });
            },
            onError: (err: unknown) => {
              const msg = err instanceof Error ? err.message : 'Please try again.';
              Alert.alert('Purchase Failed', msg);
            },
          });
        },
      },
    ]);
  };

  // ─── Coin Pack Purchase Flow ───────────────────────────────

  const handleBuyCoinPack = useCallback((pack: CoinPack) => {
    const priceRupees = (pack.pricePaise / 100).toFixed(0);

    Alert.alert(
      'Buy Coins',
      `Purchase ${pack.coins.toLocaleString()} coins for ₹${priceRupees}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Now',
          onPress: async () => {
            setBuyingPackId(pack.id);
            try {
              // 1. Create Razorpay order on the backend
              const result = await checkoutMutation.mutateAsync(pack.id);

              if (!result.keyId || !result.orderId || result.amountPaise == null) {
                throw new Error('Checkout response is missing payment details.');
              }

              // 2. Open native Razorpay payment modal
              const razorpayOptions = {
                key: result.keyId,
                order_id: result.orderId,
                amount: result.amountPaise,
                currency: 'INR',
                name: 'Quanti-pi',
                description: `${pack.coins} Coin Pack`,
                theme: { color: '#2563EB' },
              };

              const paymentResult = await RazorpayCheckout.open(razorpayOptions);

              // 3. Verify payment server-side & credit coins
              await verifyMutation.mutateAsync({
                razorpayOrderId: result.orderId,
                razorpayPaymentId: paymentResult.razorpay_payment_id,
                razorpaySignature: paymentResult.razorpay_signature,
              });

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setSuccessSheet({
                visible: true, icon: '💎', title: 'Coins Added!',
                subtitle: `${pack.coins.toLocaleString()} coins added to your balance`,
                newBalance: coinBalanceRef.current + pack.coins,
              });
            } catch (err) {
              // Razorpay SDK rejects with { code: 2 } on user cancel
              const razorpayErr = err as { code?: number; description?: string };
              if (razorpayErr.code === 2) return; // user cancelled
              const msg =
                razorpayErr.description ??
                (err instanceof Error ? err.message : 'Could not complete purchase.');
              Alert.alert('Checkout Failed', msg);
            } finally {
              setBuyingPackId(null);
            }
          },
        },
      ],
    );
  }, [checkoutMutation, verifyMutation, coinBalanceRef]);

  // ─── Tab styling ───────────────────────────────────────────

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

  // ─── Tab content ───────────────────────────────────────────

  const renderCoinPacks = () => {
    if (packsError) {
      return (
        <ErrorState
          message="Could not load coin packs. Please try again."
          onRetry={() => void refetchPacks()}
        />
      );
    }
    if (packsLoading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    const hasPacks = coinPacks && coinPacks.length > 0;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'], gap: spacing.md }}
      >
        {/* ── Custom Coin Purchase ── */}
        <View style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: theme.coin + '44',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Ionicons name="sparkles" size={20} color={theme.coin} />
            <Typography variant="label" color={theme.text}>Buy Custom Amount</Typography>
          </View>
          <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: spacing.md }}>
            1 Rupee = 1 Coin · Minimum 10 coins
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: theme.cardAlt,
                borderRadius: 12,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                fontSize: 18,
                fontWeight: '600',
                color: theme.text,
                borderWidth: 1,
                borderColor: theme.border,
              }}
              placeholder="e.g. 250"
              placeholderTextColor={theme.textTertiary}
              value={customCoinAmount}
              onChangeText={(t) => setCustomCoinAmount(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
            />
            <View style={{ alignItems: 'flex-end' }}>
              <Typography variant="h4" color={theme.coin}>
                ₹{parseInt(customCoinAmount || '0', 10).toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color={theme.textTertiary}>
                {parseInt(customCoinAmount || '0', 10).toLocaleString('en-IN')} coins
              </Typography>
            </View>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: parseInt(customCoinAmount || '0', 10) >= 10 ? theme.primary : theme.border,
              borderRadius: 12,
              paddingVertical: spacing.md,
              alignItems: 'center',
              marginTop: spacing.md,
            }}
            disabled={parseInt(customCoinAmount || '0', 10) < 10 || customCheckout.isPending}
            onPress={async () => {
              const coinCount = parseInt(customCoinAmount, 10);
              if (isNaN(coinCount) || coinCount < 10 || coinCount > 100000) return;
              try {
                const result = await customCheckout.mutateAsync(coinCount);
                const razorpayOptions = {
                  key: result.keyId,
                  order_id: result.orderId,
                  amount: result.amountPaise,
                  currency: 'INR',
                  name: 'Quanti-pi',
                  description: `${coinCount} Coins`,
                  theme: { color: '#2563EB' },
                };
                const paymentResult = await RazorpayCheckout.open(razorpayOptions);
                await verifyMutation.mutateAsync({
                  razorpayOrderId: result.orderId,
                  razorpayPaymentId: paymentResult.razorpay_payment_id,
                  razorpaySignature: paymentResult.razorpay_signature,
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setSuccessSheet({
                  visible: true, icon: '💳', title: 'Coins Added!',
                  subtitle: `${coinCount.toLocaleString()} coins added to your balance`,
                  newBalance: coinBalanceRef.current + coinCount,
                });
                setCustomCoinAmount('');
              } catch (err) {
                const razorpayErr = err as { code?: number; description?: string };
                if (razorpayErr.code === 2) return;
                const msg = razorpayErr.description ?? (err instanceof Error ? err.message : 'Could not complete purchase.');
                Alert.alert('Checkout Failed', msg);
              }
            }}
          >
            {customCheckout.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Typography variant="label" color={parseInt(customCoinAmount || '0', 10) >= 10 ? '#FFFFFF' : theme.textTertiary}>
                Buy Now
              </Typography>
            )}
          </TouchableOpacity>
        </View>

        {hasPacks && (
          <>
            <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginBottom: spacing.sm }}>
              Or choose a pre-made pack:
            </Typography>
            {coinPacks!.map((pack) => (
              <CoinPackCard
                key={pack.id}
                pack={pack}
                onBuy={handleBuyCoinPack}
                loading={buyingPackId === pack.id}
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  const renderPowerUps = () => {
    const isLoading = coinsLoading || itemsLoading;
    const isError = coinsError || itemsError;
    const userFreezes = streakData?.streakFreezes ?? 0;

    if (isError) {
      return (
        <ErrorState
          message="Could not load power-ups. Please try again."
          onRetry={() => { void refetchCoins(); void refetchItems(); }}
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
                  disabled={atCap || purchaseMutation.isPending}
                  onPress={() => handleUnlock(item)}
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
  };
  const renderShopItems = () => {
    const isLoading = coinsLoading || itemsLoading;
    const isError = coinsError || itemsError;
    const visibleItems = activeTab === 'packs' ? packs : themes;
    const emptyMsg = activeTab === 'packs'
      ? 'No card packs available yet. Check back soon!'
      : 'No themes available yet. Check back soon!';

    if (isError) {
      return (
        <ErrorState
          message="Could not load shop items. Please try again."
          onRetry={() => { void refetchCoins(); void refetchItems(); }}
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
    if (visibleItems.length === 0) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Typography variant="body" color={theme.textTertiary} style={{ textAlign: 'center' }}>
            {emptyMsg}
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
          {visibleItems.map((item) => {
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
                userCoins={coins}
                onUnlock={() => handleUnlock(item)}
                style={{ width: '47%' }}
              />
            );
          })}
        </View>
      </ScrollView>
    );
  };

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
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close-circle" size={28} color={theme.textTertiary} />
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
        <TouchableOpacity style={tabStyle('coins')} onPress={() => setActiveTab('coins')}>
          <Ionicons name="diamond-outline" size={16} color={activeTab === 'coins' ? theme.primary : theme.textTertiary} />
          <Typography
            variant="caption"
            color={activeTab === 'coins' ? theme.primary : theme.textSecondary}
            style={{ fontWeight: activeTab === 'coins' ? '700' : '500' }}
          >
            Coins
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity style={tabStyle('powerups')} onPress={() => setActiveTab('powerups')}>
          <Ionicons name="shield-checkmark-outline" size={16} color={activeTab === 'powerups' ? theme.primary : theme.textTertiary} />
          <Typography
            variant="caption"
            color={activeTab === 'powerups' ? theme.primary : theme.textSecondary}
            style={{ fontWeight: activeTab === 'powerups' ? '700' : '500' }}
          >
            Power-Ups
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity style={tabStyle('packs')} onPress={() => setActiveTab('packs')}>
          <Ionicons name="library-outline" size={16} color={activeTab === 'packs' ? theme.primary : theme.textTertiary} />
          <Typography
            variant="caption"
            color={activeTab === 'packs' ? theme.primary : theme.textSecondary}
            style={{ fontWeight: activeTab === 'packs' ? '700' : '500' }}
          >
            Cards
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity style={tabStyle('themes')} onPress={() => setActiveTab('themes')}>
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
      {activeTab === 'coins' && renderCoinPacks()}
      {activeTab === 'powerups' && renderPowerUps()}
      {(activeTab === 'packs' || activeTab === 'themes') && renderShopItems()}

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

