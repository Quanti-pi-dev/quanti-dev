// ─── StatTile ─────────────────────────────────────────────────
// Compact stat tile with colored background. Replaces StatCard
// with a cleaner, flatter design that fits stat grids better.

import { View, ViewStyle } from 'react-native';
import { radius, spacing } from '../theme/tokens';
import { Typography } from './ui/Typography';

interface StatTileProps {
  value: string;
  label: string;
  color: string;
  style?: ViewStyle;
}

export function StatTile({ value, label, color, style }: StatTileProps) {
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: color + '18',
          borderRadius: radius.xl,
          padding: spacing.md,
          alignItems: 'center',
          gap: spacing.xs,
        },
        style,
      ]}
    >
      <Typography variant="h3" color={color} style={{ fontSize: 22 }}>
        {value}
      </Typography>
      <Typography variant="caption" color={color + 'AA'} align="center">
        {label}
      </Typography>
    </View>
  );
}
