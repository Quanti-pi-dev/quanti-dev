// ─── Badge ───────────────────────────────────────────────────
// Pill badge for tags, status labels, and reward indicators.


import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { radius, spacing, typography } from '../../theme/tokens';

type BadgeVariant = 'primary' | 'success' | 'error' | 'warning' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'neutral', size = 'md', style }: BadgeProps) {
  const { theme } = useTheme();

  const colorMap: Record<BadgeVariant, { bg: string; text: string }> = {
    primary: { bg: theme.primaryMuted, text: theme.primary },
    success: { bg: theme.successLight, text: theme.success },
    error: { bg: theme.errorLight, text: theme.error },
    warning: { bg: theme.coinLight, text: theme.coin },
    neutral: { bg: theme.cardAlt, text: theme.textSecondary },
  };

  const colors = colorMap[variant];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        {
          backgroundColor: colors.bg,
          borderRadius: radius.full,
          paddingHorizontal: isSmall ? spacing.sm : spacing.md,
          paddingVertical: isSmall ? 2 : spacing.xs,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontWeight: '600',
          fontSize: isSmall ? typography.xs : typography.sm,
          color: colors.text,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
