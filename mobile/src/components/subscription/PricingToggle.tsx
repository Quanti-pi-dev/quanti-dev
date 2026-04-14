// ─── PricingToggle ─────────────────────────────────────────────
// Animated weekly/monthly billing cycle toggle (NativeWind).

import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { BillingCycle } from '@kd/shared';
import { useConfig } from '../../contexts/ConfigContext';

interface PricingToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

export function PricingToggle({ value, onChange }: PricingToggleProps) {
  const isMonthly = value === 'monthly';
  const translateX = useSharedValue(isMonthly ? 1 : 0);

  const PILL_W = 108;

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(translateX.value * PILL_W, { stiffness: 380, damping: 26 }) }],
  }));

  function select(cycle: BillingCycle) {
    translateX.value = cycle === 'monthly' ? 1 : 0;
    Haptics.selectionAsync();
    onChange(cycle);
  }

  const saveBadgeText = useConfig('save_badge_text', 'Save ~28% monthly');

  return (
    <View className="items-center gap-2">
      {/* Save badge */}
      <View className="bg-correct/10 px-3 py-1 rounded-full">
        <Text className="text-correct font-body-semibold text-xs">{saveBadgeText}</Text>
      </View>

      {/* Toggle track */}
      <View className="flex-row rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
        {/* Animated pill */}
        <Animated.View
          style={[pillStyle, { width: PILL_W, position: 'absolute', top: 0, bottom: 0 }]}
          className="bg-primary rounded-2xl"
        />

        {(['weekly', 'monthly'] as BillingCycle[]).map((cycle) => (
          <TouchableOpacity
            key={cycle}
            onPress={() => select(cycle)}
            activeOpacity={0.8}
            style={{ width: PILL_W }}
            className="py-2.5 items-center justify-center z-10"
          >
            <Text
              className={`text-sm font-body-semibold ${
                value === cycle ? 'text-white' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {cycle === 'weekly' ? 'Weekly' : 'Monthly'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
