// ─── TopicSunburstChart ──────────────────────────────────────
// Interactive hierarchical sunburst chart inspired by disk-usage
// visualizers (Baobab). Features:
//   • Inner ring → Subjects (proportional by correct answers)
//   • Outer ring → Topics within each subject
//   • Tap any segment to select it and see details
//   • Center label updates with the selected item
//   • Animated entrance with spring physics
//   • Ghost skeleton for empty state

import { useMemo, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
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

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;

const CENTER_R = 44;
const INNER_R = 50;
const INNER_THICK = 38;
const OUTER_R = INNER_R + INNER_THICK + 3;
const OUTER_THICK = 28;
const GAP_RAD = 0.02;
const MIN_ARC = 0.04; // minimum arc radians for tiny segments

const SUBJECT_COLORS = [
  '#EF4444', '#F59E0B', '#10B981',
  '#6366F1', '#EC4899', '#8B5CF6',
  '#14B8A6', '#0EA5E9',
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

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function darkenColor(hex: string, amount: number): string {
  return adjustColor(hex, -amount);
}

// ─── Types ────────────────────────────────────────────────────

interface SegmentInfo {
  id: string;
  path: string;
  color: string;
  highlightColor: string;
  ring: 'inner' | 'outer';
  subjectIndex: number;
  topicIndex: number; // -1 for subject
  label: string;
  value: number;
  total: number;
  pct: number;
  accuracy: number; // percentage
}

interface CenterInfo {
  label: string;
  value: number;
  sub: string;
}

// ─── Ghost Data ──────────────────────────────────────────────

const GHOST_SUBJECTS = 4;
const GHOST_TOPICS = [3, 2, 3, 2];

// ─── Legend Dot ──────────────────────────────────────────────

function LegendDot({ color, label, pct, isSelected, onPress }: {
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
        paddingVertical: 5,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: isSelected ? color + '18' : 'transparent',
      }}
    >
      <View style={{
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: color,
        ...(isSelected && {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 4,
          elevation: 3,
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
      <Typography variant="captionBold" color={color}>
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
        paddingVertical: 3,
        paddingLeft: spacing.xl,
        paddingRight: spacing.sm,
        borderRadius: radius.sm,
        backgroundColor: isSelected ? color + '15' : 'transparent',
      }}
    >
      <View style={{
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: color, opacity: 0.85,
      }} />
      <Typography
        variant="caption"
        color={isSelected ? theme.text : theme.textSecondary}
        style={{ flex: 1 }}
        numberOfLines={1}
      >
        {label}
      </Typography>
      <Typography variant="caption" color={theme.textTertiary}>
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
      // Ghost skeleton
      const ghostShare = (2 * Math.PI) / GHOST_SUBJECTS;
      let angle = -Math.PI / 2;
      for (let si = 0; si < GHOST_SUBJECTS; si++) {
        const color = SUBJECT_COLORS[si % SUBJECT_COLORS.length]!;
        const subStart = angle + GAP_RAD / 2;
        const subEnd = angle + ghostShare - GAP_RAD / 2;
        segs.push({
          id: `ghost-inner-${si}`,
          path: arcPath(CX, CY, INNER_R, INNER_R + INNER_THICK, subStart, subEnd),
          color, highlightColor: color, ring: 'inner',
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
            color: adjustColor(color, 50),
            highlightColor: adjustColor(color, 50),
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

    const grandTotal = data.reduce((s, d) => s + d.correctAnswers, 0) || 1;
    const fullArc = 2 * Math.PI;
    let angle = -Math.PI / 2;

    data.forEach((subject, si) => {
      const color = SUBJECT_COLORS[si % SUBJECT_COLORS.length]!;
      const subjectArc = Math.max(MIN_ARC, (subject.correctAnswers / grandTotal) * fullArc);
      const subStart = angle + GAP_RAD / 2;
      const subEnd = angle + subjectArc - GAP_RAD / 2;
      const subjectPct = Math.round((subject.correctAnswers / grandTotal) * 100);
      const subjectAcc = subject.totalAnswers > 0
        ? Math.round((subject.correctAnswers / subject.totalAnswers) * 100)
        : 0;

      // Inner ring — subject
      if (subEnd > subStart) {
        segs.push({
          id: `s-${si}`,
          path: arcPath(CX, CY, INNER_R, INNER_R + INNER_THICK, subStart, subEnd),
          color,
          highlightColor: adjustColor(color, 25),
          ring: 'inner',
          subjectIndex: si,
          topicIndex: -1,
          label: subject.subjectName,
          value: subject.correctAnswers,
          total: subject.totalAnswers,
          pct: subjectPct,
          accuracy: subjectAcc,
        });
      }

      // Outer ring — topics
      const topicTotal = subject.topics.reduce((s, t) => s + t.correctAnswers, 0) || 1;
      let topicAngle = subStart;
      const usableArc = subjectArc - GAP_RAD;
      const topicMetas: typeof meta[0]['topics'] = [];

      subject.topics.forEach((topic, ti) => {
        const topicArc = Math.max(
          MIN_ARC * 0.5,
          (topic.correctAnswers / topicTotal) * usableArc,
        );
        const ts = topicAngle + GAP_RAD / 3;
        const te = topicAngle + topicArc - GAP_RAD / 3;
        topicAngle += topicArc;

        // Progressive lighter shade for each topic
        const shade = 30 + ti * 22;
        const topicColor = adjustColor(color, shade);
        const topicPct = Math.round((topic.correctAnswers / grandTotal) * 100);
        const topicAcc = topic.totalAnswers > 0
          ? Math.round((topic.correctAnswers / topic.totalAnswers) * 100)
          : 0;
        const id = `t-${si}-${ti}`;

        if (te > ts) {
          segs.push({
            id,
            path: arcPath(CX, CY, OUTER_R, OUTER_R + OUTER_THICK, ts, te),
            color: topicColor,
            highlightColor: adjustColor(topicColor, 20),
            ring: 'outer',
            subjectIndex: si,
            topicIndex: ti,
            label: topic.topicName,
            value: topic.correctAnswers,
            total: topic.totalAnswers,
            pct: topicPct,
            accuracy: topicAcc,
          });
        }

        topicMetas.push({ name: topic.topicName, color: topicColor, pct: topicPct, id });
      });

      meta.push({
        name: subject.subjectName,
        color,
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
        sub: 'correct',
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
      value: seg.value,
      sub: `${seg.accuracy}% acc`,
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
  const svgScale = useSharedValue(0.82);
  const svgOpacity = useSharedValue(0);

  useMemo(() => {
    svgOpacity.value = withTiming(1, { duration: 500 });
    svgScale.value = withSpring(1, { damping: 16, stiffness: 110 });
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
      <View style={{ gap: spacing.md }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Topic Distribution</Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            By correct answers
          </Typography>
        </View>

        {/* SVG Sunburst */}
        <Animated.View style={[{ alignItems: 'center' }, svgAnimStyle]}>
          <Svg width={SIZE} height={SIZE}>
            {/* Render all segments */}
            {segments.map((seg) => {
              const isSelected = selectedId === seg.id;
              // Highlight sibling segments when a subject is selected
              const selectedSeg = selectedId ? segments.find((s) => s.id === selectedId) : null;
              const isSiblingHighlight = selectedSeg
                ? seg.subjectIndex === selectedSeg.subjectIndex
                : false;

              const opacity = isEmpty
                ? 0.12
                : selectedId === null
                  ? 1
                  : isSelected
                    ? 1
                    : isSiblingHighlight
                      ? 0.75
                      : 0.25;

              return (
                <Path
                  key={seg.id}
                  d={seg.path}
                  fill={isSelected ? seg.highlightColor : seg.color}
                  fillOpacity={opacity}
                  stroke={isSelected ? seg.highlightColor : theme.card}
                  strokeWidth={isSelected ? 2 : 1.2}
                  onPress={() => handleSegmentPress(seg.id, seg.subjectIndex)}
                />
              );
            })}

            {/* Center circle */}
            <Circle
              cx={CX}
              cy={CY}
              r={CENTER_R}
              fill={theme.card}
              stroke={theme.border}
              strokeWidth={1}
            />

            {/* Center text */}
            {!isEmpty ? (
              <>
                <SvgText
                  x={CX}
                  y={CY - 8}
                  textAnchor="middle"
                  fontSize={centerInfo.label === 'Total' ? 22 : 13}
                  fontWeight="700"
                  fill={theme.text}
                  fontFamily="System"
                >
                  {centerInfo.label === 'Total'
                    ? centerInfo.value
                    : centerInfo.value}
                </SvgText>
                {centerInfo.label !== 'Total' && (
                  <SvgText
                    x={CX}
                    y={CY + 5}
                    textAnchor="middle"
                    fontSize={9}
                    fill={theme.textSecondary}
                    fontFamily="System"
                  >
                    {centerInfo.label.length > 14
                      ? centerInfo.label.slice(0, 13) + '…'
                      : centerInfo.label}
                  </SvgText>
                )}
                <SvgText
                  x={CX}
                  y={centerInfo.label === 'Total' ? CY + 10 : CY + 17}
                  textAnchor="middle"
                  fontSize={9}
                  fill={theme.textTertiary}
                  fontFamily="System"
                >
                  {centerInfo.sub}
                </SvgText>
              </>
            ) : (
              <SvgText
                x={CX}
                y={CY + 4}
                textAnchor="middle"
                fontSize={10}
                fill={theme.textTertiary}
                fontFamily="System"
              >
                No data
              </SvgText>
            )}
          </Svg>
        </Animated.View>

        {/* Ring key labels */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{
              width: 12, height: 12, borderRadius: 2,
              backgroundColor: SUBJECT_COLORS[0],
              opacity: isEmpty ? 0.2 : 1,
            }} />
            <Typography variant="caption" color={theme.textTertiary}>Subjects</Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{
              width: 12, height: 12, borderRadius: 2,
              backgroundColor: adjustColor(SUBJECT_COLORS[0]!, 50),
              opacity: isEmpty ? 0.2 : 1,
            }} />
            <Typography variant="caption" color={theme.textTertiary}>Topics</Typography>
          </View>
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
                backgroundColor: seg.color + '14',
                borderWidth: 1,
                borderColor: seg.color + '30',
                borderRadius: radius.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: seg.color + '25',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography variant="h4" color={seg.color}>
                  {seg.pct}%
                </Typography>
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label" numberOfLines={1}>
                  {seg.label}
                </Typography>
                <Typography variant="caption" color={theme.textSecondary}>
                  {seg.value} / {seg.total} answers · {seg.accuracy}% accuracy
                </Typography>
              </View>
              <Pressable
                onPress={() => setSelectedId(null)}
                hitSlop={12}
              >
                <Typography variant="caption" color={theme.textTertiary}>✕</Typography>
              </Pressable>
            </Animated.View>
          );
        })()}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.4 }} />

        {/* Interactive Legend */}
        {!isEmpty ? (
          <View style={{ gap: 2 }}>
            {subjectMeta.map((subject, si) => (
              <View key={si}>
                <LegendDot
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
