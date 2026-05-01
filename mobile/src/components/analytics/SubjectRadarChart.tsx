// ─── SubjectRadarChart ───────────────────────────────────────
// Premium interactive SVG spider/radar chart:
//  • Filled gradient data polygon with animated entrance
//  • N-gon concentric web rings with ring-level labels
//  • Tappable vertex dots with detail tooltip
//  • Animated subject strength bars with ranking indicators
//  • Ghost skeleton when < 3 subjects
//  • AI study recommendation insight card

import { useMemo, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import Svg, {
  Polygon,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { InsightCard } from './InsightCard';
import type { SubjectStrength } from '@kd/shared';

// ─── Constants ────────────────────────────────────────────────

const GHOST_COUNT = 5;
const RINGS = 4;
const SIZE = 300;
const SVG_W = 360;           // wider canvas so side labels don't clip
const SVG_H = SIZE;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const R_MAX = 90;
const LABEL_R = R_MAX + 34;  // push labels further from the polygon edge

const VERTEX_COLORS = [
  '#67E8F9', '#6EE7B7', '#FCD34D', '#F9A8D4',
  '#A5B4FC', '#86EFAC', '#7DD3FC', '#C4B5FD',
];

// ─── Helpers ──────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, angleIndex: number, total: number) {
  const angle = (angleIndex * 2 * Math.PI) / total - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function toPoints(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

function getGrade(score: number): { letter: string; color: string } {
  if (score >= 90) return { letter: 'A+', color: '#10B981' };
  if (score >= 80) return { letter: 'A', color: '#10B981' };
  if (score >= 70) return { letter: 'B', color: '#67E8F9' };
  if (score >= 60) return { letter: 'C', color: '#F59E0B' };
  if (score >= 50) return { letter: 'D', color: '#F97316' };
  return { letter: 'F', color: '#EF4444' };
}

// ─── Animated Bar ─────────────────────────────────────────────

function AnimatedBar({ widthPct, color, delay }: { widthPct: number; color: string; delay: number }) {
  const width = useSharedValue(0);
  useMemo(() => {
    width.value = withDelay(delay, withSpring(widthPct, { damping: 15, stiffness: 90 }));
  }, [widthPct, delay]);
  const animStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <Animated.View
      style={[{
        height: '100%',
        backgroundColor: color,
        borderRadius: 3,
      }, animStyle]}
    />
  );
}

// ─── Subject Row ──────────────────────────────────────────────

function SubjectRow({ subject, index, color, isSelected, onPress }: {
  subject: SubjectStrength;
  index: number;
  color: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const grade = getGrade(subject.strengthScore);
  return (
    <Pressable onPress={onPress}>
      <View style={{
        gap: 4,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: isSelected ? color + '12' : 'transparent',
        borderWidth: isSelected ? 1 : 0,
        borderColor: color + '30',
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <View style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: color,
              ...(isSelected && {
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 4,
                elevation: 3,
              }),
            }} />
            <Typography variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {subject.subjectName}
            </Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{
              paddingHorizontal: 6, paddingVertical: 1,
              borderRadius: radius.sm,
              backgroundColor: grade.color + '18',
            }}>
              <Typography variant="captionBold" color={grade.color} style={{ fontSize: 10 }}>
                {grade.letter}
              </Typography>
            </View>
            <Typography variant="captionBold" color={color} style={{ minWidth: 36, textAlign: 'right' }}>
              {subject.strengthScore}%
            </Typography>
          </View>
        </View>
        <View style={{
          height: 5,
          backgroundColor: theme.border + '40',
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <AnimatedBar widthPct={subject.strengthScore} color={color} delay={200 + index * 60} />
        </View>
        {isSelected && (
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10, marginTop: 2 }}>
            {subject.totalCorrect} correct out of {subject.totalAnswers} total answers
          </Typography>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface SubjectRadarChartProps {
  data: SubjectStrength[];
}

export function SubjectRadarChart({ data }: SubjectRadarChartProps) {
  const { theme } = useTheme();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Pad to minimum 3 subjects for a valid polygon
  const subjects = useMemo(() => {
    const sliced = data.slice(0, 8);
    if (sliced.length > 0 && sliced.length < 3) {
      while (sliced.length < 3) {
        sliced.push({
          subjectId: `pad-${sliced.length}`,
          subjectName: 'Pending',
          strengthScore: 0,
          totalCorrect: 0,
          totalAnswers: 0,
        });
      }
    }
    return sliced;
  }, [data]);

  const isEmpty = subjects.length === 0;

  const { weakest, strongest, avgScore } = useMemo(() => {
    if (subjects.length === 0) return { weakest: null, strongest: null, avgScore: 0 };
    const w = subjects.reduce((a, b) => (b.strengthScore < a.strengthScore ? b : a), subjects[0]!);
    const s = subjects.reduce((a, b) => (b.strengthScore > a.strengthScore ? b : a), subjects[0]!);
    const avg = Math.round(subjects.reduce((sum, sub) => sum + sub.strengthScore, 0) / subjects.length);
    return { weakest: w, strongest: s, avgScore: avg };
  }, [subjects]);

  const displaySubjects: SubjectStrength[] = isEmpty
    ? Array.from({ length: GHOST_COUNT }, (_, i) => ({
        subjectId: `ghost-${i}`,
        subjectName: '',
        strengthScore: 50,
        totalCorrect: 0,
        totalAnswers: 0,
      }))
    : subjects;

  const n = displaySubjects.length;

  // ── Geometry ──────────────────────────────────────────────
  const webRings = useMemo(
    () => Array.from({ length: RINGS }, (_, ri) => {
      const r = ((ri + 1) / RINGS) * R_MAX;
      const pts = Array.from({ length: n }, (__, i) => polar(CX, CY, r, i, n));
      return { points: toPoints(pts), r, pct: Math.round(((ri + 1) / RINGS) * 100) };
    }),
    [n],
  );

  const dataPoints = useMemo(
    () => displaySubjects.map((s, i) => {
      const r = (Math.max(s.strengthScore, 0) / 100) * R_MAX;
      return polar(CX, CY, r, i, n);
    }),
    [displaySubjects, n],
  );

  const dataPolygon = toPoints(dataPoints);

  const spokeEnds = useMemo(
    () => Array.from({ length: n }, (_, i) => polar(CX, CY, R_MAX, i, n)),
    [n],
  );

  const labelPositions = useMemo(
    () => displaySubjects.map((s, i) => {
      const pos = polar(CX, CY, LABEL_R, i, n);
      return { ...pos, name: s.subjectName, score: s.strengthScore };
    }),
    [displaySubjects, n],
  );

  // ── Entrance animation ────────────────────────────────────
  const svgScale = useSharedValue(0.85);
  const svgOpacity = useSharedValue(0);
  useMemo(() => {
    svgOpacity.value = withTiming(1, { duration: 500 });
    svgScale.value = withSpring(1, { damping: 14, stiffness: 100 });
  }, []);
  const svgAnimStyle = useAnimatedStyle(() => ({
    opacity: svgOpacity.value,
    transform: [{ scale: svgScale.value }],
  }));

  // ── Tap handler ───────────────────────────────────────────
  const handleVertexPress = useCallback((idx: number) => {
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  // ── Opacities ─────────────────────────────────────────────
  const fillOpacity = isEmpty ? 0.08 : 0.4;
  const strokeOpacity = isEmpty ? 0.15 : 0.85;
  const webOpacity = isEmpty ? 0.1 : 0.25;
  const spokeOpacity = isEmpty ? 0.08 : 0.18;

  const selectedSubject = selectedIdx !== null ? subjects[selectedIdx] : null;

  return (
    <View style={{ gap: spacing.md }}>
      <Card
        accessible
        accessibilityRole="summary"
        accessibilityLabel={
          isEmpty
            ? 'Subject Mastery Radar Chart. No data available yet.'
            : `Subject Mastery Radar Chart. Strongest: ${strongest?.subjectName}. Weakest: ${weakest?.subjectName}.`
        }
      >
        <View style={{ gap: spacing.md }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4">Subject Mastery Radar</Typography>
            {!isEmpty && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: '#0EA5E9' + '18',
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
                borderRadius: radius.full,
              }}>
                <Typography variant="captionBold" color="#0EA5E9" style={{ fontSize: 11 }}>
                  Avg {avgScore}%
                </Typography>
              </View>
            )}
          </View>

          {/* SVG Radar */}
          <Animated.View style={[{ alignItems: 'center' }, svgAnimStyle]}>
            <Svg width={SVG_W} height={SVG_H}>
              <Defs>
                <LinearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#67E8F9" stopOpacity={fillOpacity} />
                  <Stop offset="100%" stopColor="#2563EB" stopOpacity={fillOpacity * 0.6} />
                </LinearGradient>
                <LinearGradient id="radarStroke" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#7DD3FC" stopOpacity={strokeOpacity} />
                  <Stop offset="100%" stopColor="#3B82F6" stopOpacity={strokeOpacity} />
                </LinearGradient>
              </Defs>

              {/* Web rings + ring % labels */}
              {webRings.map((ring, ri) => (
                <G key={`ring-${ri}`}>
                  <Polygon
                    points={ring.points}
                    fill="none"
                    stroke={theme.border}
                    strokeWidth={1}
                    strokeOpacity={webOpacity + ri * 0.06}
                  />
                  {/* Ring percentage label on the first spoke */}
                  {!isEmpty && (
                    <SvgText
                      x={CX + 4}
                      y={CY - ring.r + 1}
                      fontSize={8}
                      fill={theme.textTertiary}
                      fillOpacity={0.6}
                      textAnchor="start"
                      fontFamily="System"
                    >
                      {ring.pct}
                    </SvgText>
                  )}
                </G>
              ))}

              {/* Spokes */}
              {spokeEnds.map((pt, i) => (
                <Line
                  key={`spoke-${i}`}
                  x1={CX} y1={CY}
                  x2={pt.x} y2={pt.y}
                  stroke={theme.border}
                  strokeWidth={1}
                  strokeOpacity={spokeOpacity}
                  strokeDasharray="4 4"
                />
              ))}

              {/* Data polygon */}
              <Polygon
                points={dataPolygon}
                fill="url(#radarFill)"
                stroke="url(#radarStroke)"
                strokeWidth={isEmpty ? 1 : 2.5}
              />

              {/* Vertex dots — tappable */}
              {!isEmpty && dataPoints.map((pt, i) => {
                const isSelected = selectedIdx === i;
                const color = VERTEX_COLORS[i % VERTEX_COLORS.length]!;
                const dimmed = selectedIdx !== null && !isSelected;
                return (
                  <G key={`dot-${i}`}>
                    {/* Glow ring */}
                    {isSelected && (
                      <Circle
                        cx={pt.x} cy={pt.y} r={14}
                        fill={color}
                        fillOpacity={0.15}
                        stroke={color}
                        strokeWidth={1}
                        strokeOpacity={0.3}
                      />
                    )}
                    <Circle
                      cx={pt.x} cy={pt.y}
                      r={isSelected ? 6 : 4}
                      fill={color}
                      fillOpacity={dimmed ? 0.3 : 1}
                      stroke={theme.card}
                      strokeWidth={1.5}
                      onPress={() => handleVertexPress(i)}
                    />
                  </G>
                );
              })}

              {/* Perimeter labels */}
              {!isEmpty && labelPositions.map((lp, i) => {
                const textAnchor = lp.x < CX - 8 ? 'end' : lp.x > CX + 8 ? 'start' : 'middle';
                const isSelected = selectedIdx === i;
                const color = VERTEX_COLORS[i % VERTEX_COLORS.length]!;
                const dimmed = selectedIdx !== null && !isSelected;
                return (
                  <G key={`lbl-${i}`} opacity={dimmed ? 0.35 : 1}>
                    <SvgText
                      x={lp.x} y={lp.y - 5}
                      fontSize={11}
                      fill={isSelected ? theme.text : theme.textSecondary}
                      fontWeight={isSelected ? '700' : '500'}
                      textAnchor={textAnchor}
                      fontFamily="System"
                    >
                      {lp.name}
                    </SvgText>
                    <SvgText
                      x={lp.x} y={lp.y + 9}
                      fontSize={12}
                      fontWeight="700"
                      fill={color}
                      textAnchor={textAnchor}
                      fontFamily="System"
                    >
                      {lp.score}%
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </Animated.View>

          {/* Selected Subject Detail Tooltip */}
          {selectedSubject && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={{
                backgroundColor: VERTEX_COLORS[selectedIdx! % VERTEX_COLORS.length]! + '12',
                borderWidth: 1,
                borderColor: VERTEX_COLORS[selectedIdx! % VERTEX_COLORS.length]! + '30',
                borderRadius: radius.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: VERTEX_COLORS[selectedIdx! % VERTEX_COLORS.length]! + '22',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography variant="h3" color={VERTEX_COLORS[selectedIdx! % VERTEX_COLORS.length]!}>
                  {getGrade(selectedSubject.strengthScore).letter}
                </Typography>
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label" numberOfLines={1}>
                  {selectedSubject.subjectName}
                </Typography>
                <Typography variant="caption" color={theme.textSecondary}>
                  {selectedSubject.strengthScore}% mastery · {selectedSubject.totalCorrect}/{selectedSubject.totalAnswers} correct
                </Typography>
              </View>
              <Pressable onPress={() => setSelectedIdx(null)} hitSlop={12}>
                <Typography variant="caption" color={theme.textTertiary}>✕</Typography>
              </Pressable>
            </Animated.View>
          )}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.4 }} />

          {/* Subject Bars */}
          {!isEmpty ? (
            <View style={{ gap: 2 }}>
              {subjects.map((subject, i) => (
                <SubjectRow
                  key={subject.subjectId}
                  subject={subject}
                  index={i}
                  color={VERTEX_COLORS[i % VERTEX_COLORS.length]!}
                  isSelected={selectedIdx === i}
                  onPress={() => handleVertexPress(i)}
                />
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
              <Typography variant="label" color={theme.textTertiary} align="center">
                Study across subjects to build your radar
              </Typography>
              <Typography variant="caption" color={theme.textTertiary} align="center">
                Each subject you practice will appear as an axis on the radar chart
              </Typography>
            </View>
          )}
        </View>
      </Card>

      {/* AI Insight */}
      {!isEmpty && weakest && strongest && weakest.subjectId !== strongest.subjectId && (
        <InsightCard
          icon="🧠"
          title="AI Study Recommendation"
          body={`Your strongest area is ${strongest.subjectName} (${strongest.strengthScore}%). Focus more on ${weakest.subjectName} (${weakest.strengthScore}%) — try reviewing flashcards at a slower pace and re-attempting missed questions.`}
          accentColor="#8B5CF6"
          delay={600}
        />
      )}
    </View>
  );
}
