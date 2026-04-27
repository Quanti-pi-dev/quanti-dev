// ─── SpeedAccuracyChart ──────────────────────────────────────
// Scatter plot showing Speed (response time) vs Accuracy per session.
// 4 labeled quadrants: Mastering, Careful, Rushing, Struggling.

import { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { InsightCard } from './InsightCard';
import type { SpeedAccuracyPoint } from '@kd/shared';

// Quadrant definitions
const QUADRANTS = {
  mastering: { label: '🏆 Mastering', color: '#F59E0B', desc: 'Fast & accurate' },
  careful: { label: '🎯 Careful & Precise', color: '#10B981', desc: 'Slow but accurate' },
  rushing: { label: '⚡ Rushing', color: '#EF4444', desc: 'Fast but inaccurate' },
  struggling: { label: '📚 Struggling', color: '#6366F1', desc: 'Needs more practice' },
} as const;

type QuadrantKey = keyof typeof QUADRANTS;

function classifyPoint(
  avgMs: number,
  accuracy: number,
  medianMs: number,
): QuadrantKey {
  const isFast = avgMs < medianMs;
  const isAccurate = accuracy >= 65;
  if (isFast && isAccurate) return 'mastering';
  if (!isFast && isAccurate) return 'careful';
  if (isFast && !isAccurate) return 'rushing';
  return 'struggling';
}

interface SpeedAccuracyChartProps {
  data: SpeedAccuracyPoint[];
}

export function SpeedAccuracyChart({ data }: SpeedAccuracyChartProps) {
  const { theme } = useTheme();

  const { points, medianMs, dominantQuadrant, quadrantCounts } = useMemo(() => {
    if (data.length === 0) {
      return {
        points: [],
        medianMs: 3000,
        dominantQuadrant: 'careful' as QuadrantKey,
        quadrantCounts: { mastering: 0, careful: 0, rushing: 0, struggling: 0 },
      };
    }

    // Calculate median response time as the divider
    const sortedMs = [...data].sort((a, b) => a.avgResponseMs - b.avgResponseMs);
    const mid = Math.floor(sortedMs.length / 2);
    const medMs =
      sortedMs.length % 2 === 0
        ? (sortedMs[mid - 1]!.avgResponseMs + sortedMs[mid]!.avgResponseMs) / 2
        : sortedMs[mid]!.avgResponseMs;

    const counts = { mastering: 0, careful: 0, rushing: 0, struggling: 0 };
    const classified = data.map((p) => {
      const q = classifyPoint(p.avgResponseMs, p.accuracy, medMs);
      counts[q]++;
      return { ...p, quadrant: q };
    });

    const dominant = (Object.entries(counts) as [QuadrantKey, number][])
      .sort((a, b) => b[1] - a[1])[0]![0];

    return { points: classified, medianMs: medMs, dominantQuadrant: dominant, quadrantCounts: counts };
  }, [data]);

  const isEmpty = data.length < 3;
  // Normalize for scatter: X = response time (0-1), Y = accuracy (0-1)
  const maxMs = Math.max(...points.map((p) => p.avgResponseMs), 1);
  const CHART_H = 160;

  const cfg = QUADRANTS[dominantQuadrant];

  // Generate insight text based on dominant quadrant
  const insightTexts: Record<QuadrantKey, string> = {
    mastering: 'Most of your sessions are fast and accurate — you\'re mastering the material. Consider tackling harder levels!',
    careful: 'You\'re accurate but taking your time. This is a great learning strategy! Speed will come naturally with practice.',
    rushing: 'You\'re answering quickly but accuracy is suffering. Try slowing down and reading each question carefully.',
    struggling: 'Some topics are challenging — that\'s normal. Focus on reviewing flashcards in your weakest subjects.',
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card
        style={{ opacity: isEmpty ? 0.35 : 1 }}
        accessibilityElementsHidden={isEmpty}
        importantForAccessibility={isEmpty ? 'no-hide-descendants' : 'auto'}
      >
        <View style={{ gap: spacing.md }}>
          <Typography variant="h4">Speed vs. Accuracy</Typography>

          {/* Scatter plot area */}
          <View
            style={{
              height: CHART_H,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: radius.lg,
              backgroundColor: theme.cardAlt,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Quadrant labels (background) */}
            <View style={{ position: 'absolute', top: 6, right: 8, opacity: 0.5 }}>
              <Typography variant="caption" color={QUADRANTS.mastering.color} style={{ fontSize: 8 }}>
                Mastering ↗
              </Typography>
            </View>
            <View style={{ position: 'absolute', top: 6, left: 8, opacity: 0.5 }}>
              <Typography variant="caption" color={QUADRANTS.careful.color} style={{ fontSize: 8 }}>
                ↖ Careful
              </Typography>
            </View>
            <View style={{ position: 'absolute', bottom: 6, right: 8, opacity: 0.5 }}>
              <Typography variant="caption" color={QUADRANTS.rushing.color} style={{ fontSize: 8 }}>
                Rushing ↘
              </Typography>
            </View>
            <View style={{ position: 'absolute', bottom: 6, left: 8, opacity: 0.5 }}>
              <Typography variant="caption" color={QUADRANTS.struggling.color} style={{ fontSize: 8 }}>
                ↙ Struggling
              </Typography>
            </View>

            {/* Divider lines */}
            {/* Horizontal: 65% accuracy line */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: CHART_H * (1 - 0.65),
                height: 1,
                backgroundColor: theme.border,
                opacity: 0.6,
              }}
            />
            {/* Vertical: median response time */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: isEmpty ? '50%' : `${Math.min((medianMs / maxMs) * 100, 95)}%`,
                width: 1,
                backgroundColor: theme.border,
                opacity: 0.6,
              }}
            />

            {/* Data points */}
            {points.map((p, i) => {
              const x = ((p.avgResponseMs / maxMs) * 92) + 4; // % from left (4-96%)
              const y = ((1 - p.accuracy / 100) * 88) + 6;   // % from top (6-94%)
              const dotColor = QUADRANTS[p.quadrant].color;

              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: dotColor,
                    borderWidth: 1.5,
                    borderColor: theme.card,
                    marginLeft: -4,
                    marginTop: -4,
                  }}
                />
              );
            })}
          </View>

          {/* Axis labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
              ← Slower
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
              Response Time
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
              Faster →
            </Typography>
          </View>

          {/* Quadrant summary pills — only when there is data */}
          {!isEmpty && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {(Object.entries(quadrantCounts) as [QuadrantKey, number][])
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => (
                  <View
                    key={key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: QUADRANTS[key].color + '15',
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: radius.full,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: QUADRANTS[key].color,
                      }}
                    />
                    <Typography variant="caption" color={QUADRANTS[key].color} style={{ fontSize: 10 }}>
                      {QUADRANTS[key].label} ({count})
                    </Typography>
                  </View>
                ))}
            </View>
          )}
        </View>
      </Card>

      {/* Insight — only when there is data */}
      {!isEmpty && (
        <InsightCard
          icon={cfg.label.split(' ')[0]!}
          title={`Your pattern: ${cfg.desc}`}
          body={insightTexts[dominantQuadrant]}
          accentColor={cfg.color}
          delay={300}
        />
      )}
    </View>
  );
}
