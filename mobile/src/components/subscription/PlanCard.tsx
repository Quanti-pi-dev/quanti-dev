// ─── PlanCard ─────────────────────────────────────────────────
// Horizontal-carousel plan card — fixed width, full-height,
// with an embedded CTA button that fires checkout directly.
// Free trial badge is gone from here; free trial has its own card.

import { View, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { PlanBadge } from './PlanBadge';
import { PlanFeatureRow } from './PlanFeatureRow';
import { formatPrice, formatCycle } from '../../services/subscription.service';
import type { Plan } from '@kd/shared';

import { Ionicons } from '@expo/vector-icons';
type IconName = keyof typeof Ionicons.glyphMap;

// Card is 80% of screen width so you can peek at the next one
const CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.78, 300);

const FEATURE_ROWS: { icon: IconName; label: string; key: string }[] = [
  { icon: 'albums-outline',          label: 'Flashcard decks',    key: 'max_decks' },
  { icon: 'document-text-outline',   label: 'Daily exams',        key: 'max_exams_per_day' },
  { icon: 'book-outline',            label: 'Subjects per exam',  key: 'max_subjects_per_exam' },
  { icon: 'school-outline',          label: 'Learning levels',    key: 'max_level' },
  { icon: 'bulb-outline',            label: 'AI explanations',    key: 'ai_explanations' },
  { icon: 'analytics-outline',       label: 'Advanced analytics', key: 'advanced_analytics' },
  { icon: 'stats-chart-outline',     label: 'Deep insights',      key: 'deep_insights' },
  { icon: 'pie-chart-outline',       label: 'Mastery radar',      key: 'mastery_radar' },
  { icon: 'cloud-download-outline',  label: 'Offline access',     key: 'offline_access' },
  { icon: 'headset-outline',         label: 'Priority support',   key: 'priority_support' },
];

interface PlanCardProps {
  plan: Plan;
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  /** Loading spinner overlay while this plan's checkout is in progress */
  isCheckingOut?: boolean;
  onCheckout: (plan: Plan) => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function PlanCard({ plan, isPopular, isCurrentPlan, isCheckingOut, onCheckout }: PlanCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const features = plan.features as unknown as Record<string, unknown>;

  function handleCtaPress() {
    if (isCurrentPlan || isCheckingOut) return;
    scale.value = withSpring(0.97, { stiffness: 400, damping: 20 }, () => {
      scale.value = withSpring(1, { stiffness: 400, damping: 20 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCheckout(plan);
  }

  const cardInner = (
    <View
      style={{
        borderRadius: radius['2xl'],
        backgroundColor: theme.card,
        padding: spacing.xl,
        flexDirection: 'column',
        ...(isCurrentPlan
          ? { borderWidth: 2, borderColor: theme.success }
          : isPopular
          ? { borderWidth: 0 }
          : { borderWidth: 1, borderColor: theme.border }),
      }}
    >
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Typography variant="h3">{plan.displayName}</Typography>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginTop: spacing.xs }}>
            <Typography variant="h2" color={theme.primary}>
              {formatPrice(plan.pricePaise)}
            </Typography>
            <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginBottom: spacing.xs }}>
              {formatCycle(plan.billingCycle)}
            </Typography>
          </View>
        </View>

        {/* Badge */}
        <View style={{ marginLeft: spacing.sm, marginTop: spacing.xs }}>
          {isCurrentPlan ? (
            <PlanBadge variant="active" />
          ) : isPopular ? (
            <PlanBadge variant="popular" />
          ) : null}
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={{ height: 1, backgroundColor: theme.divider, marginVertical: spacing.base }} />

      {/* ── Features ── */}
      <View style={{ gap: spacing.sm, marginBottom: spacing.xl, flex: 1 }}>
        {FEATURE_ROWS.map((f) => (
          <PlanFeatureRow
            key={f.key}
            icon={f.icon}
            label={f.label}
            value={(features[f.key] as boolean | number | null) ?? false}
          />
        ))}
      </View>

      {/* ── CTA indicator (non-interactive — whole card is the touch target) ── */}
      {isPopular && !isCurrentPlan ? (
        <LinearGradient
          colors={['#6366F1', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}
        >
          {isCheckingOut ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="sync-outline" size={16} color="#FFFFFF" />
              <Typography variant="label" color="#FFFFFF">Processing…</Typography>
            </View>
          ) : (
            <Typography variant="label" color="#FFFFFF">Choose {plan.displayName}</Typography>
          )}
        </LinearGradient>
      ) : (
        <View
          style={{
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            alignItems: 'center',
            backgroundColor: isCurrentPlan ? theme.cardAlt : theme.primary,
          }}
        >
          {isCheckingOut ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="sync-outline" size={16} color={isCurrentPlan ? theme.textTertiary : '#FFFFFF'} />
              <Typography variant="label" color={isCurrentPlan ? theme.textTertiary : '#FFFFFF'}>Processing…</Typography>
            </View>
          ) : (
            <Typography variant="label" color={isCurrentPlan ? theme.textTertiary : '#FFFFFF'}>
              {isCurrentPlan ? 'Current Plan' : `Choose ${plan.displayName}`}
            </Typography>
          )}
        </View>
      )}
    </View>
  );

  // Whole card is the touch target
  const card = (
    <AnimatedTouchable
      style={[animStyle, { width: CARD_WIDTH }]}
      onPress={handleCtaPress}
      activeOpacity={0.92}
      disabled={isCurrentPlan || isCheckingOut}
      accessibilityRole="button"
      accessibilityLabel={
        isCurrentPlan
          ? `${plan.displayName} — your current plan`
          : `Select ${plan.displayName} plan`
      }
    >
      {cardInner}
    </AnimatedTouchable>
  );

  // Gradient border wrapper for popular plan
  if (isPopular && !isCurrentPlan) {
    return (
      <LinearGradient
        colors={['#6366F1', '#3B82F6', '#06B6D4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius['2xl'], padding: 2, width: CARD_WIDTH }}
      >
        {card}
      </LinearGradient>
    );
  }

  return card;
}

export { CARD_WIDTH };

