// ─── TopicSunburstChart ──────────────────────────────────────
// Hierarchical two-ring donut chart showing:
//   Inner ring → Subjects (proportional by correct answers)
//   Outer ring → Individual topics within each subject
// Includes an animated entrance, collapsible legend, and empty state.

import { useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
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

const CENTER_R       = 38;   // center circle radius
const SUBJECT_R      = 42;   // inner ring inner edge
const SUBJECT_THICK  = 30;   // inner ring thickness
const TOPIC_R        = 76;   // outer ring inner edge  (= SUBJECT_R + SUBJECT_THICK + 4 gap)
const TOPIC_THICK    = 22;   // outer ring thickness
const GAP_RAD        = 0.025; // radian gap between segments

const SUBJECT_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B',
  '#10B981', '#8B5CF6', '#EF4444',
  '#14B8A6', '#0EA5E9',
];

// ─── Geometry Helpers ────────────────────────────────────────

function polarPoint(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function arcPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, endAngle: number,
): string {
  const s1 = polarPoint(cx, cy, outerR, startAngle);
  const e1 = polarPoint(cx, cy, outerR, endAngle);
  const s2 = polarPoint(cx, cy, innerR, endAngle);
  const e2 = polarPoint(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${s1.x} ${s1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y}`,
    'Z',
  ].join(' ');
}

// Lighten a hex color for topic segments
function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ─── Types ────────────────────────────────────────────────────

interface SegmentData {
  path: string;
  color: string;
  opacity: number;
}

interface ComputedSubject {
  subjectIndex: number;
  name: string;
  pct: number;             // % of grand total
  color: string;
  innerSeg: SegmentData;
  outerSegs: (SegmentData & { name: string; pct: number })[];
}

// ─── Ghost skeleton ──────────────────────────────────────────

const GHOST_SUBJECTS = 3;
const GHOST_TOPICS   = [3, 2, 2]; // topics per ghost subject

// ─── Legend Row ──────────────────────────────────────────────

function LegendRow({
  subject,
  isExpanded,
  onToggle,
}: {
  subject: ComputedSubject;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View>
      {/* Subject row */}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.xs,
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: subject.color,
          }}
        />
        <Typography variant="label" style={{ flex: 1 }} numberOfLines={1}>
          {subject.name}
        </Typography>
        <Typography variant="captionBold" color={subject.color}>
          {subject.pct}%
        </Typography>
        <Typography variant="caption" color={theme.textTertiary} style={{ marginLeft: 2 }}>
          {isExpanded ? '▲' : '▼'}
        </Typography>
      </TouchableOpacity>

      {/* Topic rows — shown when expanded */}
      {isExpanded &&
        subject.outerSegs.map((t, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: 3,
              paddingLeft: spacing.lg,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: t.color,
                opacity: 0.8,
              }}
            />
            <Typography variant="caption" color={theme.textSecondary} style={{ flex: 1 }} numberOfLines={1}>
              {t.name}
            </Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              {t.pct}%
            </Typography>
          </View>
        ))}
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface TopicSunburstChartProps {
  data: SubjectTopicDistribution[];
}

export function TopicSunburstChart({ data }: TopicSunburstChartProps) {
  const { theme } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const isEmpty = data.length === 0;

  // ── Compute arc geometry ──────────────────────────────────
  const { computed, grandTotal } = useMemo<{
    computed: ComputedSubject[];
    grandTotal: number;
  }>(() => {
    if (isEmpty) {
      // Ghost skeleton arcs
      const ghostSubjects = Array.from({ length: GHOST_SUBJECTS });
      const ghostShare = (2 * Math.PI) / GHOST_SUBJECTS;
      let angle = -Math.PI / 2;
      const cs: ComputedSubject[] = ghostSubjects.map((_, si) => {
        const topics = GHOST_TOPICS[si] ?? 2;
        const topicShare = (ghostShare - GAP_RAD) / topics;
        const subStart = angle + GAP_RAD / 2;
        const subEnd   = angle + ghostShare - GAP_RAD / 2;
        const color    = SUBJECT_COLORS[si % SUBJECT_COLORS.length]!;

        const outerSegs = Array.from({ length: topics }).map((_, ti) => {
          const ts = subStart + ti * topicShare;
          const te = ts + topicShare - GAP_RAD / 2;
          return {
            path:    arcPath(CX, CY, TOPIC_R, TOPIC_R + TOPIC_THICK, ts, te),
            color:   lightenHex(color, 40),
            opacity: 0.12,
            name: '',
            pct: 0,
          };
        });

        const seg: ComputedSubject = {
          subjectIndex: si,
          name: '',
          pct: 0,
          color,
          innerSeg: {
            path:    arcPath(CX, CY, SUBJECT_R, SUBJECT_R + SUBJECT_THICK, subStart, subEnd),
            color,
            opacity: 0.12,
          },
          outerSegs,
        };
        angle += ghostShare;
        return seg;
      });
      return { computed: cs, grandTotal: 0 };
    }

    const total = data.reduce((s, d) => s + d.correctAnswers, 0) || 1;
    const fullArc = 2 * Math.PI;
    let angle = -Math.PI / 2; // start at top

    const cs: ComputedSubject[] = data.map((subject, si) => {
      const color      = SUBJECT_COLORS[si % SUBJECT_COLORS.length]!;
      const subjectArc = (subject.correctAnswers / total) * fullArc;
      const subStart   = angle + GAP_RAD / 2;
      const subEnd     = angle + subjectArc - GAP_RAD / 2;

      // Outer segments — topics subdivide the subject's arc
      const topicTotal = subject.topics.reduce((s, t) => s + t.correctAnswers, 0) || 1;
      let topicAngle   = subStart;

      const outerSegs = subject.topics.map((topic, ti) => {
        const topicArc = (topic.correctAnswers / topicTotal) * (subjectArc - GAP_RAD);
        const ts = topicAngle + GAP_RAD / 2;
        const te = topicAngle + topicArc - GAP_RAD / 2;
        topicAngle += topicArc;

        // Each topic gets a progressively lighter shade of its parent color
        const lightness = 20 + ti * 18;

        return {
          path:    arcPath(CX, CY, TOPIC_R, TOPIC_R + TOPIC_THICK, ts, te),
          color:   lightenHex(color, lightness),
          opacity: 1,
          name:    topic.topicName,
          pct:     Math.round((topic.correctAnswers / total) * 100),
        };
      });

      const seg: ComputedSubject = {
        subjectIndex: si,
        name:  subject.subjectName,
        pct:   Math.round((subject.correctAnswers / total) * 100),
        color,
        innerSeg: {
          path:    arcPath(CX, CY, SUBJECT_R, SUBJECT_R + SUBJECT_THICK, subStart, subEnd),
          color,
          opacity: 1,
        },
        outerSegs,
      };

      angle += subjectArc;
      return seg;
    });

    return { computed: cs, grandTotal: total };
  }, [data, isEmpty]);

  // ── Entrance animation ────────────────────────────────────
  const svgScale   = useSharedValue(0.85);
  const svgOpacity = useSharedValue(0);

  useMemo(() => {
    svgOpacity.value = withTiming(1, { duration: 600 });
    svgScale.value   = withSpring(1, { damping: 14, stiffness: 100 });
  }, []);

  const svgAnimStyle = useAnimatedStyle(() => ({
    opacity:   svgOpacity.value,
    transform: [{ scale: svgScale.value }],
  }));

  return (
    <Card
      accessible
      accessibilityRole="summary"
      accessibilityLabel={
        isEmpty
          ? 'Topic Distribution chart. No data yet — start studying to see your breakdown.'
          : `Topic Distribution chart. ${computed.length} subjects. Top subject: ${computed[0]?.name} at ${computed[0]?.pct}%.`
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

        {/* SVG Chart */}
        <Animated.View style={[{ alignItems: 'center' }, svgAnimStyle]}>
          <Svg width={SIZE} height={SIZE}>
            {/* Ghost / real inner ring (subjects) */}
            {computed.map((s) => (
              <Path
                key={`inner-${s.subjectIndex}`}
                d={s.innerSeg.path}
                fill={s.innerSeg.color}
                fillOpacity={s.innerSeg.opacity}
                stroke={theme.card}
                strokeWidth={1.5}
              />
            ))}

            {/* Ghost / real outer ring (topics) */}
            {computed.flatMap((s) =>
              s.outerSegs.map((t, ti) => (
                <Path
                  key={`outer-${s.subjectIndex}-${ti}`}
                  d={t.path}
                  fill={t.color}
                  fillOpacity={t.opacity}
                  stroke={theme.card}
                  strokeWidth={1}
                />
              )),
            )}

            {/* Center circle */}
            <Circle
              cx={CX}
              cy={CY}
              r={CENTER_R}
              fill={theme.card}
              stroke={theme.border}
              strokeWidth={1}
            />

            {/* Center label */}
            {!isEmpty ? (
              <>
                <SvgText
                  x={CX}
                  y={CY - 6}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight="700"
                  fill={theme.text}
                  fontFamily="System"
                >
                  {grandTotal}
                </SvgText>
                <SvgText
                  x={CX}
                  y={CY + 10}
                  textAnchor="middle"
                  fontSize={9}
                  fill={theme.textTertiary}
                  fontFamily="System"
                >
                  correct
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

        {/* Ring labels */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: SUBJECT_COLORS[0], opacity: isEmpty ? 0.2 : 1 }} />
            <Typography variant="caption" color={theme.textTertiary}>Subjects</Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: lightenHex(SUBJECT_COLORS[0]!, 40), opacity: isEmpty ? 0.2 : 1 }} />
            <Typography variant="caption" color={theme.textTertiary}>Topics</Typography>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.4 }} />

        {/* Legend — real data only */}
        {!isEmpty ? (
          <View style={{ gap: 2 }}>
            {computed.map((subject, i) => (
              <LegendRow
                key={subject.subjectIndex}
                subject={subject}
                isExpanded={expandedIndex === i}
                onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
            }}
          >
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
