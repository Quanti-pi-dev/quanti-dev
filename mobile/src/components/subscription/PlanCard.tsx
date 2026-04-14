// ─── PlanCard ─────────────────────────────────────────────────
// Full plan card with price, features, badge, and animated CTA.
// Popular plan gets a gradient border wrapper.

import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { PlanBadge } from './PlanBadge';
import { PlanFeatureRow } from './PlanFeatureRow';
import { formatPrice, formatCycle } from '../../services/subscription.service';
import type { Plan } from '@kd/shared';

// ─── Static feature definitions ──────────────────────────────

const FEATURE_ROWS: { icon: 'albums-outline' | 'document-text-outline' | 'bulb-outline' | 'cloud-download-outline' | 'analytics-outline' | 'headset-outline'; label: string; key: string }[] = [
  { icon: 'albums-outline',          label: 'Flashcard decks',    key: 'max_decks' },
  { icon: 'document-text-outline',   label: 'Daily exams',        key: 'max_exams_per_day' },
  { icon: 'bulb-outline',            label: 'AI explanations',    key: 'ai_explanations' },
  { icon: 'cloud-download-outline',  label: 'Offline access',     key: 'offline_access' },
  { icon: 'analytics-outline',       label: 'Advanced analytics', key: 'advanced_analytics' },
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

  const card = (
    <AnimatedTouchable
      style={animStyle}
      onPress={handlePress}
      activeOpacity={1}
      className={`rounded-3xl p-5 bg-white dark:bg-gray-900 ${
        isCurrentPlan
          ? 'border-2 border-correct'
          : isPopular
          ? 'border-0'           // gradient wrapper provides border
          : 'border border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* ── Header row ── */}
      <View className="flex-row items-start justify-between mb-1">
        <View className="flex-1">
          <Text className="font-heading text-xl text-gray-900 dark:text-white">
            {plan.displayName}
          </Text>

          {/* Price */}
          <View className="flex-row items-end gap-1 mt-1">
            <Text className="font-heading text-3xl text-primary">
              {formatPrice(plan.pricePaise)}
            </Text>
            <Text className="font-body text-gray-400 text-sm mb-1">
              {formatCycle(plan.billingCycle)}
            </Text>
          </View>
        </View>

        {/* Badge */}
        <View className="ml-2 mt-1">
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
        <Text className="text-correct text-xs font-body-semibold mt-1 mb-3">
          {plan.trialDays}-day free trial — no charge today
        </Text>
      )}

      {/* ── Divider ── */}
      <View className="h-px bg-gray-100 dark:bg-gray-800 my-4" />

      {/* ── Feature list ── */}
      <View className="gap-2 mb-5">
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
          className="rounded-2xl"
        >
          <TouchableOpacity
            onPress={handlePress}
            className="py-3 items-center"
            activeOpacity={0.85}
          >
            <Text className="text-white font-body-semibold text-sm tracking-wide">
              {plan.trialDays > 0 ? 'Start Free Trial' : `Choose ${plan.displayName}`}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      ) : (
        <TouchableOpacity
          onPress={handlePress}
          disabled={isCurrentPlan}
          className={`py-3 rounded-2xl items-center ${
            isCurrentPlan
              ? 'bg-gray-100 dark:bg-gray-800'
              : 'bg-primary/10'
          }`}
          activeOpacity={0.85}
        >
          <Text
            className={`font-body-semibold text-sm ${
              isCurrentPlan ? 'text-gray-400' : 'text-primary'
            }`}
          >
            {isCurrentPlan
              ? 'Current Plan'
              : plan.trialDays > 0
              ? `Start Free Trial`
              : `Choose ${plan.displayName}`}
          </Text>
        </TouchableOpacity>
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
        className="rounded-3xl p-0.5"
      >
        {card}
      </LinearGradient>
    );
  }

  return card;
}
