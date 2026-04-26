// ─── LineChart ────────────────────────────────────────────────
// Simple line chart rendered with View elements for progress analytics.

import { View } from 'react-native';
import { useTheme } from '../../theme';
import { radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

interface LineChartProps {
  data: { label: string; value: number }[];
  chartWidth: number;
}

export function LineChart({ data, chartWidth }: LineChartProps) {
  const { theme } = useTheme();
  if (data.length < 2) return null;

  const H = 80;
  const W = chartWidth;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const stepX = W / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: H - ((d.value - min) / range) * (H - 16) - 8,
    label: d.label,
    value: d.value,
  }));

  return (
    <View style={{ height: H + 20 }}>
      {/* Grid lines */}
      {[0, 0.5, 1].map((f, gi) => (
        <View
          key={gi}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: f * H,
            height: 1,
            backgroundColor: theme.border,
            opacity: 0.5,
          }}
        />
      ))}

      {/* Line segments */}
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        if (!next) return null;
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: len,
              height: 2,
              backgroundColor: theme.primary,
              opacity: 0.75,
              transformOrigin: 'left center',
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}

      {/* Data points */}
      {points.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.x - 4, top: p.y - 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: radius.full,
              backgroundColor: theme.primary,
              borderWidth: 2,
              borderColor: theme.card,
            }}
          />
        </View>
      ))}

      {/* Labels */}
      {points.map((p, i) => (
        <Typography
          key={i}
          variant="caption"
          color={theme.textTertiary}
          align="center"
          style={{ position: 'absolute', left: p.x - 14, top: H + 4, width: 28, fontSize: 9 }}
        >
          {p.label}
        </Typography>
      ))}
    </View>
  );
}
