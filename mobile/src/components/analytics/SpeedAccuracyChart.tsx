// ─── SpeedAccuracyChart ──────────────────────────────────────
// Interactive scatter-plot matrix showing response speed vs accuracy.
// Features:
//   • Four colored quadrants with gradient backgrounds
//   • Tappable data points with detail tooltip
//   • Animated entrance with staggered springs
//   • Summary stats bar with dominant quadrant highlight
//   • Trend indicator showing improvement over time
//   • SVG-based for crisp rendering and tap targets

import { useMemo, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import Svg, {
  Rect,
  Circle as SvgCircle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient as SvgGrad,
  Stop,
  G,
} from 'react-native-svg';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { InsightCard } from './InsightCard';
import type { SpeedAccuracyPoint } from '@kd/shared';

// ─── Quadrants ───────────────────────────────────────────────

const QUADRANTS = {
  mastering:  { emoji: '🏆', label: 'Mastering',  color: '#F59E0B', bgAlpha: '18', desc: 'Fast & accurate. You know this inside out.' },
  careful:    { emoji: '🎯', label: 'Careful',     color: '#10B981', bgAlpha: '15', desc: 'Accurate but slow. Taking time to think.' },
  rushing:    { emoji: '⚡', label: 'Rushing',     color: '#EF4444', bgAlpha: '15', desc: 'Fast but inaccurate. Speeding through.' },
  struggling: { emoji: '📚', label: 'Struggling',  color: '#6366F1', bgAlpha: '15', desc: 'Slow & inaccurate. Needs more review.' },
} as const;

type QuadrantKey = keyof typeof QUADRANTS;

function classifyPoint(avgMs: number, accuracy: number, medianMs: number): QuadrantKey {
  const isFast = avgMs < medianMs;
  const isAccurate = accuracy >= 65;
  if (isFast && isAccurate) return 'mastering';
  if (!isFast && isAccurate) return 'careful';
  if (isFast && !isAccurate) return 'rushing';
  return 'struggling';
}

// ─── Chart Constants ─────────────────────────────────────────

const CHART_W = 300;
const CHART_H = 200;
const PAD = { top: 8, right: 8, bottom: 22, left: 32 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Stat Pill ───────────────────────────────────────────────

function StatPill({ label, value, color, isHighlighted }: {
  label: string; value: string; color: string; isHighlighted?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.lg,
      backgroundColor: isHighlighted ? color + '18' : theme.cardAlt,
      borderWidth: isHighlighted ? 1 : 0,
      borderColor: color + '35',
    }}>
      <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9, marginBottom: 2 }}>
        {label}
      </Typography>
      <Typography variant="captionBold" color={isHighlighted ? color : theme.text} style={{ fontSize: 13 }}>
        {value}
      </Typography>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface SpeedAccuracyChartProps {
  data: SpeedAccuracyPoint[];
}

