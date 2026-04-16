// ─── PlanFeatureRow ────────────────────────────────────────────
// A single feature row inside a plan card.

import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

interface PlanFeatureRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean | number | string | null;
}

export function PlanFeatureRow({ icon, label, value }: PlanFeatureRowProps) {
  const { theme } = useTheme();

  const enabled = value !== false && value !== null && value !== 0;

  // Render a count label if numeric
  const suffix =
    typeof value === 'number'
      ? ` (${value === -1 ? '∞' : value})`
      : '';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Ionicons
        name={enabled ? icon : 'close-outline'}
        size={16}
        color={enabled ? theme.success : theme.textTertiary}
      />
      <Typography
        variant="bodySmall"
        color={enabled ? theme.text : theme.textTertiary}
        style={{ flex: 1 }}
      >
        {label}{suffix}
      </Typography>
    </View>
  );
}
