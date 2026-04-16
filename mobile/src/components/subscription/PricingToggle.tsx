// ─── PricingToggle ─────────────────────────────────────────────
// Animated weekly/monthly billing cycle toggle.

import { View, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import type { BillingCycle } from '@kd/shared';
import { useConfig } from '../../contexts/ConfigContext';

interface PricingToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

export function PricingToggle({ value, onChange }: PricingToggleProps) {
  const { theme } = useTheme();
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
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      {/* Save badge */}
      <View
        style={{
          backgroundColor: theme.successMuted,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.full,
        }}
      >
        <Typography variant="captionBold" color={theme.success}>{saveBadgeText}</Typography>
      </View>

      {/* Toggle track */}
      <View
        style={{
          flexDirection: 'row',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardAlt,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated pill */}
        <Animated.View
          style={[
            pillStyle,
            {
              width: PILL_W,
              position: 'absolute',
              top: 0,
              bottom: 0,
              backgroundColor: theme.primary,
              borderRadius: radius.lg,
            },
          ]}
        />

        {(['weekly', 'monthly'] as BillingCycle[]).map((cycle) => (
          <TouchableOpacity
            key={cycle}
            onPress={() => select(cycle)}
            activeOpacity={0.8}
            style={{
              width: PILL_W,
              paddingVertical: spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Typography
              variant="label"
              color={value === cycle ? '#FFFFFF' : theme.textTertiary}
            >
              {cycle === 'weekly' ? 'Weekly' : 'Monthly'}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
