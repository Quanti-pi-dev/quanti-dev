// ─── Coin Packs Tab ──────────────────────────────────────────
// Extracted from shop.tsx (TD4) — handles IAP coin pack purchases
// and custom coin amount purchases via Razorpay.

import { useState, useCallback, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RazorpayCheckout from 'react-native-razorpay';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { ErrorState } from '../ui/ErrorState';
import { CoinPackCard } from '../CoinPackCard';
import { useCoinPacks, useCoinPackCheckout, useCoinPackVerify, useCustomCoinCheckout } from '../../hooks/useCoinPacks';
import type { CoinPack } from '../../services/coinpack.service';

export interface CoinPacksTabProps {
  coinBalanceRef: React.MutableRefObject<number>;
  onPurchaseSuccess: (icon: string, title: string, subtitle: string, newBalance: number) => void;
}

export function CoinPacksTab({ coinBalanceRef, onPurchaseSuccess }: CoinPacksTabProps) {
  const { theme } = useTheme();
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [customCoinAmount, setCustomCoinAmount] = useState('');

  const { data: coinPacks, isLoading: packsLoading, isError: packsError, refetch: refetchPacks } = useCoinPacks();
  const checkoutMutation = useCoinPackCheckout();
  const verifyMutation = useCoinPackVerify();
  const customCheckout = useCustomCoinCheckout();

  // ─── Pre-made pack purchase ───────────────────────────────
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
              const result = await checkoutMutation.mutateAsync(pack.id);
              if (!result.keyId || !result.orderId || result.amountPaise == null) {
                throw new Error('Checkout response is missing payment details.');
              }

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

              await verifyMutation.mutateAsync({
                razorpayOrderId: result.orderId,
                razorpayPaymentId: paymentResult.razorpay_payment_id,
                razorpaySignature: paymentResult.razorpay_signature,
              });

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onPurchaseSuccess(
                '💎', 'Coins Added!',
                `${pack.coins.toLocaleString()} coins added to your balance`,
                coinBalanceRef.current + pack.coins,
              );
            } catch (err) {
              const razorpayErr = err as { code?: number; description?: string };
              if (razorpayErr.code === 2) return;
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
  }, [checkoutMutation, verifyMutation, coinBalanceRef, onPurchaseSuccess]);

  // ─── Custom amount purchase ───────────────────────────────
  const handleCustomPurchase = async () => {
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
      onPurchaseSuccess(
        '💳', 'Coins Added!',
        `${coinCount.toLocaleString()} coins added to your balance`,
        coinBalanceRef.current + coinCount,
      );
      setCustomCoinAmount('');
    } catch (err) {
      const razorpayErr = err as { code?: number; description?: string };
      if (razorpayErr.code === 2) return;
      const msg = razorpayErr.description ?? (err instanceof Error ? err.message : 'Could not complete purchase.');
      Alert.alert('Checkout Failed', msg);
    }
  };

  // ─── Render ───────────────────────────────────────────────
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
  const coinAmount = parseInt(customCoinAmount || '0', 10);

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
              ₹{coinAmount.toLocaleString('en-IN')}
            </Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              {coinAmount.toLocaleString('en-IN')} coins
            </Typography>
          </View>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: coinAmount >= 10 ? theme.primary : theme.border,
            borderRadius: 12,
            paddingVertical: spacing.md,
            alignItems: 'center',
            marginTop: spacing.md,
          }}
          disabled={coinAmount < 10 || customCheckout.isPending}
          onPress={handleCustomPurchase}
        >
          {customCheckout.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Typography variant="label" color={coinAmount >= 10 ? '#FFFFFF' : theme.textTertiary}>
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
}
