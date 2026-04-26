// ─── Heatmap ──────────────────────────────────────────────────
// GitHub-style study activity heatmap for progress analytics.

import { View } from 'react-native';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface HeatmapProps {
  heatmap: number[][];
}

export function Heatmap({ heatmap }: HeatmapProps) {
  const { theme } = useTheme();
  const intensityColors = [
    theme.border,
    theme.primary + '40',
    theme.primary + '80',
    theme.primary,
  ];

  return (
    <View style={{ gap: spacing.xs }}>
      {/* Day headers */}
      <View style={{ flexDirection: 'row', gap: spacing.xs, paddingLeft: 24 }}>
        {DAY_LABELS.map((d, i) => (
          <Typography
            key={i}
            variant="caption"
            color={theme.textTertiary}
            style={{ width: 18, fontSize: 9, textAlign: 'center' }}
          >
            {d}
          </Typography>
        ))}
      </View>

      {/* Grid rows */}
      {heatmap.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Typography
            variant="caption"
            color={theme.textTertiary}
            style={{ width: 20, fontSize: 9 }}
          >
            W{wi + 1}
          </Typography>
          {week.map((intensity, di) => (
            <View
              key={di}
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                backgroundColor: intensityColors[Math.min(intensity, 3)] ?? theme.border,
              }}
            />
          ))}
        </View>
      ))}

      {/* Legend */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginTop: spacing.xs,
          justifyContent: 'flex-end',
        }}
      >
        <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
          Less
        </Typography>
        {intensityColors.map((c, i) => (
          <View key={i} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />
        ))}
        <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
          More
        </Typography>
      </View>
    </View>
  );
}
