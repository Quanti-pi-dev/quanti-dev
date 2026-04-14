// ─── PlanFeatureRow ────────────────────────────────────────────
// A single feature row inside a plan card (NativeWind).

import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PlanFeatureRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean | number | string | null;
}

export function PlanFeatureRow({ icon, label, value }: PlanFeatureRowProps) {
  const enabled = value !== false && value !== null && value !== 0;

  // Render a count label if numeric
  const suffix =
    typeof value === 'number'
      ? ` (${value === -1 ? '∞' : value})`
      : '';

  return (
    <View className="flex-row items-center gap-2">
      <Ionicons
        name={enabled ? icon : 'close-outline'}
        size={16}
        color={enabled ? '#10B981' : '#9CA3AF'}
      />
      <Text
        className={`flex-1 text-sm font-body ${
          enabled
            ? 'text-gray-800 dark:text-gray-100'
            : 'text-gray-400 dark:text-gray-600'
        }`}
      >
        {label}{suffix}
      </Text>
    </View>
  );
}
