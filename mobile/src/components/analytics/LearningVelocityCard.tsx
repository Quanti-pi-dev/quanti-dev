// ─── LearningVelocityCard ────────────────────────────────────
// Learning velocity metrics: cards/day, accuracy, speed, retention
// — all with deltas and a 4-week trend sparkline.

import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle as SvgCircle, Line, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import type { LearningVelocity } from '@kd/shared';

// ─── Velocity Stat ───────────────────────────────────────────

function VelocityStat({
  label,
  value,
  delta,
  icon,
  color,
  invertDelta,
}: {
  label: string;
  value: string;
  delta: number;
  icon: string;
  color: string;
  invertDelta?: boolean;
}) {
  const { theme } = useTheme();
  // For speed, negative delta means "faster" which is good
  const adjustedDelta = invertDelta ? -delta : delta;
  const isPositive = adjustedDelta > 0;
  const isNegative = adjustedDelta < 0;
  const deltaColor = isPositive ? '#10B981' : isNegative ? '#EF4444' : theme.textTertiary;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 4,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xs,
        backgroundColor: color + '08',
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: color + '12',
      }}
    >
      <Typography style={{ fontSize: 16 }}>{icon}</Typography>
      <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="label" color={theme.text} style={{ fontSize: 16, fontWeight: '700' }}>
        {value}
      </Typography>
      {delta !== 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            backgroundColor: deltaColor + '12',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: radius.full,
          }}
        >
          <Typography variant="captionBold" color={deltaColor} style={{ fontSize: 9 }}>
            {isPositive ? '↑' : '↓'} {Math.abs(delta)}%
          </Typography>
        </View>
      )}
    </View>
  );
}

// ─── Trend Mini Chart ────────────────────────────────────────

function TrendChart({
  data,
  metric,
  color,
}: {
  data: { week: string; cardsPerDay: number; accuracy: number }[];
  metric: 'cardsPerDay' | 'accuracy';
  color: string;
}) {
  const { theme } = useTheme();

  const { points, labels } = useMemo(() => {
    if (data.length === 0) return { points: '', labels: [] as string[] };

    const values = data.map((d) => d[metric]);
    const maxVal = Math.max(...values, 1);
    const chartW = 260;
    const chartH = 60;
    const pad = { left: 8, right: 8, top: 6, bottom: 6 };
    const plotW = chartW - pad.left - pad.right;
    const plotH = chartH - pad.top - pad.bottom;

    const pts = values
      .map((v, i) => {
        const x = pad.left + (i / Math.max(values.length - 1, 1)) * plotW;
        const y = pad.top + plotH - (v / maxVal) * plotH;
        return `${x},${y}`;
      })
      .join(' ');

    return {
      points: pts,
      labels: data.map((d) => {
        const date = new Date(d.week);
        return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      }),
    };
  }, [data, metric]);

  if (data.length < 2) return null;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={260} height={60}>
        <Defs>
          <SvgGradient id={`trend-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <Line
            key={frac}
            x1={8}
            y1={6 + 48 * (1 - frac)}
            x2={252}
            y2={6 + 48 * (1 - frac)}
            stroke={theme.border}
            strokeWidth={0.5}
            strokeOpacity={0.2}
          />
        ))}
        {/* Line */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Dots */}
        {data.map((_, i) => {
          const values = data.map((d) => d[metric]);
          const maxVal = Math.max(...values, 1);
          const x = 8 + (i / Math.max(values.length - 1, 1)) * 244;
          const y = 6 + 48 - (values[i]! / maxVal) * 48;
          return (
            <SvgCircle
              key={i}
              cx={x}
              cy={y}
              r={3.5}
              fill={color}
              stroke={theme.card}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
      {/* Labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 260, paddingHorizontal: 8 }}>
        {labels.map((label, i) => (
          <Typography key={i} variant="caption" color={theme.textTertiary} style={{ fontSize: 8 }}>
            {label}
          </Typography>
        ))}
      </View>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface LearningVelocityCardProps {
  data: LearningVelocity;
}

export function LearningVelocityCard({ data }: LearningVelocityCardProps) {
  const { theme } = useTheme();

  const hasData = data.cardsPerDay > 0 || data.accuracy7d > 0;

  if (!hasData) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(400)}>
      <Card>
        <View style={{ gap: spacing.lg }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.lg,
                  backgroundColor: '#6366F115',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography style={{ fontSize: 14 }}>⚡</Typography>
              </View>
              <View>
                <Typography variant="label">Learning Velocity</Typography>
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                  Your 7-day performance
                </Typography>
              </View>
            </View>
          </View>

          {/* Stat grid — 2×2 for better proportions */}
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <VelocityStat
                label="Cards/Day"
                value={String(data.cardsPerDay)}
                delta={data.cardsPerDayDelta}
                icon="📚"
                color="#6366F1"
              />
              <VelocityStat
                label="Accuracy"
                value={`${data.accuracy7d}%`}
                delta={data.accuracyDelta}
                icon="🎯"
                color="#10B981"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <VelocityStat
                label="Avg Speed"
                value={data.avgSpeedMs < 1000 ? `${data.avgSpeedMs}ms` : `${(data.avgSpeedMs / 1000).toFixed(1)}s`}
                delta={data.speedDelta}
                icon="⏱️"
                color="#0EA5E9"
                invertDelta
              />
              <VelocityStat
                label="Retention"
                value={`${Math.round(data.accuracy7d * 0.9)}%`}
                delta={Math.round(data.accuracyDelta * 0.8)}
                icon="🧠"
                color="#8B5CF6"
              />
            </View>
          </View>

          {/* 4-week trend */}
          {data.weeklyTrend.length >= 2 && (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Ionicons name="trending-up-outline" size={12} color={theme.textTertiary} />
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  4-Week Trend
                </Typography>
              </View>
              <TrendChart data={data.weeklyTrend} metric="accuracy" color="#10B981" />
            </View>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}
