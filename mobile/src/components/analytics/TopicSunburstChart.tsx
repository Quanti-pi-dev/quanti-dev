// ─── TopicSunburstChart ──────────────────────────────────────
// Premium hierarchical sunburst chart with:
//   • Inner ring → Subjects (proportional by study effort)
//   • Outer ring → Topics within each subject
//   • Tap any segment to select — glow highlight + detail banner
//   • Animated entrance with spring physics
//   • Rich HSL color palette with luminance-shifted topic shades
//   • Ghost skeleton for empty state

import { useMemo, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Path, Circle, G, Defs, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import type { SubjectTopicDistribution } from '@kd/shared';

// ─── Constants ───────────────────────────────────────────────

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;

const CENTER_R = 48;
const INNER_R = 56;
const INNER_THICK = 36;
const OUTER_R = INNER_R + INNER_THICK + 4;
const OUTER_THICK = 24;
const GAP_RAD = 0.025;
const MIN_ARC = 0.06;

// ─── Premium Color Palette ───────────────────────────────────
// Curated HSL-based hues — rich but not garish

const SUBJECT_PALETTE = [
  { base: '#7C5CFC', light: '#A78BFA', muted: '#7C5CFC20' }, // Violet
  { base: '#3B82F6', light: '#60A5FA', muted: '#3B82F620' }, // Blue
  { base: '#06B6D4', light: '#22D3EE', muted: '#06B6D420' }, // Cyan
  { base: '#10B981', light: '#34D399', muted: '#10B98120' }, // Emerald
  { base: '#F59E0B', light: '#FBBF24', muted: '#F59E0B20' }, // Amber
  { base: '#F43F5E', light: '#FB7185', muted: '#F43F5E20' }, // Rose
  { base: '#8B5CF6', light: '#A78BFA', muted: '#8B5CF620' }, // Purple
  { base: '#EC4899', light: '#F472B6', muted: '#EC489920' }, // Pink
];

// ─── Geometry Helpers ────────────────────────────────────────

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return '';
  const s1 = polar(cx, cy, outerR, startAngle);
  const e1 = polar(cx, cy, outerR, endAngle);
  const s2 = polar(cx, cy, innerR, endAngle);
  const e2 = polar(cx, cy, innerR, startAngle);
  const large = sweep > Math.PI ? 1 : 0;
  return [
    `M ${s1.x} ${s1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y}`,
    'Z',
  ].join(' ');
}

/** Shift hex color lightness by blending toward white (+) or black (-) */
function shiftColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const t = amount > 0 ? 255 : 0;
  const p = Math.abs(amount) / 100;
  const nr = Math.round(r + (t - r) * p);
  const ng = Math.round(g + (t - g) * p);
  const nb = Math.round(b + (t - b) * p);
  return `#${((1 << 24) | (nr << 16) | (ng << 8) | nb).toString(16).slice(1)}`;
}

// ─── Types ────────────────────────────────────────────────────

interface SegmentInfo {
  id: string;
  path: string;
  color: string;
  glowColor: string;
  ring: 'inner' | 'outer';
  subjectIndex: number;
  topicIndex: number;
  label: string;
  value: number;
  total: number;
  pct: number;
  accuracy: number;
}

interface CenterInfo {
  label: string;
  value: number;
  sub: string;
}

// ─── Ghost Data ──────────────────────────────────────────────

const GHOST_SUBJECTS = 4;
const GHOST_TOPICS = [3, 2, 3, 2];

// ─── Legend Item ─────────────────────────────────────────────

