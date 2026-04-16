// ─── UpgradeCTABanner ─────────────────────────────────────────
// Generic "upgrade to unlock this section" banner.
// Used above gated sections (e.g. Analytics charts).

import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

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
        style={{
          borderRadius: radius['2xl'],
          padding: spacing.base,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            width: 40,
            height: 40,
            borderRadius: radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="label" color="#FFFFFF">{title}</Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 2 }}>
            {subtitle}
          </Typography>
        </View>
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
          }}
        >
          <Typography variant="captionBold" color="#FFFFFF">Upgrade</Typography>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
