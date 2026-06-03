// ─── SubscriptionScreen ───────────────────────────────────────
// Plans pricing page — redesigned by CEO request:
//   • Horizontal scrollable carousel for side-by-side plan comparison
//   • Dedicated Free Trial card (position 0, separate from Basic)
//   • Each card's CTA directly fires checkout (no broken 2-step flow)
//   • Coupon input appears below carousel after any plan button pressed

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
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
import { PlanCard, CARD_WIDTH } from '../src/components/subscription/PlanCard';
import { FreeTrialCard } from '../src/components/subscription/FreeTrialCard';
import { CouponInput } from '../src/components/subscription/CouponInput';
import { CurrentSubscriptionBanner } from '../src/components/subscription/CurrentSubscriptionBanner';
import { useSubscription } from '../src/contexts/SubscriptionContext';
import {
  fetchPlans,
  initiateCheckout,
  verifyPayment,
  formatPrice,
  formatCycle,
} from '../src/services/subscription.service';
import { SubscriptionSuccessOverlay } from '../src/components/subscription/SubscriptionSuccessOverlay';
import { useConfig } from '../src/contexts/ConfigContext';
import type { Plan, CouponValidationResult } from '@kd/shared';
import type { BillingCycle } from '@kd/shared';

const CARD_GAP = spacing.lg;
const SCREEN_W = Dimensions.get('window').width;
// Left edge padding so first card is centred and user can see peek of next card
const CAROUSEL_PADDING = (SCREEN_W - CARD_WIDTH) / 2;

// ─── Sub-components (local, private to screen) ────────────────