export function SpeedAccuracyChart({ data }: SpeedAccuracyChartProps) {
  const { theme } = useTheme();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const isEmpty = data.length === 0;

  // ── Classify and compute layout ──────────────────────────
  const { points, medianMs, maxMs, dominantQuadrant, quadrantCounts, avgAccuracy, avgSpeed, trend } =
    useMemo(() => {
      if (data.length === 0) {
        return {
          points: [] as (SpeedAccuracyPoint & { quadrant: QuadrantKey; px: number; py: number })[],
          medianMs: 3000,
          maxMs: 6000,
          dominantQuadrant: 'careful' as QuadrantKey,
          quadrantCounts: { mastering: 0, careful: 0, rushing: 0, struggling: 0 },
          avgAccuracy: 0,
          avgSpeed: 0,
          trend: 0,
        };
      }

      const sortedMs = [...data].sort((a, b) => a.avgResponseMs - b.avgResponseMs);
      const mid = Math.floor(sortedMs.length / 2);
      const medMs =
        sortedMs.length % 2 === 0
          ? (sortedMs[mid - 1]!.avgResponseMs + sortedMs[mid]!.avgResponseMs) / 2
          : sortedMs[mid]!.avgResponseMs;

      const mMax = Math.max(...data.map((p) => p.avgResponseMs), 1) * 1.1;

      const counts = { mastering: 0, careful: 0, rushing: 0, struggling: 0 };
      const classified = data.map((p) => {
        const q = classifyPoint(p.avgResponseMs, p.accuracy, medMs);
        counts[q]++;

        // X: time (left = slow, right = fast) → invert
        const xNorm = 1 - Math.min(p.avgResponseMs / mMax, 1);
        const yNorm = Math.min(p.accuracy / 100, 1);
        const px = PAD.left + xNorm * PLOT_W;
        const py = PAD.top + (1 - yNorm) * PLOT_H;

        return { ...p, quadrant: q, px, py };
      });

      const dominant = (Object.entries(counts) as [QuadrantKey, number][])
        .sort((a, b) => b[1] - a[1])[0]![0];

      const totalAcc = data.reduce((s, p) => s + p.accuracy, 0) / data.length;
      const totalSpeed = data.reduce((s, p) => s + p.avgResponseMs, 0) / data.length;

      // Calculate trend: compare last 3 vs first 3 sessions' accuracy
      let trendVal = 0;
      if (data.length >= 4) {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const firstThree = sorted.slice(0, 3);
        const lastThree = sorted.slice(-3);
        const firstAvg = firstThree.reduce((s, p) => s + p.accuracy, 0) / firstThree.length;
        const lastAvg = lastThree.reduce((s, p) => s + p.accuracy, 0) / lastThree.length;
        trendVal = lastAvg - firstAvg;
      }

      return {
        points: classified,
        medianMs: medMs,
        maxMs: mMax,
        dominantQuadrant: dominant,
        quadrantCounts: counts,
        avgAccuracy: Math.round(totalAcc),
        avgSpeed: totalSpeed,
        trend: Math.round(trendVal),
      };
    }, [data]);

  // Quadrant divider positions in SVG coords
  const medianLineX = PAD.left + (1 - medianMs / maxMs) * PLOT_W;
  const accuracyLineY = PAD.top + (1 - 0.65) * PLOT_H;

  const cfg = QUADRANTS[dominantQuadrant];

  const insightTexts: Record<QuadrantKey, string> = {
    mastering: 'Most of your sessions are fast and accurate — you\'re mastering the material. Consider tackling harder levels!',
    careful: 'You\'re accurate but taking your time. This is a great learning strategy! Speed will come naturally with practice.',
    rushing: 'You\'re answering quickly but accuracy is suffering. Try slowing down and reading each question carefully.',
    struggling: 'Some topics are challenging — that\'s normal. Focus on reviewing flashcards in your weakest subjects.',
  };

  // ── Entrance animation ────────────────────────────────────
  const chartScale = useSharedValue(0.92);
  const chartOpacity = useSharedValue(0);

  useMemo(() => {
    chartOpacity.value = withTiming(1, { duration: 400 });
    chartScale.value = withSpring(1, { damping: 16, stiffness: 120 });
  }, []);

  const chartAnimStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
    transform: [{ scale: chartScale.value }],
  }));

  const handlePointPress = useCallback((idx: number) => {
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <View style={{ gap: spacing.md }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4">Speed vs. Accuracy</Typography>
            {!isEmpty && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: cfg.color + '18',
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
                borderRadius: radius.full,
              }}>
                <Typography variant="caption" style={{ fontSize: 12 }}>{cfg.emoji}</Typography>
                <Typography variant="captionBold" color={cfg.color} style={{ fontSize: 11 }}>
                  {cfg.label}
                </Typography>
              </View>
            )}
          </View>

          {/* SVG Scatter Plot */}
          <Animated.View style={[{ alignItems: 'center' }, chartAnimStyle]}>
            <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
              <Defs>
                <SvgGrad id="gradMastering" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={QUADRANTS.mastering.color} stopOpacity="0.12" />
                  <Stop offset="1" stopColor={QUADRANTS.mastering.color} stopOpacity="0.04" />
                </SvgGrad>
                <SvgGrad id="gradCareful" x1="1" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={QUADRANTS.careful.color} stopOpacity="0.10" />
                  <Stop offset="1" stopColor={QUADRANTS.careful.color} stopOpacity="0.03" />
                </SvgGrad>
                <SvgGrad id="gradRushing" x1="0" y1="1" x2="1" y2="0">
                  <Stop offset="0" stopColor={QUADRANTS.rushing.color} stopOpacity="0.10" />
                  <Stop offset="1" stopColor={QUADRANTS.rushing.color} stopOpacity="0.03" />
                </SvgGrad>
                <SvgGrad id="gradStruggling" x1="1" y1="1" x2="0" y2="0">
                  <Stop offset="0" stopColor={QUADRANTS.struggling.color} stopOpacity="0.10" />
                  <Stop offset="1" stopColor={QUADRANTS.struggling.color} stopOpacity="0.03" />
                </SvgGrad>
              </Defs>

              {/* Background rounded rect */}
              <Rect
                x={PAD.left} y={PAD.top}
                width={PLOT_W} height={PLOT_H}
                rx={8} ry={8}
                fill={theme.cardAlt}
                stroke={theme.border}
                strokeWidth={0.5}
                strokeOpacity={0.5}
              />

              {/* Quadrant fills */}
              <Rect
                x={medianLineX} y={PAD.top}
                width={PAD.left + PLOT_W - medianLineX} height={accuracyLineY - PAD.top}
                fill="url(#gradMastering)"
              />
              <Rect
                x={PAD.left} y={PAD.top}
                width={medianLineX - PAD.left} height={accuracyLineY - PAD.top}
                fill="url(#gradCareful)"
              />
              <Rect
                x={medianLineX} y={accuracyLineY}
                width={PAD.left + PLOT_W - medianLineX} height={PAD.top + PLOT_H - accuracyLineY}
                fill="url(#gradRushing)"
              />
              <Rect
                x={PAD.left} y={accuracyLineY}
                width={medianLineX - PAD.left} height={PAD.top + PLOT_H - accuracyLineY}
                fill="url(#gradStruggling)"
              />

              {/* Grid lines (subtle) */}
              {[0.25, 0.5, 0.75].map((frac) => (
                <Line
                  key={`hg-${frac}`}
                  x1={PAD.left} y1={PAD.top + frac * PLOT_H}
                  x2={PAD.left + PLOT_W} y2={PAD.top + frac * PLOT_H}
                  stroke={theme.border} strokeWidth={0.5} strokeOpacity={0.3}
                />
              ))}
              {[0.25, 0.5, 0.75].map((frac) => (
                <Line
                  key={`vg-${frac}`}
                  x1={PAD.left + frac * PLOT_W} y1={PAD.top}
                  x2={PAD.left + frac * PLOT_W} y2={PAD.top + PLOT_H}
                  stroke={theme.border} strokeWidth={0.5} strokeOpacity={0.3}
                />
              ))}

              {/* Divider: accuracy threshold (65%) */}
              <Line
                x1={PAD.left} y1={accuracyLineY}
                x2={PAD.left + PLOT_W} y2={accuracyLineY}
                stroke={theme.textTertiary} strokeWidth={1}
                strokeDasharray="4,3" strokeOpacity={0.5}
              />

              {/* Divider: median speed */}
              <Line
                x1={medianLineX} y1={PAD.top}
                x2={medianLineX} y2={PAD.top + PLOT_H}
                stroke={theme.textTertiary} strokeWidth={1}
                strokeDasharray="4,3" strokeOpacity={0.5}
              />

              {/* Quadrant labels */}
              <SvgText x={PAD.left + PLOT_W - 4} y={PAD.top + 14} textAnchor="end" fontSize={9} fontWeight="700" fill={QUADRANTS.mastering.color} opacity={0.7} fontFamily="System">
                Mastering ↗
              </SvgText>
              <SvgText x={PAD.left + 4} y={PAD.top + 14} textAnchor="start" fontSize={9} fontWeight="700" fill={QUADRANTS.careful.color} opacity={0.7} fontFamily="System">
                ↖ Careful
              </SvgText>
              <SvgText x={PAD.left + PLOT_W - 4} y={PAD.top + PLOT_H - 6} textAnchor="end" fontSize={9} fontWeight="700" fill={QUADRANTS.rushing.color} opacity={0.7} fontFamily="System">
                Rushing ↘
              </SvgText>
              <SvgText x={PAD.left + 4} y={PAD.top + PLOT_H - 6} textAnchor="start" fontSize={9} fontWeight="700" fill={QUADRANTS.struggling.color} opacity={0.7} fontFamily="System">
                ↙ Struggling
              </SvgText>

              {/* Y-axis labels */}
              <SvgText x={PAD.left - 4} y={PAD.top + 6} textAnchor="end" fontSize={8} fill={theme.textTertiary} fontFamily="System">100%</SvgText>
              <SvgText x={PAD.left - 4} y={accuracyLineY + 3} textAnchor="end" fontSize={8} fill={theme.textTertiary} fontFamily="System">65%</SvgText>
              <SvgText x={PAD.left - 4} y={PAD.top + PLOT_H + 2} textAnchor="end" fontSize={8} fill={theme.textTertiary} fontFamily="System">0%</SvgText>

              {/* X-axis labels */}
              <SvgText x={PAD.left} y={CHART_H - 4} textAnchor="start" fontSize={8} fill={theme.textTertiary} fontFamily="System">← Slower</SvgText>
              <SvgText x={PAD.left + PLOT_W} y={CHART_H - 4} textAnchor="end" fontSize={8} fill={theme.textTertiary} fontFamily="System">Faster →</SvgText>

              {/* Data Points */}
              {!isEmpty && points.map((p, i) => {
                const isSelected = selectedIdx === i;
                const q = QUADRANTS[p.quadrant];
                const dimmed = selectedIdx !== null && !isSelected;
                return (
                  <G key={`pt-${i}`}>
                    {/* Glow ring for selected */}
                    {isSelected && (
                      <SvgCircle
                        cx={p.px} cy={p.py} r={14}
                        fill={q.color}
                        fillOpacity={0.15}
                        stroke={q.color}
                        strokeWidth={1}
                        strokeOpacity={0.3}
                      />
                    )}
                    {/* Dot */}
                    <SvgCircle
                      cx={p.px} cy={p.py}
                      r={isSelected ? 7 : 5}
                      fill={q.color}
                      fillOpacity={dimmed ? 0.25 : 1}
                      stroke={theme.card}
                      strokeWidth={1.5}
                      onPress={() => handlePointPress(i)}
                    />
                  </G>
                );
              })}
            </Svg>
          </Animated.View>

          {/* Selected Point Detail Tooltip */}
          {selectedPoint && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={{
                backgroundColor: QUADRANTS[selectedPoint.quadrant].color + '12',
                borderWidth: 1,
                borderColor: QUADRANTS[selectedPoint.quadrant].color + '30',
                borderRadius: radius.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: QUADRANTS[selectedPoint.quadrant].color + '22',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography style={{ fontSize: 18 }}>
                  {QUADRANTS[selectedPoint.quadrant].emoji}
                </Typography>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="label" color={QUADRANTS[selectedPoint.quadrant].color}>
                  {QUADRANTS[selectedPoint.quadrant].label}
                </Typography>
                <Typography variant="caption" color={theme.textSecondary}>
                  {selectedPoint.accuracy}% accuracy · {formatMs(selectedPoint.avgResponseMs)} avg · {selectedPoint.cardsStudied} cards
                </Typography>
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                  {new Date(selectedPoint.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Typography>
              </View>
              <Pressable onPress={() => setSelectedIdx(null)} hitSlop={12}>
                <Typography variant="caption" color={theme.textTertiary}>✕</Typography>
              </Pressable>
            </Animated.View>
          )}

          {/* Stats Row */}
          {!isEmpty && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatPill label="Sessions" value={String(data.length)} color={theme.primary} />
              <StatPill label="Avg Accuracy" value={`${avgAccuracy}%`} color="#10B981" isHighlighted={avgAccuracy >= 65} />
              <StatPill label="Avg Speed" value={formatMs(avgSpeed)} color="#0EA5E9" />
              {trend !== 0 && (
                <StatPill
                  label="Trend"
                  value={`${trend > 0 ? '↑' : '↓'} ${Math.abs(trend)}%`}
                  color={trend > 0 ? '#10B981' : '#EF4444'}
                  isHighlighted
                />
              )}
            </View>
          )}

          {/* Quadrant Distribution Bar */}
          {!isEmpty && (
            <View style={{ gap: spacing.xs }}>
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                Session Distribution
              </Typography>
              <View style={{
                flexDirection: 'row',
                height: 8,
                borderRadius: 4,
                overflow: 'hidden',
                backgroundColor: theme.cardAlt,
              }}>
                {(['mastering', 'careful', 'rushing', 'struggling'] as QuadrantKey[]).map((qk) => {
                  const count = quadrantCounts[qk];
                  if (count === 0) return null;
                  const pct = (count / data.length) * 100;
                  return (
                    <View
                      key={qk}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: QUADRANTS[qk].color,
                        opacity: qk === dominantQuadrant ? 1 : 0.5,
                      }}
                    />
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                {(['mastering', 'careful', 'rushing', 'struggling'] as QuadrantKey[]).map((qk) => {
                  const count = quadrantCounts[qk];
                  if (count === 0) return null;
                  const q = QUADRANTS[qk];
                  return (
                    <View key={qk} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: q.color,
                        opacity: qk === dominantQuadrant ? 1 : 0.5,
                      }} />
                      <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                        {q.label} {Math.round((count / data.length) * 100)}%
                      </Typography>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Empty State */}
          {isEmpty && (
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
              <Typography variant="label" color={theme.textTertiary} align="center">
                Complete study sessions to see your performance matrix
              </Typography>
              <Typography variant="caption" color={theme.textTertiary} align="center">
                Each session will appear as a dot — fast & accurate sessions land in the top-right Mastering zone
              </Typography>
            </View>
          )}
        </View>
      </Card>

      {/* Insight card */}
      {!isEmpty && (
        <InsightCard
          icon={cfg.emoji}
          title={`Your pattern: ${cfg.desc}`}
          body={insightTexts[dominantQuadrant]}
          accentColor={cfg.color}
          delay={500}
        />
      )}
    </View>
  );
}
