// ─── SectionHeader ────────────────────────────────────────────
// Reusable section title row with optional subtitle or action.

import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Typography } from '../ui/Typography';

interface SectionHeaderProps {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, sub, action }: SectionHeaderProps) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="h4">{title}</Typography>
      {action ?? (sub ? <Typography variant="label" color={theme.textTertiary}>{sub}</Typography> : null)}
    </View>
  );
}
