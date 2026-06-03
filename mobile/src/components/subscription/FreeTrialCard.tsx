// ─── FreeTrialCard ────────────────────────────────────────────
// Dedicated card for the free-trial offer.
// Lives at position 0 in the horizontal plan carousel.
// Pressing the CTA fires checkout directly — no intermediate
// "select then confirm" step that was broken before.

import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { PlanFeatureRow } from './PlanFeatureRow';
import { formatPrice, formatCycle } from '../../services/subscription.service';
import type { Plan } from '@kd/shared';
import { CARD_WIDTH } from './PlanCard';

type IconName = keyof typeof Ionicons.glyphMap;

// Features included in the free trial (mirrors Basic plan perks)
const TRIAL_FEATURES: { icon: IconName; label: string }[] = [
  { icon: 'albums-outline',        label: 'All flashcard decks' },
  { icon: 'document-text-outline', label: 'Daily exam practice' },
  { icon: 'bulb-outline',          label: 'AI explanations' },
  { icon: 'analytics-outline',     label: 'Basic analytics' },
  { icon: 'ban-outline',           label: 'No credit card required' },
];

interface FreeTrialCardProps {
  /** The plan that carries trialDays > 0 (typically Basic or Pro) */
  trialPlan: Plan;
  isCheckingOut: boolean;
  onStartTrial: (plan: Plan) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function FreeTrialCard({ trialPlan, isCheckingOut, onStartTrial }: FreeTrialCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    if (isCheckingOut) return;
    scale.value = withSpring(0.97, { stiffness: 400, damping: 20 }, () => {
      scale.value = withSpring(1, { stiffness: 400, damping: 20 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartTrial(trialPlan);
  }

  return (
    <AnimatedView style={[animStyle, { width: CARD_WIDTH }]}>
      {/* Outer glow/border using gradient */}
      <LinearGradient
        colors={['#10B981', '#059669', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius['2xl'], padding: 2 }}
      >
        <View
          style={{
            borderRadius: radius['2xl'],
            backgroundColor: theme.card,
            padding: spacing.xl,
            flexDirection: 'column',
          }}
        >
          {/* ── Header ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            {/* Gift icon */}
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.xl,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="gift-outline" size={22} color="#FFFFFF" />
            </LinearGradient>

            {/* "Free Trial" pill */}
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                gap: spacing.xs,
              }}
            >
              <Ionicons name="sparkles-outline" size={12} color="#FFFFFF" />
              <Typography variant="captionBold" color="#FFFFFF">Free Trial</Typography>
            </LinearGradient>
          </View>

          {/* Title */}
          <Typography variant="h3" style={{ marginTop: spacing.sm }}>
            Try {trialPlan.trialDays} Days Free
          </Typography>

          {/* Subtitle */}
          <Typography
            variant="bodySmall"
            color={theme.textSecondary}
            style={{ marginTop: spacing.xs, marginBottom: spacing.md }}
          >
            Full access, zero commitment. Then{' '}
            <Typography variant="bodySmall" color={theme.primary}>
              {formatPrice(trialPlan.pricePaise)}{formatCycle(trialPlan.billingCycle)}
            </Typography>{' '}
            — cancel anytime.
          </Typography>

          {/* ── Divider ── */}
          <View style={{ height: 1, backgroundColor: theme.divider, marginVertical: spacing.base }} />

          {/* ── What's included ── */}
          <Typography variant="captionBold" color={theme.textTertiary} style={{ marginBottom: spacing.sm }}>
            WHAT'S INCLUDED
          </Typography>

          <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
            {TRIAL_FEATURES.map((f) => (
              <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name={f.icon} size={16} color="#10B981" />
                <Typography variant="bodySmall" color={theme.text} style={{ flex: 1 }}>
                  {f.label}
                </Typography>
              </View>
            ))}
          </View>

          {/* ── CTA ── */}
          <TouchableOpacity
            onPress={handlePress}
            disabled={isCheckingOut}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Start ${trialPlan.trialDays}-day free trial`}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: spacing.sm,
              }}
            >
              {isCheckingOut ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
                  <Typography variant="label" color="#FFFFFF">
                    Start {trialPlan.trialDays}-Day Free Trial
                  </Typography>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Fine print */}
          <Typography
            variant="caption"
            color={theme.textTertiary}
            align="center"
            style={{ marginTop: spacing.sm }}
          >
            No charge for {trialPlan.trialDays} days · Cancel before trial ends and pay nothing
          </Typography>
        </View>
      </LinearGradient>
    </AnimatedView>
  );
}
