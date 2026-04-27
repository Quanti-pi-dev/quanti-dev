// ─── LockedFeature ────────────────────────────────────────────
// Fix 5: Rewrote entirely using theme tokens + inline styles.
// Removed all NativeWind className strings and hardcoded colour values.

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

// ─── LockedFeatureBanner (inline) ────────────────────────────

interface LockedBannerProps {
  feature: string;
  minTier?: 1 | 2 | 3;
}

export function LockedFeatureBanner({ feature, minTier = 1 }: LockedBannerProps) {
  const { planTier } = useSubscription();
  const { theme } = useTheme();
  const router = useRouter();

  if (planTier >= minTier) return null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/subscription')}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.primaryMuted,
        borderWidth: 1,
        borderColor: theme.primary + '33',
        borderRadius: radius['2xl'],
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Ionicons name="lock-closed-outline" size={15} color={theme.primary} />
      <Typography variant="label" color={theme.primary} style={{ flex: 1 }}>{feature}</Typography>
      <Typography variant="caption" color={theme.primary}>Upgrade →</Typography>
    </TouchableOpacity>
  );
}
