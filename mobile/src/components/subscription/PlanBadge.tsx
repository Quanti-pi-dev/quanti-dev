// ─── PlanBadge ────────────────────────────────────────────────
// Pill badge shown on a plan card (Popular, Active, Trial).

import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type BadgeVariant = 'popular' | 'active' | 'trial';

interface PlanBadgeProps {
  variant: BadgeVariant;
}

export function PlanBadge({ variant }: PlanBadgeProps) {
  if (variant === 'popular') {
    return (
      <LinearGradient
        colors={['#6366F1', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="flex-row items-center px-2.5 py-1 rounded-full gap-1"
      >
        <Text className="text-white text-xs font-body-semibold">⭐ Most Popular</Text>
      </LinearGradient>
    );
  }

  if (variant === 'active') {
    return (
      <View className="flex-row items-center bg-correct/10 px-2.5 py-1 rounded-full gap-1">
        <Ionicons name="checkmark-circle" size={12} color="#10B981" />
        <Text className="text-correct text-xs font-body-semibold">Active</Text>
      </View>
    );
  }

  // trial
  return (
    <View className="bg-correct/10 px-2.5 py-1 rounded-full">
      <Text className="text-correct text-xs font-body-semibold">Free trial</Text>
    </View>
  );
}
