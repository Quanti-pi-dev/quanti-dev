// ─── StatCard ─────────────────────────────────────────────────
// Home dashboard stat card: icon + label + large value.
// Glassmorphism-inspired with colored accent.
// Audit fix: replaced raw Text with Typography component.

import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { radius, spacing, shadows } from '../theme/tokens';
import { Typography } from './ui/Typography';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface StatCardProps {
  icon: IoniconName;
  label: string;
  value: string | number;
  accent?: string;
  style?: ViewStyle;
}

export function StatCard({ icon, label, value, accent, style }: StatCardProps) {
  const { theme } = useTheme();
  const color = accent ?? theme.primary;

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.card,
          borderRadius: radius.xl,
          padding: spacing.md,
          alignItems: 'center',
          gap: spacing.xs,
          ...shadows.sm,
          shadowColor: theme.shadow,
          borderWidth: 1,
          borderColor: theme.borderLight,
        },
        style,
      ]}
    >
      {/* Icon badge */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.lg,
          backgroundColor: color + '1A', // 10% alpha
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>

      {/* Value */}
      <Typography variant="h3" align="center">
        {value}
      </Typography>

      {/* Label */}
      <Typography variant="caption" color={theme.textTertiary} align="center">
        {label}
      </Typography>
    </View>
  );
}