function LegendItem({ color, label, pct, isSelected, onPress }: {
  color: string;
  label: string;
  pct: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: 6,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: isSelected ? color + '15' : 'transparent',
      }}
    >
      <View style={{
        width: 12, height: 12, borderRadius: radius.xs,
        backgroundColor: color,
        ...(isSelected && {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
          elevation: 4,
        }),
      }} />
      <Typography
        variant="label"
        style={{ flex: 1 }}
        numberOfLines={1}
        color={isSelected ? theme.text : theme.textSecondary}
      >
        {label}
      </Typography>
      {/* Mini bar */}
      <View style={{
        width: 48, height: 5, borderRadius: 3,
        backgroundColor: theme.border,
        overflow: 'hidden',
      }}>
        <View style={{
          width: `${Math.min(pct, 100)}%` as any,
          height: '100%',
          borderRadius: 3,
          backgroundColor: color,
          opacity: isSelected ? 1 : 0.7,
        }} />
      </View>
      <Typography variant="captionBold" color={isSelected ? color : theme.textTertiary} style={{ width: 32, textAlign: 'right' }}>
        {pct}%
      </Typography>
    </Pressable>
  );
}

// ─── Topic Sub-row ───────────────────────────────────────────

function TopicRow({ color, label, pct, isSelected, onPress }: {
  color: string;
  label: string;
  pct: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: 4,
        paddingLeft: 36,
        paddingRight: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: isSelected ? color + '12' : 'transparent',
      }}
    >
      <View style={{
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: color,
        opacity: isSelected ? 1 : 0.6,
      }} />
      <Typography
        variant="caption"
        color={isSelected ? theme.text : theme.textSecondary}
        style={{ flex: 1 }}
        numberOfLines={1}
      >
        {label}
      </Typography>
      <View style={{
        width: 36, height: 4, borderRadius: 2,
        backgroundColor: theme.border,
        overflow: 'hidden',
      }}>
        <View style={{
          width: `${Math.min(pct, 100)}%` as any,
          height: '100%',
          borderRadius: 2,
          backgroundColor: color,
          opacity: isSelected ? 0.9 : 0.5,
        }} />
      </View>
      <Typography variant="caption" color={theme.textTertiary} style={{ width: 28, textAlign: 'right' }}>
        {pct}%
      </Typography>
    </Pressable>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface TopicSunburstChartProps {
  data: SubjectTopicDistribution[];
}

