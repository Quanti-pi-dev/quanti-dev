// ─── PlanBadge ────────────────────────────────────────────────
// Pill badge shown on a plan card (Popular, Active, Trial).

import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

type BadgeVariant = 'popular' | 'active' | 'trial';

interface PlanBadgeProps {
  variant: BadgeVariant;
}

export function PlanBadge({ variant }: PlanBadgeProps) {
  const { theme } = useTheme();

  if (variant === 'popular') {
    return (
      <LinearGradient
        colors={['#6366F1', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.full,
          gap: spacing.xs,
        }}
      >
        <Typography variant="captionBold" color="#FFFFFF">⭐ Most Popular</Typography>
      </LinearGradient>
    );
  }

  if (variant === 'active') {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.successMuted,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radius.full,
          gap: spacing.xs,
        }}
      >
        <Ionicons name="checkmark-circle" size={12} color={theme.success} />
        <Typography variant="captionBold" color={theme.success}>Active</Typography>
      </View>
    );
  }

  // trial
  return (
    <View
      style={{
        backgroundColor: theme.successMuted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
      }}
    >
      <Typography variant="captionBold" color={theme.success}>Free trial</Typography>
    </View>
  );
}
