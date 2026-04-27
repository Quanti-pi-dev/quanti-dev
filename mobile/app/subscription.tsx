// ─── SubscriptionScreen ───────────────────────────────────────
// Plans pricing page: toggle cycle, view plans, enter coupon, checkout.
// All built from decomposed components — this screen is pure composition.

import { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import RazorpayCheckout from 'react-native-razorpay';

import { useTheme } from '../src/theme';
import { useGlobalUI } from '../src/contexts/GlobalUIContext';
import { spacing, radius } from '../src/theme/tokens';
import { Typography } from '../src/components/ui/Typography';
import { PricingToggle } from '../src/components/subscription/PricingToggle';
import { PlanCard } from '../src/components/subscription/PlanCard';
import { CouponInput } from '../src/components/subscription/CouponInput';
import { CurrentSubscriptionBanner } from '../src/components/subscription/CurrentSubscriptionBanner';
import { useSubscription } from '../src/contexts/SubscriptionContext';
import {
  fetchPlans,
  initiateCheckout,
  verifyPayment,
} from '../src/services/subscription.service';
import { useConfig } from '../src/contexts/ConfigContext';
import type { Plan, CouponValidationResult } from '@kd/shared';
import type { BillingCycle } from '@kd/shared';

// ─── Sub-components (local, private to screen) ────────────────

/** Sticky header with back button and title. Shows 'Not Now' skip when in onboarding context. */
function ScreenHeader({ onBack, onSkip }: { onBack: () => void; onSkip?: () => void }) {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const subscriptionHeadline = useConfig('subscription_headline', 'Upgrade Your Learning');
  const subscriptionSubheadline = useConfig('subscription_subheadline', 'Unlock the full Quanti-pi experience');
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <LinearGradient
        colors={[theme.primaryDark ?? '#1E3A5F', theme.primary, '#6366F1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing['2xl'] }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.8)" />
            <Typography variant="bodySmall" color="rgba(255,255,255,0.8)">Back</Typography>
          </TouchableOpacity>

          {onSkip && (
            <TouchableOpacity
              onPress={onSkip}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Skip subscription for now"
            >
              <Typography variant="bodySmall" color="rgba(255,255,255,0.7)">Not Now</Typography>
            </TouchableOpacity>
          )}
        </View>

        <Typography variant="h2" color="#FFFFFF">{subscriptionHeadline}</Typography>
        <Typography variant="bodySmall" color="rgba(255,255,255,0.7)" style={{ marginTop: spacing.xs }}>
          {subscriptionSubheadline}
        </Typography>
      </LinearGradient>
    </Animated.View>
  );
}

/** Guarantees row at the bottom */
function GuaranteesRow() {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const items = [
    { icon: 'shield-checkmark-outline' as const, label: 'Secure payments' },
    { icon: 'refresh-circle-outline' as const,   label: 'Auto-renews' },
    { icon: 'close-circle-outline' as const,     label: 'Cancel anytime' },
  ];
  return (
    <Animated.View
      entering={FadeInUp.delay(300).duration(400)}
      style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.xl }}
    >
      {items.map((item) => (
        <View key={item.label} style={{ alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name={item.icon} size={20} color={theme.textTertiary} />
          <Typography variant="caption" color={theme.textTertiary}>{item.label}</Typography>
        </View>
      ))}
    </Animated.View>
  );
}

/** Empty / error state */
function EmptyState({ onRetry }: { onRetry: () => void }) {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing['2xl'] }}>
      <Ionicons name="cloud-offline-outline" size={48} color={theme.textTertiary} />
      <Typography variant="body" color={theme.textSecondary} align="center">
        Could not load plans
      </Typography>
      <TouchableOpacity
        onPress={onRetry}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Retry loading plans"
        style={{
          backgroundColor: theme.primary,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
        }}
      >
        <Typography variant="label" color={theme.buttonPrimaryText}>Retry</Typography>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const { fromOnboarding } = useLocalSearchParams<{ fromOnboarding?: string }>();
  const isFromOnboarding = fromOnboarding === 'true';
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const { subscription, isSubscribed, refreshSubscription, setSubscription } = useSubscription();

  // Navigate to completion screen (onboarding) or back (normal)
  const navigateAfterAction = () => {
    if (isFromOnboarding) {
      router.replace('/(onboarding)/complete' as never);
    } else {
      router.back();
    }
  };

  const handleSkipOnboarding = () => {
    router.replace('/(onboarding)/complete' as never);
  };

  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null); // planId being processed
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // ─── Load plans ──────────────────────────────────────────
  const loadPlans = useCallback(async () => {
    try {
      const all = await fetchPlans();
      setPlans(all);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPlans(), refreshSubscription()]);
  }, [loadPlans, refreshSubscription]);

  // ─── Filter plans by cycle ────────────────────────────────
  const visiblePlans = plans.filter((p) => p.billingCycle === cycle);

  // Tier order: Basic (1), Pro (2), Master (3)
  const sorted = [...visiblePlans].sort((a, b) => a.tier - b.tier);

  // ── Only show plans that are an upgrade from the user's current tier ──
  // Never suggest a lower or equal plan — always sell up.
  const currentTier = subscription?.plan?.tier ?? 0;
  const upgradablePlans = sorted.filter((p) => p.tier > currentTier);
  const isOnHighestPlan = isSubscribed && upgradablePlans.length === 0;

  // ─── Checkout ────────────────────────────────────────────
  async function handleSelectPlan(plan: Plan) {
    setSelectedPlan(plan);
    setCheckingOut(plan.id);

    try {
      const result = await initiateCheckout(plan.id, couponResult?.valid ? couponResult.couponId : undefined);

      if (result.trial) {
        // Trial started immediately — use the returned subscription data directly
        // to avoid stale cache from server refetch
        if (result.subscription) {
          // Build a minimal SubscriptionSummary from the checkout result
          setSubscription({
            id: result.subscription?.id ?? '',
            status: 'trialing',
            plan,
            currentPeriodEnd: result.subscription?.currentPeriodEnd ?? '',
            trialEnd: result.subscription?.trialEnd ?? null,
            cancelAtPeriodEnd: false,
            isActive: true,
            daysRemaining: plan.trialDays,
          });
        } else {
          await refreshSubscription();
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert({
          title: '🎉 Trial Started!',
          message: `Your ${plan.trialDays}-day free trial of ${plan.displayName} is now active.`,
          type: 'info',
          buttons: [{ text: 'Start Learning', onPress: navigateAfterAction }],
        });
        return;
      }

      // Paid: open native Razorpay checkout modal
      if (!result.keyId) {
        throw new Error('Checkout response is missing payment key. Please try again.');
      }

      const isSubscriptionMode = !!result.razorpaySubscriptionId;

      const razorpayOptions = {
        key: result.keyId,
        // Subscription mode: capture a recurring mandate (UPI Autopay / card)
        // Order mode: one-off payment (legacy / grandfathered users)
        ...(isSubscriptionMode
          ? { subscription_id: result.razorpaySubscriptionId! }
          : { order_id: result.orderId!, amount: result.amountPaise }),
        currency: result.currency ?? 'INR',
        name: 'Quanti-pi',
        description: isSubscriptionMode
          ? `${plan.displayName} ${cycle} plan — auto-renews`
          : `${plan.displayName} ${cycle} plan`,
        theme: { color: '#2563EB' },
      };

      // RazorpayCheckout.open() presents a native payment modal.
      // In subscription mode the response contains razorpay_subscription_id.
      // In order mode the response contains razorpay_order_id.
      const paymentResult = await RazorpayCheckout.open(razorpayOptions);

      // Verify payment server-side — use returned summary directly
      // to bypass potentially stale Redis cache.
      // For subscriptions, the verification uses razorpay_subscription_id.
      const activatedSummary = await verifyPayment(
        isSubscriptionMode
          ? {
              razorpayOrderId: result.razorpaySubscriptionId!,
              razorpayPaymentId: (paymentResult as { razorpay_payment_id: string }).razorpay_payment_id,
              razorpaySignature: (paymentResult as { razorpay_signature: string }).razorpay_signature,
            }
          : {
              razorpayOrderId: (paymentResult as { razorpay_order_id: string }).razorpay_order_id,
              razorpayPaymentId: (paymentResult as { razorpay_payment_id: string }).razorpay_payment_id,
              razorpaySignature: (paymentResult as { razorpay_signature: string }).razorpay_signature,
            },
      );

      setSubscription(activatedSummary);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        title: '✅ Subscription Active!',
        message: isSubscriptionMode
          ? `You're now on ${plan.displayName}. Your plan will auto-renew ${cycle === 'monthly' ? 'monthly' : 'weekly'} — cancel anytime.`
          : `You're now on ${plan.displayName}. Happy learning!`,
        type: 'info',
        buttons: [{ text: 'Let\'s Go!', onPress: navigateAfterAction }],
      });
    } catch (err: unknown) {
      // Razorpay SDK rejects with { code, description } on user cancel or failure
      const razorpayErr = err as { code?: number; description?: string };
      if (razorpayErr.code === 2) {
        // code 2 = user cancelled — don't show an error alert
        return;
      }
      const msg =
        razorpayErr.description ??
        (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      showAlert({
        title: 'Checkout Failed',
        message: msg,
        type: 'info',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setCheckingOut(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginTop: spacing.md }}>Loading plans…</Typography>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      >
        {/* ── Header (gradient) ── */}
        <ScreenHeader onBack={() => router.back()} onSkip={isFromOnboarding ? handleSkipOnboarding : undefined} />

        <View style={{ paddingHorizontal: spacing.xl, marginTop: -spacing.lg, gap: spacing.xl }}>
          {/* ── Active subscription banner ── */}
          {isSubscribed && subscription && (
            <Animated.View entering={FadeInDown.delay(50).duration(350)}>
              <CurrentSubscriptionBanner subscription={subscription} />
            </Animated.View>
          )}

          {/* ── Cycle toggle ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={{ alignItems: 'center' }}>
            <PricingToggle value={cycle} onChange={setCycle} />
          </Animated.View>

          {/* ── Plan cards ── */}
          {isOnHighestPlan ? (
            /* ── "You're on our best plan" — nothing left to upsell ── */
            <Animated.View
              entering={FadeInDown.delay(150).duration(400)}
              style={{
                backgroundColor: theme.card,
                borderRadius: radius['2xl'],
                borderWidth: 1.5,
                borderColor: (theme.success ?? '#10B981') + '50',
                padding: spacing.xl,
                alignItems: 'center',
                gap: spacing.lg,
              }}
            >
              <View
                style={{
                  width: 64, height: 64, borderRadius: radius.full,
                  backgroundColor: (theme.success ?? '#10B981') + '18',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="diamond" size={28} color={theme.success ?? '#10B981'} />
              </View>
              <View style={{ alignItems: 'center', gap: spacing.xs }}>
                <Typography variant="h4" align="center">
                  You're on our best plan 🎉
                </Typography>
                <Typography variant="body" color={theme.textSecondary} align="center">
                  {`You already have ${subscription?.plan?.displayName ?? 'the top plan'} — every feature is unlocked. Keep learning!`}
                </Typography>
              </View>
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Go back to learning"
                style={{
                  backgroundColor: theme.success ?? '#10B981',
                  borderRadius: radius.full,
                  paddingHorizontal: spacing['2xl'],
                  paddingVertical: spacing.md,
                }}
              >
                <Typography variant="label" color="#FFFFFF">Back to Learning</Typography>
              </TouchableOpacity>
            </Animated.View>
          ) : upgradablePlans.length === 0 ? (
            <EmptyState onRetry={loadPlans} />
          ) : (
            <View style={{ gap: spacing.lg }}>
              {upgradablePlans.map((plan, i) => {
                // Master always gets the "Most Popular" treatment
                const isPopular = Number(plan.tier) === 3 || plan.displayName.includes('Master');

                return (
                  <Animated.View
                    key={plan.id}
                    entering={FadeInDown.delay(150 + i * 80).duration(400)}
                  >
                    <PlanCard
                      plan={plan}
                      isPopular={isPopular}
                      isCurrentPlan={false}
                      onSelect={handleSelectPlan}
                    />
                    {/* Processing overlay for this card */}
                    {checkingOut === plan.id && (
                      <View
                        style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: theme.background + '99',
                          borderRadius: radius['2xl'],
                        }}
                      >
                        <ActivityIndicator color={theme.primary} />
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* ── Coupon input (visible after selecting a plan) ── */}
          {/* Only show after plan is selected to avoid validating against wrong planId */}
          {!isOnHighestPlan && selectedPlan && (
            <Animated.View entering={FadeInDown.delay(400).duration(350)}>
              <Typography variant="label" color={theme.textSecondary} style={{ marginBottom: spacing.xs }}>
                Have a coupon?
              </Typography>
              <CouponInput
                planId={selectedPlan.id}
                onValidated={setCouponResult}
              />
            </Animated.View>
          )}

          {/* ── Guarantees ── */}
          <GuaranteesRow />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