export function TopicSunburstChart({ data }: TopicSunburstChartProps) {
  const { theme } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedSubject, setExpandedSubject] = useState<number | null>(0);

  const isEmpty = data.length === 0;

  // ── Compute segments ──────────────────────────────────────
  const { segments, centerDefault, subjectMeta } = useMemo(() => {
    const segs: SegmentInfo[] = [];
    const meta: { name: string; color: string; pct: number; topics: { name: string; color: string; pct: number; id: string }[] }[] = [];

    if (isEmpty) {
      const ghostShare = (2 * Math.PI) / GHOST_SUBJECTS;
      let angle = -Math.PI / 2;
      for (let si = 0; si < GHOST_SUBJECTS; si++) {
        const pal = SUBJECT_PALETTE[si % SUBJECT_PALETTE.length]!;
        const subStart = angle + GAP_RAD / 2;
        const subEnd = angle + ghostShare - GAP_RAD / 2;
        segs.push({
          id: `ghost-inner-${si}`,
          path: arcPath(CX, CY, INNER_R, INNER_R + INNER_THICK, subStart, subEnd),
          color: pal.base, glowColor: pal.light, ring: 'inner',
          subjectIndex: si, topicIndex: -1,
          label: '', value: 0, total: 0, pct: 0, accuracy: 0,
        });
        const topics = GHOST_TOPICS[si] ?? 2;
        const topicShare = (ghostShare - GAP_RAD) / topics;
        for (let ti = 0; ti < topics; ti++) {
          const ts = subStart + ti * topicShare + GAP_RAD / 3;
          const te = subStart + (ti + 1) * topicShare - GAP_RAD / 3;
          segs.push({
            id: `ghost-outer-${si}-${ti}`,
            path: arcPath(CX, CY, OUTER_R, OUTER_R + OUTER_THICK, ts, te),
            color: shiftColor(pal.base, 30),
            glowColor: pal.light,
            ring: 'outer',
            subjectIndex: si, topicIndex: ti,
            label: '', value: 0, total: 0, pct: 0, accuracy: 0,
          });
        }
        angle += ghostShare;
      }
      return {
        segments: segs,
        centerDefault: { label: 'No data', value: 0, sub: 'yet' },
        subjectMeta: meta,
      };
    }

    const grandTotal = data.reduce((s, d) => s + d.totalAnswers, 0) || 1;
    const fullArc = 2 * Math.PI;
    let angle = -Math.PI / 2;

    data.forEach((subject, si) => {
      const pal = SUBJECT_PALETTE[si % SUBJECT_PALETTE.length]!;
      const subjectArc = Math.max(MIN_ARC, (subject.totalAnswers / grandTotal) * fullArc);
      const subStart = angle + GAP_RAD / 2;
      const subEnd = angle + subjectArc - GAP_RAD / 2;
      const subjectPct = subject.totalAnswers > 0
        ? Math.round((subject.correctAnswers / subject.totalAnswers) * 100)
        : 0;

      if (subEnd > subStart) {
        segs.push({
          id: `s-${si}`,
          path: arcPath(CX, CY, INNER_R, INNER_R + INNER_THICK, subStart, subEnd),
          color: pal.base,
          glowColor: pal.light,
          ring: 'inner',
          subjectIndex: si,
          topicIndex: -1,
          label: subject.subjectName,
          value: subject.totalAnswers,
          total: subject.totalAnswers,
          pct: subjectPct,
          accuracy: subjectPct,
        });
      }

      // Outer ring — topics
      const topicTotal = subject.topics.reduce((s, t) => s + t.totalAnswers, 0) || 1;
      let topicAngle = subStart;
      const usableArc = subjectArc - GAP_RAD;
      const topicMetas: typeof meta[0]['topics'] = [];

      subject.topics.forEach((topic, ti) => {
        const topicArc = Math.max(
          MIN_ARC * 0.5,
          (topic.totalAnswers / topicTotal) * usableArc,
        );
        const ts = topicAngle + GAP_RAD / 3;
        const te = topicAngle + topicArc - GAP_RAD / 3;
        topicAngle += topicArc;

        // Lighter shade per topic — shifted 20-50% toward white
        const lightShift = 20 + ti * 12;
        const topicColor = shiftColor(pal.base, lightShift);
        const topicPct = topic.totalAnswers > 0
          ? Math.round((topic.correctAnswers / topic.totalAnswers) * 100)
          : 0;
        const id = `t-${si}-${ti}`;

        if (te > ts) {
          segs.push({
            id,
            path: arcPath(CX, CY, OUTER_R, OUTER_R + OUTER_THICK, ts, te),
            color: topicColor,
            glowColor: shiftColor(topicColor, 15),
            ring: 'outer',
            subjectIndex: si,
            topicIndex: ti,
            label: topic.topicName,
            value: topic.totalAnswers,
            total: topic.totalAnswers,
            pct: topicPct,
            accuracy: topicPct,
          });
        }

        topicMetas.push({ name: topic.topicName, color: topicColor, pct: topicPct, id });
      });

      meta.push({
        name: subject.subjectName,
        color: pal.base,
        pct: subjectPct,
        topics: topicMetas,
      });

      angle += subjectArc;
    });

    return {
      segments: segs,
      centerDefault: {
        label: 'Total',
        value: grandTotal,
        sub: 'answers',
      },
      subjectMeta: meta,
    };
  }, [data, isEmpty]);

  // ── Selected segment info for center ──────────────────────
  const centerInfo = useMemo<CenterInfo>(() => {
    if (!selectedId) return centerDefault;
    const seg = segments.find((s) => s.id === selectedId);
    if (!seg) return centerDefault;
    return {
      label: seg.label,
      value: seg.accuracy,
      sub: '% accuracy',
    };
  }, [selectedId, segments, centerDefault]);

  // ── Tap handlers ──────────────────────────────────────────
  const handleSegmentPress = useCallback((id: string, subjectIndex: number) => {
    if (isEmpty) return;
    setSelectedId((prev) => (prev === id ? null : id));
    setExpandedSubject(subjectIndex);
  }, [isEmpty]);

  const handleLegendPress = useCallback((subjectIndex: number) => {
    const id = `s-${subjectIndex}`;
    setSelectedId((prev) => (prev === id ? null : id));
    setExpandedSubject((prev) => (prev === subjectIndex ? null : subjectIndex));
  }, []);

  const handleTopicLegendPress = useCallback((id: string, subjectIndex: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
    setExpandedSubject(subjectIndex);
  }, []);

  // ── Entrance animation ────────────────────────────────────
  const svgScale = useSharedValue(0.85);
  const svgOpacity = useSharedValue(0);

  useMemo(() => {
    svgOpacity.value = withTiming(1, { duration: 600 });
    svgScale.value = withSpring(1, { damping: 14, stiffness: 100 });
  }, []);

  const svgAnimStyle = useAnimatedStyle(() => ({
    opacity: svgOpacity.value,
    transform: [{ scale: svgScale.value }],
  }));

  return (
    <Card
      accessible
      accessibilityRole="summary"
      accessibilityLabel={
        isEmpty
          ? 'Topic Distribution chart. No data yet.'
          : `Topic Distribution chart. ${subjectMeta.length} subjects.`
      }
    >
      <View style={{ gap: spacing.lg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography variant="h4">Topic Mastery</Typography>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radius.full,
            backgroundColor: theme.primaryMuted,
          }}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.primary }} />
            <Typography variant="caption" color={theme.primary} style={{ fontSize: 10 }}>
              accuracy %
            </Typography>
          </View>
        </View>

        {/* SVG Sunburst */}
        <Animated.View style={[{ alignItems: 'center' }, svgAnimStyle]}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={theme.primary} stopOpacity="0.06" />
                <Stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Subtle center glow */}
            <Circle cx={CX} cy={CY} r={CENTER_R + 8} fill="url(#centerGlow)" />

            {/* Render all segments */}
            {segments.map((seg) => {
              const isSelected = selectedId === seg.id;
              const selectedSeg = selectedId ? segments.find((s) => s.id === selectedId) : null;
              const isSiblingHighlight = selectedSeg
                ? seg.subjectIndex === selectedSeg.subjectIndex
                : false;

              const opacity = isEmpty
                ? 0.08
                : selectedId === null
                  ? 0.88
                  : isSelected
                    ? 1
                    : isSiblingHighlight
                      ? 0.6
                      : 0.15;

              return (
                <Path
                  key={seg.id}
                  d={seg.path}
                  fill={isSelected ? seg.glowColor : seg.color}
                  fillOpacity={opacity}
                  stroke={isSelected ? seg.glowColor : theme.card}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  onPress={() => handleSegmentPress(seg.id, seg.subjectIndex)}
                />
              );
            })}

            {/* Center circle — frosted glass look */}
            <Circle
              cx={CX}
              cy={CY}
              r={CENTER_R}
              fill={theme.card}
              stroke={theme.border}
              strokeWidth={1.5}
            />
            {/* Thin accent ring inside center */}
            <Circle
              cx={CX}
              cy={CY}
              r={CENTER_R - 3}
              fill="none"
              stroke={selectedId ? (segments.find(s => s.id === selectedId)?.color ?? theme.primary) : theme.primary}
              strokeWidth={0.8}
              strokeOpacity={0.3}
            />

            {/* Center text */}
            {!isEmpty ? (
              <>
                <SvgText
                  x={CX}
                  y={centerInfo.label === 'Total' ? CY - 4 : CY - 6}
                  textAnchor="middle"
                  fontSize={centerInfo.label === 'Total' ? 24 : 20}
                  fontWeight="800"
                  fill={selectedId
                    ? (segments.find(s => s.id === selectedId)?.color ?? theme.text)
                    : theme.text}
                  fontFamily="System"
                >
                  {centerInfo.value}
                </SvgText>
                <SvgText
                  x={CX}
                  y={centerInfo.label === 'Total' ? CY + 14 : CY + 12}
                  textAnchor="middle"
                  fontSize={9}
                  fill={theme.textTertiary}
                  fontFamily="System"
                  fontWeight="500"
                >
                  {centerInfo.label === 'Total'
                    ? centerInfo.sub
                    : centerInfo.label.length > 12
                      ? centerInfo.label.slice(0, 11) + '…'
                      : centerInfo.label}
                </SvgText>
                {centerInfo.label !== 'Total' && (
                  <SvgText
                    x={CX}
                    y={CY + 23}
                    textAnchor="middle"
                    fontSize={8}
                    fill={theme.textTertiary}
                    fontFamily="System"
                  >
                    {centerInfo.sub}
                  </SvgText>
                )}
              </>
            ) : (
              <>
                <SvgText
                  x={CX}
                  y={CY - 2}
                  textAnchor="middle"
                  fontSize={10}
                  fill={theme.textTertiary}
                  fontFamily="System"
                  fontWeight="600"
                >
                  No data
                </SvgText>
                <SvgText
                  x={CX}
                  y={CY + 12}
                  textAnchor="middle"
                  fontSize={8}
                  fill={theme.textTertiary}
                  fontFamily="System"
                  opacity={0.6}
                >
                  yet
                </SvgText>
              </>
            )}
          </Svg>
        </Animated.View>

        {/* Ring key — minimal */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl }}>
          {[
            { label: 'Inner · Subjects', opacity: isEmpty ? 0.15 : 0.9 },
            { label: 'Outer · Topics', opacity: isEmpty ? 0.15 : 0.55 },
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 10, height: 10, borderRadius: 2,
                backgroundColor: SUBJECT_PALETTE[0]!.base,
                opacity: item.opacity,
              }} />
              <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                {item.label}
              </Typography>
            </View>
          ))}
        </View>

        {/* Selected detail banner */}
        {selectedId && !isEmpty && (() => {
          const seg = segments.find((s) => s.id === selectedId);
          if (!seg) return null;
          return (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={{
                backgroundColor: seg.color + '10',
                borderWidth: 1,
                borderColor: seg.color + '25',
                borderRadius: radius.xl,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              {/* Accuracy circle */}
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: seg.color + '18',
                borderWidth: 2,
                borderColor: seg.color + '40',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography variant="h4" color={seg.color} style={{ fontSize: 15 }}>
                  {seg.accuracy}%
                </Typography>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="label" numberOfLines={1}>
                  {seg.label}
                </Typography>
                <Typography variant="caption" color={theme.textSecondary}>
                  {seg.value} answers · {seg.ring === 'inner' ? 'Subject' : 'Topic'}
                </Typography>
              </View>
              <Pressable
                onPress={() => setSelectedId(null)}
                hitSlop={12}
                style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: theme.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 11, lineHeight: 13 }}>✕</Typography>
              </Pressable>
            </Animated.View>
          );
        })()}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.3 }} />

        {/* Interactive Legend */}
        {!isEmpty ? (
          <View style={{ gap: 2 }}>
            {subjectMeta.map((subject, si) => (
              <View key={si}>
                <LegendItem
                  color={subject.color}
                  label={subject.name}
                  pct={subject.pct}
                  isSelected={
                    selectedId === `s-${si}` ||
                    (selectedId !== null && segments.find((s) => s.id === selectedId)?.subjectIndex === si)
                  }
                  onPress={() => handleLegendPress(si)}
                />
                {expandedSubject === si &&
                  subject.topics.map((t, ti) => (
                    <TopicRow
                      key={ti}
                      color={t.color}
                      label={t.name}
                      pct={t.pct}
                      isSelected={selectedId === t.id}
                      onPress={() => handleTopicLegendPress(t.id, si)}
                    />
                  ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
            <Typography variant="label" color={theme.textTertiary} align="center">
              Start studying to see your topic breakdown
            </Typography>
            <Typography variant="caption" color={theme.textTertiary} align="center">
              Answering flashcards will populate this chart with your Subject → Topic distribution
            </Typography>
          </View>
        )}
      </View>
    </Card>
  );
}
