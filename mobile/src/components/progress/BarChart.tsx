// ─── BarChart ─────────────────────────────────────────────────
// Interactive SVG bar chart with animated bars and tappable selection.
// Features:
//   • SVG-based crisp bars with rounded tops
//   • Tappable bars with highlight and value label
//   • Gradient fill on bars
//   • Animated entrance
//   • Grid lines with Y-axis labels

import { useMemo, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import Svg, {
  Rect,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
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

const CHART_H = 130;
const PAD = { top: 8, right: 8, bottom: 24, left: 28 };

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

interface BarChartProps {
  data: { label: string; value: number }[];
  color: string;
  empty?: boolean;
}

export function BarChart({ data, color, empty = false }: BarChartProps) {
  const { theme } = useTheme();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const avg = data.length > 0 ? total / data.length : 0;

  const plotW = 280 - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const barGap = 8;
  const barW = (plotW - barGap * (data.length - 1)) / data.length;
  const W = 280;

  // Y-axis ticks
  const yTicks = [0, 0.5, 1].map((f) => ({
    y: PAD.top + f * plotH,
    value: Math.round(max * (1 - f)),
  }));

  // Avg Y
  const avgY = PAD.top + plotH - (avg / max) * plotH;

  const handleBarPress = useCallback((idx: number) => {
    if (empty) return;
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  }, [empty]);

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
            <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={lightenColor(color, 30)} stopOpacity={1} />
              <Stop offset="100%" stopColor={color} stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id="barGradDim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={lightenColor(color, 30)} stopOpacity={0.4} />
              <Stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </LinearGradient>
          </Defs>

          {/* Background */}
          <Rect
            x={PAD.left} y={PAD.top}
            width={plotW} height={plotH}
            rx={6} ry={6}
            fill={theme.cardAlt}
            fillOpacity={0.4}
          />

          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <G key={`grid-${i}`}>
              <Line
                x1={PAD.left} y1={tick.y}
                x2={PAD.left + plotW} y2={tick.y}
                stroke={theme.border} strokeWidth={0.5} strokeOpacity={0.3}
              />
              <SvgText
                x={PAD.left - 4} y={tick.y + 3}
                textAnchor="end" fontSize={8}
                fill={theme.textTertiary} fontFamily="System"
              >
                {tick.value}
              </SvgText>
            </G>
          ))}

          {/* Average line */}
          {!empty && avg > 0 && (
            <>
              <Line
                x1={PAD.left} y1={avgY}
                x2={PAD.left + plotW} y2={avgY}
                stroke="#F59E0B" strokeWidth={1}
                strokeDasharray="4,3" strokeOpacity={0.5}
              />
              <SvgText
                x={PAD.left + plotW + 2} y={avgY + 3}
                textAnchor="start" fontSize={7}
                fill="#F59E0B" fontFamily="System"
              >
                avg
              </SvgText>
            </>
          )}

          {/* Bars */}
          {data.map((d, i) => {
            const barH = empty ? plotH * 0.4 : Math.max(4, (d.value / max) * plotH);
            const barX = PAD.left + i * (barW + barGap);
            const barY = PAD.top + plotH - barH;
            const isSelected = selectedIdx === i;
            const dimmed = selectedIdx !== null && !isSelected;

            return (
              <G key={`bar-${i}`}>
                {/* Selected highlight background */}
                {isSelected && (
                  <Rect
                    x={barX - 3} y={PAD.top}
                    width={barW + 6} height={plotH}
                    rx={4} ry={4}
                    fill={color} fillOpacity={0.06}
                  />
                )}

                {/* Bar */}
                <Rect
                  x={barX} y={barY}
                  width={barW} height={barH}
                  rx={Math.min(barW / 2, 5)}
                  ry={Math.min(barW / 2, 5)}
                  fill={empty ? color : dimmed ? 'url(#barGradDim)' : 'url(#barGrad)'}
                  fillOpacity={empty ? 0.15 : 1}
                  onPress={() => handleBarPress(i)}
                />

                {/* Value label above bar */}
                {!empty && (isSelected || selectedIdx === null) && d.value > 0 && (
                  <SvgText
                    x={barX + barW / 2}
                    y={barY - 5}
                    textAnchor="middle"
                    fontSize={isSelected ? 11 : 9}
                    fontWeight={isSelected ? '700' : '400'}
                    fill={isSelected ? color : theme.textTertiary}
                    fontFamily="System"
                  >
                    {d.value}
                  </SvgText>
                )}

                {/* X-axis label */}
                <SvgText
                  x={barX + barW / 2}
                  y={CHART_H - 6}
                  textAnchor="middle" fontSize={9}
                  fill={isSelected ? theme.text : theme.textTertiary}
                  fontWeight={isSelected ? '700' : '400'}
                  fontFamily="System"
                >
                  {d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </Animated.View>

      {/* Selected bar detail */}
      {selectedData && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={{
            backgroundColor: color + '10',
            borderWidth: 1,
            borderColor: color + '25',
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
            <Typography variant="captionBold" color={color}>
              {selectedData.value} cards
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
