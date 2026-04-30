// ─── LineChart ────────────────────────────────────────────────
// Interactive SVG line chart with gradient area fill.
// Features:
//   • SVG-based smooth line with filled gradient area beneath
//   • Tappable data points with detail tooltip
//   • Average line indicator
//   • Animated entrance
//   • Grid lines with Y-axis labels

import { useMemo, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
  Rect,
} from 'react-native-svg';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

// ─── Constants ────────────────────────────────────────────────

const CHART_H = 120;
const PAD = { top: 12, right: 12, bottom: 24, left: 30 };

interface LineChartProps {
  data: { label: string; value: number }[];
  chartWidth: number;
  empty?: boolean;
}

export function LineChart({ data, chartWidth, empty = false }: LineChartProps) {
  const { theme } = useTheme();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (data.length < 2) return null;

  const W = chartWidth;
  const plotW = W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Add 10% padding on both ends for visual breathing room
  const rangeSpan = Math.max(rawMax - rawMin, 1);
  const min = Math.max(0, rawMin - rangeSpan * 0.1);
  const max = rawMax + rangeSpan * 0.1;
  const range = max - min;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  const stepX = plotW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: PAD.left + i * stepX,
    y: PAD.top + plotH - ((d.value - min) / range) * plotH,
    label: d.label,
    value: d.value,
  }));

  // SVG path for the line
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // SVG path for the area fill
  const areaPath = [
    ...points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`),
    `L ${points[points.length - 1]!.x} ${PAD.top + plotH}`,
    `L ${points[0]!.x} ${PAD.top + plotH}`,
    'Z',
  ].join(' ');

  // Average Y position
  const avgY = PAD.top + plotH - ((avg - min) / range) * plotH;

  // Y-axis tick values
  const yTicks = [0, 0.5, 1].map((f) => ({
    y: PAD.top + f * plotH,
    value: Math.round(max - f * range),
  }));

  const handlePointPress = useCallback((idx: number) => {
    if (empty) return;
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  }, [empty]);

  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null;
  const selectedData = selectedIdx !== null ? data[selectedIdx] : null;

  // Entrance animation
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);
  useMemo(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSpring(1, { damping: 16, stiffness: 120 });
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{ gap: spacing.sm }}>
      <Animated.View style={[{ alignItems: 'center' }, animStyle]}>
        <Svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`}>
          <Defs>
            <LinearGradient id="lineAreaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.primary} stopOpacity={empty ? 0.05 : 0.25} />
              <Stop offset="100%" stopColor={theme.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Background */}
          <Rect
            x={PAD.left} y={PAD.top}
            width={plotW} height={plotH}
            rx={6} ry={6}
            fill={theme.cardAlt}
            fillOpacity={0.5}
          />

          {/* Horizontal grid lines */}
          {yTicks.map((tick, i) => (
            <G key={`grid-${i}`}>
              <Line
                x1={PAD.left} y1={tick.y}
                x2={PAD.left + plotW} y2={tick.y}
                stroke={theme.border} strokeWidth={0.5} strokeOpacity={0.4}
              />
              <SvgText
                x={PAD.left - 4} y={tick.y + 3}
                textAnchor="end" fontSize={8}
                fill={theme.textTertiary} fontFamily="System"
              >
                {tick.value}%
              </SvgText>
            </G>
          ))}

          {/* Average line */}
          {!empty && (
            <Line
              x1={PAD.left} y1={avgY}
              x2={PAD.left + plotW} y2={avgY}
              stroke="#F59E0B" strokeWidth={1}
              strokeDasharray="4,3" strokeOpacity={0.6}
            />
          )}

          {/* Area fill */}
          <Path d={areaPath} fill="url(#lineAreaFill)" />

          {/* Line */}
          <Path
            d={linePath}
            fill="none"
            stroke={theme.primary}
            strokeWidth={empty ? 1.5 : 2.5}
            strokeOpacity={empty ? 0.2 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((p, i) => {
            const isSelected = selectedIdx === i;
            const dimmed = selectedIdx !== null && !isSelected;
            return (
              <G key={`pt-${i}`}>
                {isSelected && (
                  <>
                    {/* Vertical indicator line */}
                    <Line
                      x1={p.x} y1={PAD.top}
                      x2={p.x} y2={PAD.top + plotH}
                      stroke={theme.primary} strokeWidth={1}
                      strokeOpacity={0.3} strokeDasharray="3,2"
                    />
                    {/* Glow ring */}
                    <Circle
                      cx={p.x} cy={p.y} r={12}
                      fill={theme.primary} fillOpacity={0.12}
                      stroke={theme.primary} strokeWidth={1} strokeOpacity={0.25}
                    />
                    {/* Value label above point */}
                    <SvgText
                      x={p.x} y={p.y - 16}
                      textAnchor="middle" fontSize={11}
                      fontWeight="700" fill={theme.primary}
                      fontFamily="System"
                    >
                      {p.value}%
                    </SvgText>
                  </>
                )}
                <Circle
                  cx={p.x} cy={p.y}
                  r={isSelected ? 6 : 4}
                  fill={theme.primary}
                  fillOpacity={empty ? 0.2 : dimmed ? 0.3 : 1}
                  stroke={theme.card}
                  strokeWidth={1.5}
                  onPress={() => handlePointPress(i)}
                />
              </G>
            );
          })}

          {/* X-axis labels */}
          {points.map((p, i) => (
            <SvgText
              key={`xl-${i}`}
              x={p.x} y={CHART_H - 4}
              textAnchor="middle" fontSize={9}
              fill={selectedIdx === i ? theme.text : theme.textTertiary}
              fontWeight={selectedIdx === i ? '700' : '400'}
              fontFamily="System"
            >
              {p.label}
            </SvgText>
          ))}

          {/* Avg label */}
          {!empty && (
            <SvgText
              x={PAD.left + plotW + 2} y={avgY + 3}
              textAnchor="start" fontSize={7}
              fill="#F59E0B" fontFamily="System"
            >
              avg
            </SvgText>
          )}
        </Svg>
      </Animated.View>

      {/* Selected point detail */}
      {selectedPoint && selectedData && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={{
            backgroundColor: theme.primary + '10',
            borderWidth: 1,
            borderColor: theme.primary + '25',
            borderRadius: radius.md,
            paddingVertical: 6,
            paddingHorizontal: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="caption" color={theme.textSecondary}>
            Session {selectedIdx! + 1} ({selectedData.label})
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Typography variant="captionBold" color={theme.primary}>
              {selectedData.value}%
            </Typography>
            <Pressable onPress={() => setSelectedIdx(null)} hitSlop={8}>
              <Typography variant="caption" color={theme.textTertiary}>✕</Typography>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
