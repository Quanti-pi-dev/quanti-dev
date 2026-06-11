// ─── ExamReadinessScore ──────────────────────────────────────
// Prominent readiness score with animated ring, mastery level label,
// strong/weak areas breakdown, bottleneck callout, and forecasting text.

import { useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  FadeInDown,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import type { ExamReadiness } from '@kd/shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Mastery Level Labels ────────────────────────────────────

function getMasteryLabel(score: number): { label: string; sublabel: string; color: string } {
  if (score >= 85) return { label: 'Master',     sublabel: 'You own this material',     color: '#6366F1' };
  if (score >= 60) return { label: 'Proficient',  sublabel: 'Solid foundation built',    color: '#10B981' };
  if (score >= 40) return { label: 'Developing',  sublabel: 'Building understanding',    color: '#F59E0B' };
  return               { label: 'Emerging',    sublabel: 'Your journey is starting', color: '#F97316' };
}

// ─── Bottleneck Computation ──────────────────────────────────

/**
 * For each weak concept, estimate how many overall-score points are being
 * lost due to low mastery.
 *
 * Formula:
 *   Concept Mastery component = 35% of overall score
 *   If there are N weak concepts, each represents ≈ 35/N pts of maximum.
 *   The student currently recovers  (pMastery × 35/N) of those points.
 *   Points being lost = (1 - pMastery) × (35 / N)
 *
 * We cap individual impact at 15 pts to keep the UI honest.
 */
function computeBottlenecks(
  weakConcepts: ExamReadiness['weakConcepts'],
): Array<{ concept: string; tag: string; topicSlug: string; subjectId: string; examId?: string; subjectName: string; pMastery: number; pointsCost: number }> {
  if (!weakConcepts || weakConcepts.length === 0) return [];
  const share = 35 / weakConcepts.length;
  return weakConcepts
    .map((wc) => ({
      ...wc,
      pointsCost: Math.min(15, Math.round((1 - wc.pMastery) * share)),
    }))
    .filter((wc) => wc.pointsCost > 0)
    .sort((a, b) => b.pointsCost - a.pointsCost);
}

// ─── Animated Ring ───────────────────────────────────────────

function ReadinessRing({ score }: { score: number }) {
  const { theme } = useTheme();
  const size = 140;
  const strokeWidth = 10;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(score / 100, 1), {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const mastery = getMasteryLabel(score);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={mastery.color} stopOpacity="1" />
            <Stop offset="1" stopColor={mastery.color} stopOpacity="0.6" />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.border + '30'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center content */}
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Typography variant="h2" color={mastery.color} style={{ fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
          {score}
        </Typography>
        <View
          style={{
            backgroundColor: mastery.color + '15',
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            marginTop: -2,
          }}
        >
          <Typography variant="captionBold" color={mastery.color} style={{ fontSize: 9, letterSpacing: 0.5 }}>
            {mastery.label.toUpperCase()}
          </Typography>
        </View>
      </View>
    </View>
  );
}

// ─── Area Chips ──────────────────────────────────────────────

function AreaChips({
  areas, color, icon, label,
}: {
  areas: string[];
  color: string;
  icon: string;
  label: string;
}) {
  const { theme } = useTheme();
  if (areas.length === 0) return null;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Typography style={{ fontSize: 12 }}>{icon}</Typography>
        <Typography variant="captionBold" color={theme.textTertiary} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {areas.map((area) => (
          <View
            key={area}
            style={{
              backgroundColor: color + '10',
              borderRadius: radius.full,
              paddingHorizontal: spacing.md,
              paddingVertical: 5,
              borderWidth: 1,
              borderColor: color + '20',
            }}
          >
            <Typography variant="caption" color={color} style={{ fontSize: 11 }}>
              {area}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Bottleneck Callout ───────────────────────────────────────

/**
 * Surfaces the single biggest score bottleneck and a ranked list of all
 * weak concepts with their estimated point drag. Tapping a concept
 * navigates directly to a study session for it.
 */
function BottleneckCallout({
  bottlenecks,
  overallScore,
}: {
  bottlenecks: ReturnType<typeof computeBottlenecks>;
  overallScore: number;
}) {
  const { theme } = useTheme();
  const router = useRouter();

  if (bottlenecks.length === 0) return null;

  const top = bottlenecks[0]!;
  const unlocked = Math.min(100, overallScore + top.pointsCost);

  return (
    <Animated.View entering={FadeInDown.delay(350).duration(380)}>
      <View
        style={{
          backgroundColor: '#EF444408',
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: '#EF444420',
          overflow: 'hidden',
        }}
      >
        {/* Top bottleneck highlight */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
            padding: spacing.md,
            borderBottomWidth: bottlenecks.length > 1 ? 1 : 0,
            borderBottomColor: '#EF444415',
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#EF444415',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            <Ionicons name="warning-outline" size={16} color="#EF4444" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Typography variant="captionBold" color="#EF4444" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Score Bottleneck
            </Typography>
            <Typography variant="body" style={{ lineHeight: 20 }}>
              Fixing{' '}
              <Typography variant="bodyBold" color="#EF4444">
                {top.concept}
              </Typography>
              {' '}alone could unlock{' '}
              <Typography variant="bodyBold" color="#10B981">
                ~{top.pointsCost} pts
              </Typography>
              {' '}({overallScore} → {unlocked})
            </Typography>
            {/* Score gain bar */}
            <View style={{ marginTop: 4, gap: 3 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.border, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', height: '100%', borderRadius: 3, overflow: 'hidden' }}>
                  {/* Current score portion */}
                  <View style={{ width: `${overallScore}%` as any, backgroundColor: '#6366F1', borderRadius: 3 }} />
                  {/* Potential gain portion */}
                  <View style={{ width: `${top.pointsCost}%` as any, backgroundColor: '#10B98170', borderRadius: 3 }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
                  Current: {overallScore}
                </Typography>
                <Typography variant="caption" color="#10B981" style={{ fontSize: 9 }}>
                  Potential: {unlocked}
                </Typography>
              </View>
            </View>
            {/* CTA to jump into a session */}
            {top.topicSlug && top.subjectId && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/topic-review',
                    params: {
                      topicSlug:   top.topicSlug,
                      topicName:   top.concept,
                      subjectName: top.subjectName,
                      subjectId:   top.subjectId,
                      examId:      top.examId ?? '',
                      mode:        'concept_practice',
                      conceptTag:  top.tag,
                      conceptName: top.concept,
                    },
                  })
                }
                style={{
                  marginTop: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  alignSelf: 'flex-start',
                  backgroundColor: '#EF444412',
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 5,
                  borderWidth: 1,
                  borderColor: '#EF444425',
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="play-circle-outline" size={13} color="#EF4444" />
                <Typography variant="caption" color="#EF4444" style={{ fontSize: 11, fontWeight: '600' }}>
                  Practice {top.concept} now
                </Typography>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Ranked impact list (all concepts, condensed) */}
        {bottlenecks.length > 1 && (
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 }}>
            <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              All impact areas
            </Typography>
            {bottlenecks.map((wc, i) => {
              const barWidth = Math.max(4, (wc.pointsCost / bottlenecks[0]!.pointsCost) * 100);
              const barColor = i === 0 ? '#EF4444' : '#F59E0B';
              return (
                <View key={wc.tag} style={{ gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color={theme.textSecondary} style={{ fontSize: 10 }} numberOfLines={1}>
                      {i + 1}. {wc.concept}
                    </Typography>
                    <Typography variant="captionBold" color={barColor} style={{ fontSize: 10 }}>
                      −{wc.pointsCost} pts
                    </Typography>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.border, overflow: 'hidden' }}>
                    <View style={{ width: `${barWidth}%` as any, height: '100%', backgroundColor: barColor + '70', borderRadius: 2 }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface ExamReadinessScoreProps {
  data: ExamReadiness;
}

export function ExamReadinessScore({ data }: ExamReadinessScoreProps) {
  const { theme } = useTheme();

  if (data.overallScore === 0 && data.strongAreas.length === 0 && data.studiedTopics === 0) {
    return null; // Don't show if no data at all
  }

  const mastery     = getMasteryLabel(data.overallScore);
  const bottlenecks = computeBottlenecks(data.weakConcepts);

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
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
                  backgroundColor: mastery.color + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography style={{ fontSize: 14 }}>🎯</Typography>
              </View>
              <View>
                <Typography variant="label">Exam Readiness</Typography>
                <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                  {mastery.sublabel}
                </Typography>
              </View>
            </View>
            {data.weeklyDelta !== 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: (data.weeklyDelta > 0 ? '#10B981' : '#EF4444') + '15',
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.full,
                }}
              >
                <Typography
                  variant="captionBold"
                  color={data.weeklyDelta > 0 ? '#10B981' : '#EF4444'}
                  style={{ fontSize: 11 }}
                >
                  {data.weeklyDelta > 0 ? '↑' : '↓'} {Math.abs(data.weeklyDelta)}%
                </Typography>
              </View>
            )}
          </View>

          {/* Ring */}
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <ReadinessRing score={data.overallScore} />
            {/* Signal breakdown */}
            {data.totalTopicsInExam > 0 && (
              <View style={{ gap: 4, alignItems: 'center' }}>
                {/* Coverage as the primary gating context */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
                    📚 Syllabus coverage:
                  </Typography>
                  <Typography
                    variant="captionBold"
                    color={data.coverageFactor >= 0.5 ? '#10B981' : data.coverageFactor >= 0.2 ? '#F59E0B' : '#EF4444'}
                    style={{ fontSize: 10 }}
                  >
                    {data.studiedTopics}/{data.totalTopicsInExam} topics
                    {' '}(×{Math.round(Math.sqrt(data.coverageFactor) * 100)}% gate)
                  </Typography>
                </View>
                {/* Per-signal breakdown */}
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {[
                    { label: 'Understanding', value: data.conceptMasteryScore, icon: '🧠' },
                    { label: 'Depth',         value: data.depthScore,          icon: '📊' },
                    { label: 'Consistency',   value: data.consistencyScore,    icon: '📅' },
                    { label: 'Ability',       value: data.abilityScore,        icon: '⚡', noData: data.abilityScore === 0 && data.studentAbility === 0 },
                  ].map((sig) => (
                    <View key={sig.label} style={{ alignItems: 'center', minWidth: 52 }}>
                      <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 9 }}>
                        {sig.icon} {sig.label}
                      </Typography>
                      <Typography
                        variant="captionBold"
                        color={'noData' in sig && sig.noData ? theme.textTertiary : sig.value >= 70 ? '#10B981' : sig.value >= 40 ? '#F59E0B' : '#EF4444'}
                        style={{ fontSize: 11 }}
                      >
                        {'noData' in sig && sig.noData ? '—' : `${sig.value}%`}
                      </Typography>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* ─── Bottleneck Callout (ML insight) ─────────────────── */}
          {bottlenecks.length > 0 && (
            <BottleneckCallout
              bottlenecks={bottlenecks}
              overallScore={data.overallScore}
            />
          )}

          {/* Strong / Vulnerable areas */}
          <View style={{ gap: spacing.md }}>
            <AreaChips
              areas={data.strongAreas}
              color="#10B981"
              icon="💪"
              label="Exam-ready"
            />
            <AreaChips
              areas={data.vulnerableAreas}
              color="#EF4444"
              icon="📖"
              label="Needs more practice"
            />
          </View>

          {/* Forecast text */}
          {data.daysToTargetReadiness > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: '#6366F108',
                borderRadius: radius.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: '#6366F115',
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#6366F115',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography style={{ fontSize: 12 }}>📈</Typography>
              </View>
              <Typography variant="bodySmall" color={theme.textSecondary} style={{ flex: 1, lineHeight: 18 }}>
                At your current pace, you'll reach{' '}
                <Typography variant="captionBold" color="#6366F1">Master level</Typography>
                {' '}in ~{data.daysToTargetReadiness} study days
              </Typography>
            </View>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}
