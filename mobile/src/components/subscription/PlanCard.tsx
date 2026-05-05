// ─── PlanCard ─────────────────────────────────────────────────
// Full plan card with price, features, badge, and animated CTA.
// Popular plan gets a gradient border wrapper.

import { View, TouchableOpacity } from 'react-native';
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

// ─── Static feature definitions ──────────────────────────────

import { Ionicons } from '@expo/vector-icons';
type IconName = keyof typeof Ionicons.glyphMap;

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

// ─── Props ────────────────────────────────────────────────────

interface PlanCardProps {
  plan: Plan;
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  onSelect: (plan: Plan) => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Component ────────────────────────────────────────────────

export function PlanCard({ plan, isPopular, isCurrentPlan, onSelect }: PlanCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const features = plan.features as unknown as Record<string, unknown>;

  function handlePress() {
    if (isCurrentPlan) return;
    scale.value = withSpring(0.97, { stiffness: 400, damping: 20 }, () => {
      scale.value = withSpring(1, { stiffness: 400, damping: 20 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(plan);
  }

  const cardBorderStyle = isCurrentPlan
    ? { borderWidth: 2, borderColor: theme.success }
    : isPopular
    ? { borderWidth: 0 } // gradient wrapper provides border
    : { borderWidth: 1, borderColor: theme.border };

  const card = (
    <AnimatedTouchable
      style={[
        animStyle,
        {
          borderRadius: radius['2xl'],
          padding: spacing.xl,
          backgroundColor: theme.card,
          ...cardBorderStyle,
        },
      ]}
      onPress={handlePress}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityState={{ disabled: isCurrentPlan }}
      accessibilityLabel={`${plan.displayName} plan. ${isCurrentPlan ? 'This is your current plan.' : `Price is ${formatPrice(plan.pricePaise)} ${formatCycle(plan.billingCycle)}.`}`}
    >
      {/* ── Header row ── */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Typography variant="h3">{plan.displayName}</Typography>

          {/* Price */}
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
          ) : plan.trialDays > 0 ? (
            <PlanBadge variant="trial" />
          ) : null}
        </View>
      </View>

      {/* Trial note */}
      {plan.trialDays > 0 && !isCurrentPlan && (
        <Typography
          variant="captionBold"
          color={theme.success}
          style={{ marginTop: spacing.xs, marginBottom: spacing.md }}
        >
          {plan.trialDays}-day free trial — no charge today
        </Typography>
      )}

      {/* ── Divider ── */}
      <View style={{ height: 1, backgroundColor: theme.divider, marginVertical: spacing.base }} />

      {/* ── Feature list ── */}
      <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        {FEATURE_ROWS.map((f) => (
          <PlanFeatureRow
            key={f.key}
            icon={f.icon}
            label={f.label}
            value={(features[f.key] as boolean | number | null) ?? false}
          />
        ))}
      </View>

      {/* ── CTA ── */}
      {isPopular && !isCurrentPlan ? (
        <LinearGradient
          colors={['#6366F1', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: radius.lg }}
        >
          <View
            style={{ paddingVertical: spacing.md, alignItems: 'center' }}
          >
            <Typography variant="label" color="#FFFFFF">
              {plan.trialDays > 0 ? 'Start Free Trial' : `Choose ${plan.displayName}`}
            </Typography>
          </View>
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
          <Typography
            variant="label"
            color={isCurrentPlan ? theme.textTertiary : '#FFFFFF'}
          >
            {isCurrentPlan
              ? 'Current Plan'
              : plan.trialDays > 0
              ? 'Start Free Trial'
              : `Choose ${plan.displayName}`}
          </Typography>
        </View>
      )}
    </AnimatedTouchable>
  );

  // Gradient border wrapper for popular plan
  if (isPopular && !isCurrentPlan) {
    return (
      <LinearGradient
        colors={['#6366F1', '#3B82F6', '#06B6D4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius['2xl'], padding: 2 }}
      >
        {card}
      </LinearGradient>
    );
  }

  return card;
}
