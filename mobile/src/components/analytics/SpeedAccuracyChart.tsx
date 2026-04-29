import { useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { InsightCard } from './InsightCard';
import { Icon } from '../ui/Icon';
import type { SpeedAccuracyPoint } from '@kd/shared';

// Quadrant definitions
const QUADRANTS = {
  mastering: { label: '🏆 Mastering', color: '#F59E0B', desc: 'Fast & accurate. You know this inside out.' },
  careful: { label: '🎯 Careful', color: '#10B981', desc: 'Accurate but slow. Taking time to think.' },
  rushing: { label: '⚡ Rushing', color: '#EF4444', desc: 'Fast but inaccurate. Speeding through.' },
  struggling: { label: '📚 Struggling', color: '#6366F1', desc: 'Slow & inaccurate. Needs review.' },
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

import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, FadeIn, FadeOut } from 'react-native-reanimated';

// Legend Card Component
function LegendCard({ quadrant, delay }: { quadrant: QuadrantKey; delay: number }) {
  const { theme } = useTheme();
  const q = QUADRANTS[quadrant];
  return (
    <Animated.View 
      entering={FadeIn.delay(delay).springify()} 
      exiting={FadeOut.duration(200)}
      style={{ 
        width: '48%', 
        backgroundColor: theme.card, 
        padding: spacing.md, 
        borderRadius: radius.xl, 
        borderWidth: 1, 
        borderColor: theme.border, 
        borderTopWidth: 3, 
        borderTopColor: q.color,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <Typography variant="captionBold" color={q.color} style={{ fontSize: 13, marginBottom: 4 }}>
        {q.label}
      </Typography>
      <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 11, lineHeight: 16 }}>
        {q.desc}
      </Typography>
    </Animated.View>
  );
}

interface SpeedAccuracyChartProps {
  data: SpeedAccuracyPoint[];
}

export function SpeedAccuracyChart({ data }: SpeedAccuracyChartProps) {
  const { theme } = useTheme();
  const [showLegend, setShowLegend] = useState(false);

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

  const isEmpty = data.length === 0;
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

  const medianX = isEmpty ? 50 : Math.min((medianMs / maxMs) * 100, 95);
  const horizY = (1 - 0.65) * 100; // 35%

  return (
    <View style={{ gap: spacing.md }}>
      <Card
        accessibilityElementsHidden={isEmpty}
        importantForAccessibility={isEmpty ? 'no-hide-descendants' : 'auto'}
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4">Speed vs. Accuracy</Typography>
            <TouchableOpacity 
              onPress={() => setShowLegend(!showLegend)}
              style={{
                width: 32, height: 32, borderRadius: 16, backgroundColor: showLegend ? theme.primary + '20' : theme.cardAlt,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: showLegend ? theme.primary + '40' : theme.border
              }}
            >
              <Icon name={showLegend ? "close" : "information-outline"} size={18} color={showLegend ? theme.primary : theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {showLegend && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '4%', rowGap: spacing.sm, marginBottom: spacing.xs }}>
              <LegendCard quadrant="careful" delay={0} />
              <LegendCard quadrant="mastering" delay={100} />
              <LegendCard quadrant="struggling" delay={200} />
              <LegendCard quadrant="rushing" delay={300} />
            </View>
          )}

          {/* Scatter plot area */}
          <View
            style={{
              height: CHART_H,
              borderWidth: 1,
              borderColor: theme.border + '80', // softer border
              borderRadius: radius.xl, // softer corners
              backgroundColor: theme.cardAlt,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Colored Quadrant Backgrounds */}
            <View style={{ position: 'absolute', top: 0, left: `${medianX}%`, right: 0, height: `${horizY}%`, backgroundColor: QUADRANTS.mastering.color + '25' }} />
            <View style={{ position: 'absolute', top: 0, left: 0, width: `${medianX}%`, height: `${horizY}%`, backgroundColor: QUADRANTS.careful.color + '25' }} />
            <View style={{ position: 'absolute', top: `${horizY}%`, left: `${medianX}%`, right: 0, bottom: 0, backgroundColor: QUADRANTS.rushing.color + '25' }} />
            <View style={{ position: 'absolute', top: `${horizY}%`, left: 0, width: `${medianX}%`, bottom: 0, backgroundColor: QUADRANTS.struggling.color + '25' }} />

            {/* Quadrant labels (foreground pills) */}
            <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: theme.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}>
              <Typography variant="caption" color={QUADRANTS.mastering.color} style={{ fontSize: 11, fontWeight: '800' }}>
                Mastering ↗
              </Typography>
            </View>
            <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: theme.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}>
              <Typography variant="caption" color={QUADRANTS.careful.color} style={{ fontSize: 11, fontWeight: '800' }}>
                ↖ Careful
              </Typography>
            </View>
            <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: theme.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}>
              <Typography variant="caption" color={QUADRANTS.rushing.color} style={{ fontSize: 11, fontWeight: '800' }}>
                Rushing ↘
              </Typography>
            </View>
            <View style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: theme.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}>
              <Typography variant="caption" color={QUADRANTS.struggling.color} style={{ fontSize: 11, fontWeight: '800' }}>
                ↙ Struggling
              </Typography>
            </View>

            {/* Divider lines (dashed crosshairs) */}
            {/* Horizontal: 65% accuracy line */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${horizY}%`,
                height: 2,
                borderTopWidth: 2,
                borderTopColor: theme.textTertiary,
                borderStyle: 'dashed',
                opacity: 0.6,
              }}
            />
            {/* Vertical: median response time */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${medianX}%`,
                width: 2,
                borderLeftWidth: 2,
                borderLeftColor: theme.textTertiary,
                borderStyle: 'dashed',
                opacity: 0.6,
              }}
            />
          </View>

          {/* Axis labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs }}>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
              ← Slower
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
              Response Time
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
              Faster →
            </Typography>
          </View>
        </View>
      </Card>

      {/* Insight — only when there is data */}
      {!isEmpty && (
        <InsightCard
          icon={cfg.label.split(' ')[0]!}
          title={`Your pattern: ${cfg.desc}`}
          body={insightTexts[dominantQuadrant]}
          accentColor={cfg.color}
          delay={500}
        />
      )}
    </View>
  );
}
