// ─── BarChart ─────────────────────────────────────────────────
// Simple vertical bar chart for progress analytics.

import { View } from 'react-native';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

interface BarChartProps {
  data: { label: string; value: number }[];
  color: string;
}

export function BarChart({ data, color }: BarChartProps) {
  const { theme } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: spacing.xs }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
          <Typography
            variant="caption"
            color={theme.textTertiary}
            align="center"
            style={{ fontSize: 9 }}
          >
            {d.value}
          </Typography>
          <View
            style={{
              width: '100%',
              height: Math.max(4, (d.value / max) * 65),
              backgroundColor: color,
              borderRadius: radius.sm,
              opacity: i === data.length - 1 ? 1 : 0.55,
            }}
          />
          <Typography
            variant="caption"
            color={theme.textTertiary}
            align="center"
            style={{ fontSize: 9 }}
          >
            {d.label}
          </Typography>
        </View>
      ))}
    </View>
  );
}