function ScreenHeader({ onBack, onSkip }: { onBack: () => void; onSkip?: () => void }) {
  const { theme } = useTheme();
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

function GuaranteesRow() {
  const { theme } = useTheme();
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

function EmptyState({ onRetry }: { onRetry: () => void }) {
  const { theme } = useTheme();
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

// ─── Checkout error parser ────────────────────────────────────

function parseCheckoutError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e.error === 'object' && e.error !== null) {
      const inner = e.error as Record<string, unknown>;
      const reason = inner.reason as string | undefined;
      const step = inner.step as string | undefined;
      if (reason === 'payment_error' || step === 'payment_authentication') {
        return 'Payment could not be processed. Please try a different payment method.';
      }
      if (reason === 'payment_declined') {
        return 'Your payment was declined. Please check your card details or try another method.';
      }
      if (typeof inner.description === 'string' && inner.description !== 'undefined' && inner.description.length > 0) {
        return inner.description;
      }
    }
    if (typeof e.description === 'string' && e.description.length > 0) {
      return e.description;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

// ─── Main screen ──────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const { fromOnboarding } = useLocalSearchParams<{ fromOnboarding?: string }>();
  const isFromOnboarding = fromOnboarding === 'true';
  const { theme } = useTheme();
  const { showAlert } = useGlobalUI();
  const { subscription, isSubscribed, refreshSubscription, setSubscription } = useSubscription();

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
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  // The plan the user has pressed CTA on (for coupon section)
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [successOverlay, setSuccessOverlay] = useState<{
    title: string; subtitle: string; buttonText: string;
  } | null>(null);

  const couponSectionRef = useRef<ScrollView>(null);

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
  const sorted = [...visiblePlans].sort((a, b) => a.tier - b.tier);
  const currentTier = subscription?.plan?.tier ?? 0;
  const upgradablePlans = sorted.filter((p) => p.tier > currentTier);
  const isOnHighestPlan = isSubscribed && upgradablePlans.length === 0;

  // Separate the trial plan (any plan with trialDays > 0, usually Basic)
  // from the rest — trial gets its own dedicated card.
  // Backend must return trialEligible===true; anything else hides the card.
  const trialPlan = upgradablePlans.find(
    (p) => p.trialDays > 0 && p.trialEligible === true,
  ) ?? null;
  // Paid plans are ALL upgradable plans (including the one with trial — they can still
  // choose to pay directly; they just also have the standalone trial card).
  const paidPlans = upgradablePlans;

  // ─── Core checkout runner ─────────────────────────────────
  // skipTrial=true  → always a paid checkout (from regular PlanCard)
  // skipTrial=false → trial eligible (from FreeTrialCard only)
  async function runCheckout(plan: Plan, withCoupon: boolean, skipTrial: boolean) {
    setCheckingOut(plan.id);
    const couponId = withCoupon && couponResult?.valid ? couponResult.couponId : undefined;

    try {
      const result = await initiateCheckout(plan.id, couponId, skipTrial);
      const isTrial = result.trialDays > 0;

      if (!result.keyId) {
        throw new Error('Checkout response is missing payment key. Please try again.');
      }

      const isSubscriptionMode = !!result.razorpaySubscriptionId;
      const razorpayOptions = {
        key: result.keyId,
        ...(isSubscriptionMode
          ? { subscription_id: result.razorpaySubscriptionId! }
          : { order_id: result.orderId!, amount: result.amountPaise }),
        currency: result.currency ?? 'INR',
        name: 'Quanti-pi',
        description: isTrial
          ? `${plan.displayName} — ${result.trialDays}-day free trial`
          : `${plan.displayName} ${cycle} plan — auto-renews`,
        theme: { color: '#2563EB' },
        prefill: result.prefill ?? {},
      };

      const paymentResult = await RazorpayCheckout.open(razorpayOptions);

      const verifyPayload = isSubscriptionMode
        ? {
            razorpayOrderId: result.razorpaySubscriptionId!,
            razorpayPaymentId: (paymentResult as { razorpay_payment_id: string }).razorpay_payment_id,
            razorpaySignature: (paymentResult as { razorpay_signature: string }).razorpay_signature,
          }
        : {
            razorpayOrderId: (paymentResult as { razorpay_order_id: string }).razorpay_order_id,
            razorpayPaymentId: (paymentResult as { razorpay_payment_id: string }).razorpay_payment_id,
            razorpaySignature: (paymentResult as { razorpay_signature: string }).razorpay_signature,
          };

      let activatedSummary;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          activatedSummary = await verifyPayment(verifyPayload);
          break;
        } catch (verifyErr) {
          if (attempt === 2) {
            showAlert({
              title: isTrial ? 'Trial Setup Pending' : 'Payment Received',
              message: isTrial
                ? 'Your trial is being activated. It will appear shortly — please restart the app if needed.'
                : 'Your payment was successful but activation is taking a moment. Please restart the app if needed.',
              type: 'info',
              buttons: [{ text: 'OK', onPress: navigateAfterAction }],
            });
            return;
          }
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }

      setSubscription(activatedSummary!);

      if (isTrial) {
        const chargeDate = new Date();
        chargeDate.setDate(chargeDate.getDate() + result.trialDays);
        const chargeDateStr = chargeDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        setSuccessOverlay({
          title: 'Trial Started!',
          subtitle: `Your ${result.trialDays}-day free trial of ${plan.displayName} is active. You won't be charged until ${chargeDateStr}.`,
          buttonText: 'Start Learning',
        });
      } else {
        setSuccessOverlay({
          title: 'Subscription Active!',
          subtitle: isSubscriptionMode
            ? `You're now on ${plan.displayName}. Auto-renews ${cycle === 'monthly' ? 'monthly' : 'weekly'} — cancel anytime.`
            : `You're now on ${plan.displayName}. Happy learning!`,
          buttonText: "Let's Go!",
        });
      }
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 2) return;
      showAlert({
        title: 'Checkout Failed',
        message: parseCheckoutError(err),
        type: 'info',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setCheckingOut(null);
    }
  }

  // Card CTA handlers
  function handlePlanCardPress(plan: Plan) {
    // If there's a pending plan already and coupon is applied, go direct
    if (pendingPlan?.id === plan.id && couponResult?.valid) {
      runCheckout(plan, true, true); // skipTrial=true — user chose the paid card
      return;
    }
    // First press: set pending so coupon section appears below
    setPendingPlan(plan);
    setCouponResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleTrialCardPress(plan: Plan) {
    // Free trial card — skipTrial=false so the backend applies the trial mandate
    runCheckout(plan, false, false);
  }

  function handleConfirmCheckout() {
    if (!pendingPlan) return;
    runCheckout(pendingPlan, true, true); // skipTrial=true — always paid from confirm button
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

        <View style={{ marginTop: -spacing.lg, gap: spacing.xl }}>
          {/* ── Active subscription banner ── */}
          {isSubscribed && subscription && (
            <Animated.View entering={FadeInDown.delay(50).duration(350)} style={{ paddingHorizontal: spacing.xl }}>
              <CurrentSubscriptionBanner subscription={subscription} />
            </Animated.View>
          )}

          {/* ── Cycle toggle ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={{ alignItems: 'center' }}>
            <PricingToggle value={cycle} onChange={(c) => { setCycle(c); setPendingPlan(null); setCouponResult(null); }} />
          </Animated.View>

          {/* ── Plan cards — horizontal carousel ── */}
          {isOnHighestPlan ? (
            <Animated.View
              entering={FadeInDown.delay(150).duration(400)}
              style={{
                marginHorizontal: spacing.xl,
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
          ) : paidPlans.length === 0 ? (
            <EmptyState onRetry={loadPlans} />
          ) : (
            <>
              {/* ── Scroll hint label ── */}
              <Animated.View
                entering={FadeInDown.delay(120).duration(300)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: CAROUSEL_PADDING }}
              >
                <Ionicons name="swap-horizontal-outline" size={14} color={theme.textTertiary} />
                <Typography variant="caption" color={theme.textTertiary}>
                  Swipe to compare plans
                </Typography>
              </Animated.View>

              {/* ── Horizontal plan carousel ── */}
              <Animated.View entering={FadeInDown.delay(160).duration(400)}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={CARD_WIDTH + CARD_GAP}
                  snapToAlignment="start"
                  contentContainerStyle={{
                    paddingHorizontal: CAROUSEL_PADDING,
                    gap: CARD_GAP,
                    paddingVertical: spacing.sm, // allow shadow/glow to show
                  }}
                >
                  {/* Free Trial card — always position 0 when a trial plan exists */}
                  {trialPlan && (
                    <FreeTrialCard
                      trialPlan={trialPlan}
                      isCheckingOut={checkingOut === trialPlan.id}
                      onStartTrial={handleTrialCardPress}
                    />
                  )}

                  {/* Paid plan cards */}
                  {paidPlans.map((plan) => {
                    const isPopular = Number(plan.tier) === 3 || plan.displayName.includes('Master');
                    return (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        isPopular={isPopular}
                        isCurrentPlan={false}
                        isCheckingOut={checkingOut === plan.id}
                        onCheckout={handlePlanCardPress}
                      />
                    );
                  })}
                </ScrollView>
              </Animated.View>

              {/* ── Coupon + confirm (appears when a paid plan CTA is pressed) ── */}
              {pendingPlan && !checkingOut && (
                <Animated.View
                  entering={FadeInDown.duration(350)}
                  style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}
                >
                  {/* Section label */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: theme.divider }} />
                    <Typography variant="caption" color={theme.textTertiary}>
                      Confirming {pendingPlan.displayName}
                    </Typography>
                    <View style={{ flex: 1, height: 1, backgroundColor: theme.divider }} />
                  </View>

                  {/* Coupon */}
                  <View>
                    <Typography variant="label" color={theme.textSecondary} style={{ marginBottom: spacing.xs }}>
                      Have a coupon?
                    </Typography>
                    <CouponInput planId={pendingPlan.id} onValidated={setCouponResult} />
                  </View>

                  {/* Confirm button */}
                  <TouchableOpacity onPress={handleConfirmCheckout} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#6366F1', '#3B82F6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}
                    >
                      <Typography variant="label" color="#FFFFFF">
                        {pendingPlan.trialDays > 0 && !(couponResult?.valid)
                          ? `Start ${pendingPlan.trialDays}-Day Free Trial`
                          : `Pay ${formatPrice(couponResult?.valid ? couponResult.finalPricePaise : pendingPlan.pricePaise)}${formatCycle(pendingPlan.billingCycle)}`}
                      </Typography>
                    </LinearGradient>
                  </TouchableOpacity>

                  {pendingPlan.trialDays > 0 && !(couponResult?.valid) && (
                    <Typography variant="caption" color={theme.textTertiary} align="center">
                      {pendingPlan.trialDays}-day free trial · Then {formatPrice(pendingPlan.pricePaise)}{formatCycle(pendingPlan.billingCycle)} · Cancel anytime
                    </Typography>
                  )}

                  {/* Dismiss pending */}
                  <TouchableOpacity
                    onPress={() => { setPendingPlan(null); setCouponResult(null); }}
                    style={{ alignItems: 'center', paddingVertical: spacing.xs }}
                    activeOpacity={0.6}
                  >
                    <Typography variant="caption" color={theme.textTertiary}>← Pick a different plan</Typography>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </>
          )}

          {/* ── Guarantees ── */}
          <GuaranteesRow />
        </View>
      </ScrollView>

      {/* ── Success overlay ── */}
      {successOverlay && (
        <SubscriptionSuccessOverlay
          visible
          title={successOverlay.title}
          subtitle={successOverlay.subtitle}
          buttonText={successOverlay.buttonText}
          onDismiss={() => {
            setSuccessOverlay(null);
            navigateAfterAction();
          }}
        />
      )}
    </SafeAreaView>
  );
}
