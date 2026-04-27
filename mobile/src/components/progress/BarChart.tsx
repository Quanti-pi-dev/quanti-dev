// ─── BarChart ─────────────────────────────────────────────────
// Simple vertical bar chart for progress analytics.

import { View } from 'react-native';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

interface BarChartProps {
  data: { label: string; value: number }[];
  color: string;
  empty?: boolean;
}

export function BarChart({ data, color, empty = false }: BarChartProps) {
  const { theme } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  const accessibilityLabel = empty
    ? 'Cards studied bar chart — no data yet'
    : `Cards studied. Total: ${data.reduce((s, d) => s + d.value, 0)}`;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: spacing.xs }}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
    >
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
          {/* Hide value labels in ghost/empty state to avoid confusing zeros */}
          {!empty && (
            <Typography
              variant="caption"
              color={theme.textTertiary}
              align="center"
              style={{ fontSize: 9 }}
            >
              {d.value}
            </Typography>
          )}
          <View
            style={{
              width: '100%',
              height: empty ? 40 : Math.max(4, (d.value / max) * 65),
              backgroundColor: color,
              borderRadius: radius.sm,
              opacity: empty ? 0.18 : (i === data.length - 1 ? 1 : 0.55),
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
