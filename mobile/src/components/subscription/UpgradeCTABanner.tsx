// ─── UpgradeCTABanner ─────────────────────────────────────────
// Generic "upgrade to unlock this section" banner.
// Used above gated sections (e.g. Analytics charts).

import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';

interface UpgradeCTABannerProps {
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function UpgradeCTABanner({
  title,
  subtitle,
  icon = 'lock-closed-outline',
}: UpgradeCTABannerProps) {
  const { goToUpgrade } = useSubscriptionGate();

  return (
    <TouchableOpacity onPress={goToUpgrade} activeOpacity={0.88}>
      <LinearGradient
        colors={['#6366F1', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="rounded-3xl p-4 flex-row items-center gap-3"
      >
        <View className="bg-white/20 w-10 h-10 rounded-2xl items-center justify-center">
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-white font-body-semibold text-sm">{title}</Text>
          <Text className="text-white/70 font-body text-xs mt-0.5">{subtitle}</Text>
        </View>
        <View className="bg-white/20 px-3 py-1.5 rounded-xl">
          <Text className="text-white font-body-semibold text-xs">Upgrade</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
