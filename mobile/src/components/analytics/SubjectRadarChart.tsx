// ─── SubjectRadarChart ───────────────────────────────────────
// Premium SVG spider/radar chart matching the reference design:
//  • Filled gradient data polygon
//  • N-gon concentric web rings (not circles)
//  • Axis spokes
//  • Dual-line perimeter labels: subject name + percentage
//  • Ghost skeleton when < 3 subjects

import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, {
  Polygon,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { InsightCard } from './InsightCard';
import type { SubjectStrength } from '@kd/shared';

// ─── Helpers ──────────────────────────────────────────────────

/** Convert polar coords to cartesian. Angle 0 = top (–π/2 offset). */
function polar(cx: number, cy: number, r: number, angleIndex: number, total: number) {
  const angle = (angleIndex * 2 * Math.PI) / total - Math.PI / 2;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/** Build a points string for <Polygon> from an array of {x,y}. */
function toPoints(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

// ─── Constants ────────────────────────────────────────────────

const GHOST_COUNT = 6;
const RINGS = 4;
const SIZE = 260;          // SVG canvas size (square)
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_MAX = 90;          // max spoke radius — leaves room for labels
const LABEL_R = R_MAX + 22; // label anchor radius

// ─── Component ───────────────────────────────────────────────

interface SubjectRadarChartProps {
  data: SubjectStrength[];
}

export function SubjectRadarChart({ data }: SubjectRadarChartProps) {
  const { theme } = useTheme();

  const subjects = useMemo(() => data.slice(0, 8), [data]);
  const isEmpty = subjects.length < 3;

  const weakest = useMemo(
    () =>
      subjects.length > 0
        ? subjects.reduce((w, s) => (s.strengthScore < w.strengthScore ? s : w), subjects[0]!)
        : null,
    [subjects],
  );

  const strongest = useMemo(
    () =>
      subjects.length > 0
        ? subjects.reduce((s, cur) => (cur.strengthScore > s.strengthScore ? cur : s), subjects[0]!)
        : null,
    [subjects],
  );

  // When empty, render a ghost skeleton with dummy axes
  const displaySubjects: SubjectStrength[] = isEmpty
    ? Array.from({ length: GHOST_COUNT }, (_, i) => ({
        subjectId: `ghost-${i}`,
        subjectName: '',
        strengthScore: 55,   // mid-range so rings look plausible
        totalCorrect: 0,
        totalAnswers: 0,
      }))
    : subjects;

  const n = displaySubjects.length;

  // ── Geometry ──────────────────────────────────────────────
  const webRings = useMemo(
    () =>
      Array.from({ length: RINGS }, (_, ri) => {
        const r = ((ri + 1) / RINGS) * R_MAX;
        const pts = Array.from({ length: n }, (__, i) => polar(CX, CY, r, i, n));
        return toPoints(pts);
      }),
    [n],
  );

  const dataPoints = useMemo(
    () =>
      displaySubjects.map((s, i) => {
        const r = (Math.max(s.strengthScore, 0) / 100) * R_MAX;
        return polar(CX, CY, r, i, n);
      }),
    [displaySubjects, n],
  );

  const dataPolygon = toPoints(dataPoints);

  const labelPositions = useMemo(
    () =>
      displaySubjects.map((s, i) => {
        const pos = polar(CX, CY, LABEL_R, i, n);
        return { ...pos, name: s.subjectName, score: s.strengthScore };
      }),
    [displaySubjects, n],
  );

  const spokePoints = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => polar(CX, CY, R_MAX, i, n)),
    [n],
  );

  // ── Colors ───────────────────────────────────────────────
  const fillOpacity  = isEmpty ? 0.12 : 0.45;
  const strokeOpacity = isEmpty ? 0.2 : 1;
  const webOpacity   = isEmpty ? 0.15 : 0.35;
  const spokeOpacity = isEmpty ? 0.1 : 0.25;

  return (
    <View style={{ gap: spacing.md }}>
      <Card
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={
          isEmpty
            ? 'Subject Mastery Radar Chart. No data available yet.'
            : `Subject Mastery Radar Chart. Strongest subject: ${strongest?.subjectName}. Weakest subject: ${weakest?.subjectName}.`
        }
      >
        <View style={{ gap: spacing.md }}>
          <Typography variant="h4">Subject Mastery Radar</Typography>

          {/* ── SVG Radar ── */}
          <View style={{ alignItems: 'center' }}>
            <Svg width={SIZE} height={SIZE}>
              <Defs>
                {/* Gradient fill: cyan → deep blue matching the reference */}
                <LinearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#67E8F9" stopOpacity={fillOpacity} />
                  <Stop offset="100%" stopColor="#2563EB" stopOpacity={fillOpacity * 0.7} />
                </LinearGradient>
                {/* Gradient for the border stroke */}
                <LinearGradient id="radarStroke" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#7DD3FC" stopOpacity={strokeOpacity} />
                  <Stop offset="100%" stopColor="#3B82F6" stopOpacity={strokeOpacity} />
                </LinearGradient>
              </Defs>

              {/* ── Web rings (N-gons) ── */}
              {webRings.map((pts, ri) => (
                <Polygon
                  key={`ring-${ri}`}
                  points={pts}
                  fill="none"
                  stroke={theme.border}
                  strokeWidth={1}
                  strokeOpacity={webOpacity + ri * 0.05}
                />
              ))}

              {/* ── Axis spokes ── */}
              {spokePoints.map((pt, i) => (
                <Line
                  key={`spoke-${i}`}
                  x1={CX}
                  y1={CY}
                  x2={pt.x}
                  y2={pt.y}
                  stroke={theme.border}
                  strokeWidth={1}
                  strokeOpacity={spokeOpacity}
                />
              ))}

              {/* ── Filled data polygon ── */}
              <Polygon
                points={dataPolygon}
                fill="url(#radarFill)"
                stroke="#67E8F9"
                strokeWidth={isEmpty ? 1 : 2}
                strokeOpacity={isEmpty ? 0.2 : 0.85}
              />

              {/* ── Perimeter labels: name + % ── */}
              {!isEmpty &&
                labelPositions.map((lp, i) => {
                  // Anchor alignment based on position relative to center
                  const textAnchor =
                    lp.x < CX - 8 ? 'end' : lp.x > CX + 8 ? 'start' : 'middle';
                  return (
                    <SvgText key={`lbl-${i}`}>
                      {/* Subject name */}
                      <SvgText
                        x={lp.x}
                        y={lp.y - 5}
                        fontSize={9}
                        fill={theme.textSecondary}
                        textAnchor={textAnchor}
                        fontFamily="System"
                      >
                        {lp.name}
                      </SvgText>
                      {/* Percentage — bold + cyan */}
                      <SvgText
                        x={lp.x}
                        y={lp.y + 8}
                        fontSize={11}
                        fontWeight="700"
                        fill="#7DD3FC"
                        textAnchor={textAnchor}
                        fontFamily="System"
                      >
                        {lp.score}%
                      </SvgText>
                    </SvgText>
                  );
                })}
            </Svg>
          </View>

          {/* ── Subject strength bars (real data only) ── */}
          {!isEmpty && (
            <View style={{ gap: spacing.sm }}>
              {subjects.map((subject, i) => {
                const barColors = [
                  '#67E8F9', '#7DD3FC', '#93C5FD', '#6EE7B7',
                  '#A5B4FC', '#FCD34D', '#F9A8D4', '#86EFAC',
                ];
                const color = barColors[i % barColors.length]!;
                return (
                  <View key={subject.subjectId} style={{ gap: 3 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Typography
                        variant="caption"
                        color={theme.textSecondary}
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        {subject.subjectName}
                      </Typography>
                      <Typography variant="caption" color={color}>
                        {subject.strengthScore}%
                      </Typography>
                    </View>
                    <View
                      style={{
                        height: 4,
                        backgroundColor: theme.border,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${subject.strengthScore}%`,
                          backgroundColor: color,
                          borderRadius: 2,
                          opacity: 0.85,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Card>

      {/* ── AI insight (real data only) ── */}
      {!isEmpty && weakest && strongest && weakest.subjectId !== strongest.subjectId && (
        <InsightCard
          icon="🧠"
          title="AI Study Recommendation"
          body={`Your strongest area is ${strongest.subjectName} (${strongest.strengthScore}%). Focus more on ${weakest.subjectName} (${weakest.strengthScore}%) — try reviewing flashcards at a slower pace and re-attempting missed questions.`}
          accentColor="#8B5CF6"
          delay={400}
        />
      )}
    </View>
  );
}
