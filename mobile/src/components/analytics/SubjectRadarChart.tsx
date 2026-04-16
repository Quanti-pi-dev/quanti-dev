// ─── SubjectRadarChart ───────────────────────────────────────
// Spider/radar chart showing subject strength scores as a filled
// polygon over labeled axes. Pure RN implementation (no SVG dep).

import { useMemo } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { InsightCard } from './InsightCard';
import type { SubjectStrength } from '@kd/shared';

const STRENGTH_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6', '#14B8A6', '#EF4444', '#3B82F6'];

interface SubjectRadarChartProps {
  data: SubjectStrength[];
}

export function SubjectRadarChart({ data }: SubjectRadarChartProps) {
  const { theme } = useTheme();

  // Take top 8 subjects max (radar gets messy beyond that)
  const subjects = useMemo(() => data.slice(0, 8), [data]);

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

  if (subjects.length < 3) {
    return (
      <Card>
        <View style={{ gap: spacing.md }}>
          <Typography variant="h4">Subject Mastery Radar</Typography>
          <Typography variant="body" color={theme.textTertiary} align="center">
            Study at least 3 subjects to see your mastery radar
          </Typography>
        </View>
      </Card>
    );
  }

  const SIZE = 200;
  const CENTER = SIZE / 2;
  const RADIUS_MAX = SIZE / 2 - 30; // leave space for labels
  const RINGS = 4;

  // Calculate polygon vertices based on strength scores
  const n = subjects.length;
  const angleStep = (2 * Math.PI) / n;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <View style={{ gap: spacing.md }}>
          <Typography variant="h4">Subject Mastery Radar</Typography>

          {/* Radar visualization */}
          <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
            <View style={{ width: SIZE, height: SIZE, position: 'relative' }}>
              {/* Concentric rings (background) */}
              {Array.from({ length: RINGS }, (_, ri) => {
                const ringR = ((ri + 1) / RINGS) * RADIUS_MAX;
                return (
                  <View
                    key={ri}
                    style={{
                      position: 'absolute',
                      left: CENTER - ringR,
                      top: CENTER - ringR,
                      width: ringR * 2,
                      height: ringR * 2,
                      borderRadius: ringR,
                      borderWidth: 1,
                      borderColor: theme.border,
                      opacity: ri === RINGS - 1 ? 0.5 : 0.25,
                    }}
                  />
                );
              })}

              {/* Axis lines from center to each vertex */}
              {subjects.map((_, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const endX = CENTER + RADIUS_MAX * Math.cos(angle);
                const endY = CENTER + RADIUS_MAX * Math.sin(angle);
                const dx = endX - CENTER;
                const dy = endY - CENTER;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

                return (
                  <View
                    key={`axis-${i}`}
                    style={{
                      position: 'absolute',
                      left: CENTER,
                      top: CENTER,
                      width: len,
                      height: 1,
                      backgroundColor: theme.border,
                      opacity: 0.4,
                      transformOrigin: 'left center',
                      transform: [{ rotate: `${angleDeg}deg` }],
                    }}
                  />
                );
              })}

              {/* Data points and connections */}
              {subjects.map((subject, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const r = (subject.strengthScore / 100) * RADIUS_MAX;
                const x = CENTER + r * Math.cos(angle);
                const y = CENTER + r * Math.sin(angle);
                const color = STRENGTH_COLORS[i % STRENGTH_COLORS.length]!;

                // Connection line to next point
                const nextI = (i + 1) % n;
                const nextAngle = nextI * angleStep - Math.PI / 2;
                const nextR = (subjects[nextI]!.strengthScore / 100) * RADIUS_MAX;
                const nextX = CENTER + nextR * Math.cos(nextAngle);
                const nextY = CENTER + nextR * Math.sin(nextAngle);

                const lineDx = nextX - x;
                const lineDy = nextY - y;
                const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
                const lineAngle = Math.atan2(lineDy, lineDx) * (180 / Math.PI);

                return (
                  <View key={`dot-${i}`}>
                    {/* Connection line */}
                    <View
                      style={{
                        position: 'absolute',
                        left: x,
                        top: y,
                        width: lineLen,
                        height: 2,
                        backgroundColor: theme.primary,
                        opacity: 0.6,
                        transformOrigin: 'left center',
                        transform: [{ rotate: `${lineAngle}deg` }],
                      }}
                    />
                    {/* Data dot */}
                    <View
                      style={{
                        position: 'absolute',
                        left: x - 5,
                        top: y - 5,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: color,
                        borderWidth: 2,
                        borderColor: theme.card,
                      }}
                    />
                  </View>
                );
              })}

              {/* Subject labels around the perimeter */}
              {subjects.map((subject, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const labelR = RADIUS_MAX + 18;
                const x = CENTER + labelR * Math.cos(angle);
                const y = CENTER + labelR * Math.sin(angle);

                return (
                  <Typography
                    key={`label-${i}`}
                    variant="caption"
                    color={theme.textSecondary}
                    align="center"
                    numberOfLines={1}
                    style={{
                      position: 'absolute',
                      left: x - 30,
                      top: y - 7,
                      width: 60,
                      fontSize: 8,
                    }}
                  >
                    {subject.subjectName}
                  </Typography>
                );
              })}
            </View>
          </View>

          {/* Subject strength bars */}
          <View style={{ gap: spacing.sm }}>
            {subjects.map((subject, i) => {
              const color = STRENGTH_COLORS[i % STRENGTH_COLORS.length]!;
              return (
                <View key={subject.subjectId} style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color={theme.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
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
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Card>

      {/* AI-powered insight */}
      {weakest && strongest && weakest.subjectId !== strongest.subjectId && (
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
